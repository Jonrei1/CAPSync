import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { ensureProfile } from "@/lib/auth/ensureProfile";

// Handles OAuth callback from Supabase.
// 1) Exchanges the auth code for a session.
// 2) Ensures profile exists in public.profiles.
// 3) Redirects to dashboard on success.
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", requestUrl.origin));
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      new URL("/login?error=oauth_exchange_failed", requestUrl.origin),
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(new URL("/login?error=invalid_session", requestUrl.origin));
  }

  const { error: profileError } = await ensureProfile(supabase, user);

  if (profileError) {
    return NextResponse.redirect(new URL("/login?error=profile_sync_failed", requestUrl.origin));
  }

  return NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
}
