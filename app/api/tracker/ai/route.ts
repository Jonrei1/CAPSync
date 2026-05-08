import { NextResponse } from "next/server";
import { errorResponse, getAuthenticatedSupabase, getMembership, isPlainObject } from "@/app/api/tracker/tracker-api-utils";

const SYSTEM_PROMPT =
  "You are a helpful capstone project tracker assistant integrated into CAPSync. Keep responses under 150 words, practical, and specific to student thesis/capstone work. Do not replace the team's workflow. Suggest next actions.";

export async function POST(request: Request) {
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

  const context = `Group: ${group?.name ?? "CAPSync circle"}
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
