import { NextResponse } from "next/server";
import { errorResponse, getAuthenticatedSupabase, getMembership, isPlainObject } from "@/app/api/tracker/tracker-api-utils";

// ─── rate limit store ───────────────────────────────────────────────────────
const WINDOW_MS = 60_000;          // 1 minute
const PER_IP_LIMIT = 10;           // requests per IP per window
const GLOBAL_LIMIT = 60;           // total requests per window across all IPs

type BucketEntry = { count: number; resetAt: number };
const ipBuckets = new Map<string, BucketEntry>();
let globalBucket: BucketEntry = { count: 0, resetAt: Date.now() + WINDOW_MS };

function checkRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();

  // Global bucket
  if (now > globalBucket.resetAt) {
    globalBucket = { count: 0, resetAt: now + WINDOW_MS };
  }
  if (globalBucket.count >= GLOBAL_LIMIT) {
    return { allowed: false, retryAfter: Math.ceil((globalBucket.resetAt - now) / 1000) };
  }

  // Per-IP bucket
  let bucket = ipBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    ipBuckets.set(ip, bucket);
  }
  if (bucket.count >= PER_IP_LIMIT) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  // Increment both
  bucket.count += 1;
  globalBucket.count += 1;

  // Prune stale IP entries periodically (every ~100 calls)
  if (globalBucket.count % 100 === 0) {
    for (const [key, entry] of ipBuckets.entries()) {
      if (now > entry.resetAt) ipBuckets.delete(key);
    }
  }

  return { allowed: true, retryAfter: 0 };
}

function getClientIp(req: Request): string {
  // Vercel sets x-forwarded-for; fall back to a placeholder so the limiter
  // still works in local dev where the header is absent.
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return "unknown";
}
// ────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  "You are a helpful capstone project tracker assistant integrated into Libré. Keep responses under 150 words, practical, and specific to student thesis/capstone work. Do not replace the team's workflow. Suggest next actions.";

export async function POST(request: Request) {
  // ── rate limit ──────────────────────────────────────────────────────────
  const ip = getClientIp(request);
  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment before trying again." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }
  // ── end rate limit ───────────────────────────────────────────────────────

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return errorResponse("AI assistant is not configured.", 500);
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (!isPlainObject(body) || typeof body.groupId !== "string" || typeof body.prompt !== "string") {
    return errorResponse("Missing groupId or prompt.", 400);
  }

  const prompt = body.prompt.trim();
  if (!body.groupId || !prompt) {
    return errorResponse("Missing groupId or prompt.", 400);
  }

  if (prompt.length > 2000) {
    return errorResponse("Prompt is too long.", 400);
  }

  const auth = await getAuthenticatedSupabase();
  if (auth.response) {
    return auth.response;
  }

  const membership = await getMembership(auth.supabase, body.groupId, auth.user.id);
  if (!membership) {
    return errorResponse("Forbidden.", 403);
  }

  const [groupResult, sprintsResult, tasksResult] = await Promise.all([
    auth.supabase.from("groups").select("name, methodology").eq("id", body.groupId).maybeSingle(),
    auth.supabase.from("sprints").select("title, status, start_date, end_date").eq("group_id", body.groupId).order("start_date"),
    auth.supabase
      .from("tasks")
      .select("title, status, due_date, priority, category")
      .eq("group_id", body.groupId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(40),
  ]);

  const group = groupResult.data;
  const sprintSummary = (sprintsResult.data ?? [])
    .map((sprint) => `${sprint.title}: ${sprint.status} (${sprint.start_date} to ${sprint.end_date})`)
    .join("\n");
  const taskSummary = (tasksResult.data ?? [])
    .map((task) => `${task.title} - ${task.status}, due ${task.due_date ?? "none"}, priority ${task.priority ?? "medium"}`)
    .join("\n");

  const context = `Group: ${group?.name ?? "Libré circle"}
Methodology: ${group?.methodology ?? "scrum"}
Sprints:
${sprintSummary || "No sprints yet."}
Tasks:
${taskSummary || "No tasks yet."}`;

  const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 220,
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: context },
        { role: "user", content: prompt },
      ],
    }),
  });

  const payload = (await groqResponse.json().catch(() => null)) as
    | {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      }
    | null;

  if (!groqResponse.ok) {
    return errorResponse(payload?.error?.message ?? "AI provider request failed.", 502);
  }

  return NextResponse.json({ message: payload?.choices?.[0]?.message?.content ?? "No assistant response received." });
}
