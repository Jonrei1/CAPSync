import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", requestUrl.origin),
    );
  }

  const supabase = await createClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

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
    return NextResponse.redirect(
      new URL("/login?error=invalid_session", requestUrl.origin),
    );
  }

  // Admin upsert — bypasses RLS, handles both new and returning OAuth users.
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id:        user.id,
        full_name: (user.user_metadata?.full_name as string | undefined) ??
                   (user.user_metadata?.name as string | undefined) ??
                   null,
        email:     user.email ?? null,
      },
      { onConflict: "id" },
    );

  if (profileError) {
    console.error("[oauth-callback] profile upsert failed:", profileError.message);
    return NextResponse.redirect(
      new URL("/login?error=profile_sync_failed", requestUrl.origin),
    );
  }

  return NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
}
