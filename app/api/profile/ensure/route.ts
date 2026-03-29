import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { ensureProfile } from "@/lib/auth/ensureProfile";

// Explicit endpoint to ensure profile creation for the current user.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const { profile, error } = await ensureProfile(supabase, user);

  if (error || !profile) {
    return NextResponse.json(
      { error: error ?? "Failed to ensure profile." },
      { status: 500 },
    );
  }

  return NextResponse.json({ profile });
}
