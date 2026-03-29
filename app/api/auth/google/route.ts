import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabaseServer";

// Starts Google OAuth and returns the provider URL to the frontend.
export async function POST() {
  const supabase = await createClient();
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const redirectTo = `${protocol}://${host}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error || !data.url) {
    return NextResponse.json(
      { error: error?.message ?? "Unable to start Google OAuth flow." },
      { status: 400 },
    );
  }

  return NextResponse.json({ url: data.url });
}
