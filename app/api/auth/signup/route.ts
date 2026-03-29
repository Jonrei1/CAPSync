import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { ensureProfile } from "@/lib/auth/ensureProfile";

type SignupRequest = {
  email?: string;
  password?: string;
  fullName?: string;
};

const MIN_PASSWORD_LENGTH = 12;

function fallbackAccountName(email: string) {
  const [username] = email.split("@");
  return username || "CAPSync User";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getPasswordError(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }

  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }

  if (!/\d/.test(password)) {
    return "Password must include at least one number.";
  }

  if (!/[`~!@#$%^&*()_\-+={[}\]|\\:;\"'<,>.?/]/.test(password)) {
    return "Password must include at least one special character.";
  }

  if (/\s/.test(password)) {
    return "Password must not contain spaces.";
  }

  return null;
}

export async function POST(request: Request) {
  const payload = (await request.json()) as SignupRequest;
  const email = payload.email?.trim().toLowerCase() ?? "";
  const password = payload.password ?? "";
  const fullName = payload.fullName?.trim() || fallbackAccountName(email);

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const passwordError = getPasswordError(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (data.user) {
    const { error: profileError } = await ensureProfile(supabase, data.user);
    if (profileError) {
      return NextResponse.json({ error: profileError }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    requiresEmailConfirmation: !data.session,
  });
}
