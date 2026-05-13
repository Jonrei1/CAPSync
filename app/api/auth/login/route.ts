import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  clearLoginAttempts,
  getLoginRateLimitState,
  recordFailedLoginAttempt,
} from "@/lib/auth/login-rate-limit";

type LoginRequest = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as LoginRequest;
  const email    = payload.email?.trim().toLowerCase();
  const password = payload.password ?? "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const rateLimitState = await getLoginRateLimitState(request, email);

  if (!rateLimitState.allowed) {
    return NextResponse.json(
      {
        error: "Too many login attempts. Try again later.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitState.retryAfterSeconds ?? 60),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    await recordFailedLoginAttempt(rateLimitState.key);

    return NextResponse.json(
      { error: error?.message ?? "Invalid email or password." },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  await clearLoginAttempts(rateLimitState.key);

  // Ensure profile exists — admin client bypasses RLS safely.
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id:        data.user.id,
        full_name: (data.user.user_metadata?.full_name as string | undefined) ??
                   (data.user.user_metadata?.name as string | undefined) ??
                   null,
        email:     data.user.email ?? null,
      },
      { onConflict: "id" },
    );

  if (profileError) {
    console.error("[login] profile upsert failed:", profileError.message);
    // Non-fatal — user is still signed in.
  }

  return NextResponse.json({ ok: true });
}
