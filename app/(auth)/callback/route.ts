import { NextResponse } from "next/server";

// Legacy route shim: redirects /callback to /auth/callback.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = new URL(`/auth/callback${url.search}`, url.origin);
  return NextResponse.redirect(target);
}
