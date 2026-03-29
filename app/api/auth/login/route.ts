import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { ensureProfile } from "@/lib/auth/ensureProfile";

type LoginRequest = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as LoginRequest;
  const email = payload.email?.trim().toLowerCase();
  const password = payload.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message ?? "Invalid email or password." },
      { status: 401 },
    );
  }

  const { error: profileError } = await ensureProfile(supabase, data.user);

  if (profileError) {
    return NextResponse.json({ error: profileError }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
