"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="font-sans flex min-h-screen flex-col bg-[radial-gradient(circle_at_0%_0%,rgba(219,234,254,0.9),transparent_45%),radial-gradient(circle_at_100%_100%,rgba(224,231,255,0.8),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(240,249,255,0.9),transparent_40%),radial-gradient(circle_at_0%_100%,rgba(239,246,255,0.9),transparent_40%)]">
      <main className="flex flex-1 items-center justify-center px-5 py-16 md:px-8">
        <Card className="w-full max-w-[440px] gap-0 py-8 shadow-lg">
          <CardHeader className="space-y-3.5 px-7 text-center md:px-8">
            <div className="mb-3 flex items-center justify-center">
              <div className="rounded-lg bg-primary p-2.5 text-primary-foreground shadow-sm">
                <RefreshCw className="h-6 w-6" aria-hidden="true" />
              </div>
            </div>
            <CardTitle className=" text-3xl tracking-tight">Welcome back</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-7 px-7 md:px-8">
            <form className="grid gap-6" onSubmit={handleEmailSignIn}>
              <div className="grid gap-3 text-left">
                <label htmlFor="email" className="text-sm font-medium mt-3">
                  Email address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  disabled={isBusy}
                />
              </div>

              <div className="grid gap-3 text-left">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium">
                    Password
                  </label>
                  <button
                    type="button"
                    className="cursor-pointer text-xs font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={isBusy}
                />
              </div>

              <Button
                type="submit"
                className="mt-2 h-11 w-full cursor-pointer"
                disabled={isBusy}
              >
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

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-11 w-full cursor-pointer gap-2"
              onClick={handleGoogleSignIn}
              disabled={isBusy}
            >
              {loading === "google" ? (
                <Spinner />
              ) : (
                <Image
                  src="/google-logo.svg"
                  alt="Google"
                  width={16}
                  height={16}
                  className="h-4 w-4"
                />
              )}
              Continue with Google
            </Button>
          </CardContent>

          <CardFooter className="flex-wrap justify-center gap-1 px-7 pb-8 pt-2 text-center text-sm text-muted-foreground md:px-8">
            Don&apos;t have an account?
            <Link href="/circles" className="font-semibold text-primary hover:underline">
              Create an account
            </Link>
          </CardFooter>
        </Card>
      </main>

      <footer className="w-full px-5 py-8 md:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-5 text-xs text-muted-foreground md:flex-row">
          <div className="font-bold text-foreground/80">CAPSync</div>
          <nav className="flex flex-wrap justify-center gap-5">
            <Link href="#" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="#" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <Link href="#" className="hover:text-foreground transition-colors">
              Cookie Settings
            </Link>
            <Link href="#" className="hover:text-foreground transition-colors">
              Security
            </Link>
          </nav>
          <div>© 2024 CAPSync. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
