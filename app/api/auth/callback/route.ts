import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";

// Returns the current auth session after callback has completed.
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  return NextResponse.json({
    session: {
      access_token: data.session.access_token,
      expires_at: data.session.expires_at,
      user: {
        id: data.session.user.id,
        email: data.session.user.email,
      },
    },
  });
}
