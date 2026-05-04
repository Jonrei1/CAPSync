import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message ?? "Invalid email or password." },
      { status: 401 },
    );
  }

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
