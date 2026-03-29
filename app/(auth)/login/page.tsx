"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import supabase from "@/lib/supabaseClient";

type LoadingState = "google" | "email" | null;

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<LoadingState>(null);

  const isBusy = loading !== null;

  async function handleGoogleSignIn() {
    setError("");
    setLoading("google");

    const response = await fetch("/api/auth/google", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const payload = (await response.json()) as { error?: string; url?: string };

    if (!response.ok || !payload.url) {
      setError(payload.error ?? "Unable to start Google sign-in.");
      setLoading(null);
      return;
    }

    window.location.href = payload.url;
  }

  async function handleEmailSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading("email");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(null);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-white md:grid md:grid-cols-2">
      <aside className="hidden bg-gradient-to-br from-indigo-600 to-indigo-500 p-12 md:flex md:flex-col md:justify-between">
        <div>
          <p className="text-5xl font-semibold tracking-tight text-white">CAPSync</p>
          <p className="mt-4 max-w-sm text-lg text-indigo-100">
            Capstone collaboration, simplified.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <span className="rounded-full bg-white/15 px-4 py-1.5 text-sm text-white backdrop-blur">
            Calendar
          </span>
          <span className="rounded-full bg-white/15 px-4 py-1.5 text-sm text-white backdrop-blur">
            Shared Fund
          </span>
          <span className="rounded-full bg-white/15 px-4 py-1.5 text-sm text-white backdrop-blur">
            Progress Tracker
          </span>
        </div>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-6 py-10 md:px-12">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
              Welcome back
            </h1>
            <p className="text-sm text-zinc-600">Sign in to your circle</p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full justify-center gap-2 bg-white shadow-sm"
            onClick={handleGoogleSignIn}
            disabled={isBusy}
          >
            {loading === "google" ? (
              <Spinner />
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path
                  d="M21.805 10.023H12.25v3.954h5.518c-.237 1.272-.95 2.35-2.019 3.073v2.55h3.267c1.912-1.762 3.014-4.36 3.014-7.441 0-.713-.063-1.398-.225-2.136Z"
                  fill="#4285F4"
                />
                <path
                  d="M12.25 22c2.72 0 5.006-.899 6.674-2.45l-3.267-2.55c-.91.615-2.073.976-3.407.976-2.621 0-4.845-1.77-5.64-4.15H3.236v2.625A10.061 10.061 0 0 0 12.25 22Z"
                  fill="#34A853"
                />
                <path
                  d="M6.61 13.826a5.982 5.982 0 0 1 0-3.65V7.55H3.236a10.061 10.061 0 0 0 0 8.9l3.374-2.624Z"
                  fill="#FBBC04"
                />
                <path
                  d="M12.25 6.025c1.48 0 2.807.51 3.853 1.51l2.888-2.888C17.255 2.964 14.97 2 12.25 2A10.061 10.061 0 0 0 3.236 7.55l3.374 2.626c.795-2.38 3.019-4.151 5.64-4.151Z"
                  fill="#EA4335"
                />
              </svg>
            )}
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-zinc-500">or continue with email</span>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleEmailSignIn}>
            <Input
              id="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              disabled={isBusy}
            />
            <Input
              id="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              disabled={isBusy}
            />
            <Button type="submit" className="h-11 w-full bg-indigo-600 hover:bg-indigo-500" disabled={isBusy}>
              {loading === "email" ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  Signing in...
                </span>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <p className="text-sm text-zinc-600">
            No account?{" "}
            <Link href="/circles" className="font-medium text-indigo-600 hover:text-indigo-500">
              Create a circle
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
