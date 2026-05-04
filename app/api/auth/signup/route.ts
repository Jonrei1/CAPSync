import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
  if (password.length < MIN_PASSWORD_LENGTH)
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  if (!/[a-z]/.test(password))
    return "Password must include at least one lowercase letter.";
  if (!/[A-Z]/.test(password))
    return "Password must include at least one uppercase letter.";
  if (!/\d/.test(password))
    return "Password must include at least one number.";
  if (!/[`~!@#$%^&*()_\-+={[}\]|\\:;"'<,>.?/]/.test(password))
    return "Password must include at least one special character.";
  if (/\s/.test(password))
    return "Password must not contain spaces.";
  return null;
}

export async function POST(request: Request) {
  const payload = (await request.json()) as SignupRequest;
  const email    = payload.email?.trim().toLowerCase() ?? "";
  const password = payload.password ?? "";
  const fullName = payload.fullName?.trim() || fallbackAccountName(email);

  // --- Input validation ---
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  const passwordError = getPasswordError(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  // --- Duplicate email guard (admin lookup bypasses RLS) ---
  const { data: existingUsers, error: lookupError } =
    await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

  if (!lookupError && existingUsers) {
    const alreadyExists = existingUsers.users.some(
      (u) => u.email?.toLowerCase() === email,
    );
    if (alreadyExists) {
      return NextResponse.json(
        {
          error:
            "An account with this email already exists. Please sign in instead.",
        },
        { status: 409 },
      );
    }
  }

  // --- Create auth user ---
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) {
    // Supabase may still surface a duplicate error if listUsers was paginated.
    const msg = error.message.toLowerCase();
    if (
      msg.includes("already registered") ||
      msg.includes("already exists") ||
      msg.includes("user already registered")
    ) {
      return NextResponse.json(
        {
          error:
            "An account with this email already exists. Please sign in instead.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // --- Guaranteed profile upsert via admin client (bypasses RLS) ---
  // This handles the case where:
  //   a) Email confirmation is enabled → data.session is null → auth.uid() = null → RLS blocks insert.
  //   b) The handle_new_user trigger has not been applied yet.
  if (data.user) {
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id:         data.user.id,
          full_name:  fullName,
          email:      email,
        },
        { onConflict: "id" },
      );

    if (profileError) {
      // Log but do not hard-fail — the trigger will retry on first login.
      console.error("[signup] profile upsert failed:", profileError.message);
    }
  }

  return NextResponse.json({
    ok: true,
    requiresEmailConfirmation: !data.session,
  });
}
