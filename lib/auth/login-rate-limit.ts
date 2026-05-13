import { createHash } from "crypto";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const RATE_LIMIT_BLOCK_SECONDS = 15 * 60;
const MAX_LOGIN_ATTEMPTS = 5;

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return (
    forwardedFor ??
    request.headers.get("x-real-ip")?.trim() ??
    request.headers.get("cf-connecting-ip")?.trim() ??
    "unknown"
  );
}

function getRateLimitKey(request: Request, email: string) {
  const rawKey = `${getClientIp(request)}:${email}`;

  return createHash("sha256").update(rawKey).digest("hex");
}

export async function getLoginRateLimitState(request: Request, email: string) {
  const key = getRateLimitKey(request, email);
  return checkLoginRateLimit(key);
}

async function checkLoginRateLimit(rateLimitKey: string) {
  const { data, error } = await supabaseAdmin.rpc("check_login_rate_limit", {
    p_key_hash: rateLimitKey,
  });

  if (error) {
    console.error("[login-rate-limit] check failed:", error.message);
    return { allowed: true as const, key: rateLimitKey };
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (result && typeof result === "object" && "allowed" in result) {
    const allowed = Boolean((result as { allowed: unknown }).allowed);
    const retryAfterSeconds =
      typeof (result as { retry_after_seconds?: unknown }).retry_after_seconds === "number"
        ? ((result as { retry_after_seconds: number }).retry_after_seconds ?? 0)
        : undefined;

    return {
      allowed,
      key: rateLimitKey,
      retryAfterSeconds,
    } as const;
  }

  return { allowed: true as const, key: rateLimitKey };
}

export async function recordFailedLoginAttempt(rateLimitKey: string) {
  const { error } = await supabaseAdmin.rpc("record_login_failure", {
    p_key_hash: rateLimitKey,
    p_max_attempts: MAX_LOGIN_ATTEMPTS,
    p_block_seconds: RATE_LIMIT_BLOCK_SECONDS,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
  });

  if (error) {
    console.error("[login-rate-limit] record failed:", error.message);
  }
}

export async function clearLoginAttempts(rateLimitKey: string) {
  const { error } = await supabaseAdmin
    .from("login_attempts")
    .delete()
    .eq("key_hash", rateLimitKey);

  if (error) {
    console.error("[login-rate-limit] clear failed:", error.message);
  }
}
