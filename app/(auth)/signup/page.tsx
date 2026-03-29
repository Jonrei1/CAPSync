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

type LoadingState = "google" | "email" | null;

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

function fallbackAccountName(email: string) {
  const [username] = email.split("@");
  return username || "CAPSync User";
}

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState<LoadingState>(null);

  const isBusy = loading !== null;

  async function handleGoogleSignIn() {
    setError("");
    setInfo("");
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

  async function handleEmailSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");
    setLoading("email");

    const cleanedFullName = fullName.trim();

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        fullName: cleanedFullName || fallbackAccountName(email),
      }),
    });

    const payload = (await response.json()) as {
      error?: string;
      requiresEmailConfirmation?: boolean;
    };

    if (!response.ok) {
      setError(payload.error ?? "Unable to create account.");
      setLoading(null);
      return;
    }

    if (!payload.requiresEmailConfirmation) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    setInfo("Account created. Check your email to confirm your account, then sign in.");
    setLoading(null);
  }

  return (
    <div className="font-sans flex min-h-screen flex-col bg-[radial-gradient(circle_at_0%_0%,rgba(219,234,254,0.9),transparent_45%),radial-gradient(circle_at_100%_100%,rgba(224,231,255,0.8),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(240,249,255,0.9),transparent_40%),radial-gradient(circle_at_0%_100%,rgba(239,246,255,0.9),transparent_40%)]">
      <main className="flex flex-1 items-center justify-center px-5 py-16 md:px-8">
        <Card className="w-full max-w-110 gap-0 py-8 shadow-lg">
          <CardHeader className="space-y-3.5 px-7 text-center md:px-8">
            <div className="mb-3 flex items-center justify-center">
              <div className="rounded-lg bg-primary p-2.5 text-primary-foreground shadow-sm">
                <RefreshCw className="h-6 w-6" aria-hidden="true" />
              </div>
            </div>
            <CardTitle className="text-3xl tracking-tight">Create your account</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Start collaborating with your circle in minutes
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-7 px-7 md:px-8">
            <form className="grid gap-6" onSubmit={handleEmailSignUp}>
              <div className="grid gap-3 text-left">
                <label htmlFor="fullName" className="text-sm font-medium mt-3">
                  Full name
                </label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Juan Dela Cruz"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  disabled={isBusy}
                />
              </div>

              <div className="grid gap-3 text-left">
                <label htmlFor="email" className="text-sm font-medium">
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
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 12 chars with upper/lower/number/symbol"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={12}
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
                    Creating account...
                  </span>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {info ? <p className="text-sm text-green-700">{info}</p> : null}

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
            Already have an account?
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
