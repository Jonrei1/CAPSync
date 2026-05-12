"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState, CSSProperties, useMemo, useEffect } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import TrackerCalendar from "@/components/tracker/TrackerCalendar";
import type { Group, Profile, TrackerTask } from "@/types";

type LoadingState = "google" | "email" | null;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getPasswordError(password: string) {
  if (!password) return "";
  if (password.length < 12) return "Password must be at least 12 characters long.";
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
  if (!/\d/.test(password)) return "Password must include at least one number.";
  if (!/[`~!@#$%^&*()_\-+={[}\]|\\:;\"'<,>.?/]/.test(password)) {
    return "Password must include at least one special character.";
  }
  if (/\s/.test(password)) return "Password must not contain spaces.";
  return "";
}

function getConfirmPasswordError(password: string, confirmPassword: string) {
  if (!confirmPassword) return "";
  if (password !== confirmPassword) return "Passwords do not match.";
  return "";
}

function MessageBanner({
  tone,
  title,
  message,
}: {
  tone: "error" | "success";
  title: string;
  message: string;
}) {
  const isError = tone === "error";
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 shadow-sm",
        isError
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
      )}
    >
      <div
        className={cn(
          "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isError ? "bg-destructive/20 text-destructive" : "bg-emerald-500/20 text-emerald-500",
        )}
      >
        {isError ? <AlertCircle className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed opacity-90">{message}</p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

function fallbackAccountName(email: string) {
  const [username] = email.split("@");
  return username || "Libré User";
}

const dummyGroup: Group = {
  id: "dummy",
  name: "Design Circle",
  methodology: "kanban",
  created_by: "1",
  created_at: "2024-01-01T00:00:00.000Z",
  archived_at: null,
  subject: "Productivity",
  color: "#4f46e5",
};

const dummyMembers: Profile[] = [
  { id: "1", email: "alice@example.com", full_name: "Alice L", created_at: "", color: "#4f46e5" },
  { id: "2", email: "bob@example.com", full_name: "Bob M", created_at: "", color: "#ea580c" },
];

const lightThemeVars = {
  '--background': 'oklch(1 0 0)',
  '--foreground': 'oklch(0.145 0 0)',
  '--card': 'oklch(1 0 0)',
  '--card-foreground': 'oklch(0.145 0 0)',
  '--popover': 'oklch(1 0 0)',
  '--popover-foreground': 'oklch(0.145 0 0)',
  '--primary': 'oklch(0.205 0 0)',
  '--primary-foreground': 'oklch(0.985 0 0)',
  '--secondary': 'oklch(0.97 0 0)',
  '--secondary-foreground': 'oklch(0.205 0 0)',
  '--muted': 'oklch(0.97 0 0)',
  '--muted-foreground': 'oklch(0.556 0 0)',
  '--accent': 'oklch(0.97 0 0)',
  '--accent-foreground': 'oklch(0.205 0 0)',
  '--destructive': 'oklch(0.577 0.245 27.325)',
  '--border': 'oklch(0.922 0 0)',
  '--input': 'oklch(0.922 0 0)',
  '--ring': 'oklch(0.708 0 0)'
} as CSSProperties;

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState<LoadingState>(null);

  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => setIsClient(true));
    return () => window.cancelAnimationFrame(animationFrameId);
  }, []);

  const dummyTasks = useMemo(() => {
    if (!isClient) return [];
    const today = new Date();
    return [
      {
        id: "t1",
        group_id: "dummy",
        title: "Finalize App Redesign",
        description: "",
        status: "doing",
        priority: "high",
        assigned_to: "1",
        sprint_id: null,
        due_date: today.toISOString(),
        created_by: "1",
        created_at: today.toISOString(),
        updated_at: today.toISOString(),
        starts_at: today.toISOString(),
        ends_at: today.toISOString(),
        is_all_day: false,
      },
      {
        id: "t2",
        group_id: "dummy",
        title: "Review Q3 Roadmap",
        description: "",
        status: "todo",
        priority: "medium",
        assigned_to: "2",
        sprint_id: null,
        due_date: new Date(today.getTime() + 86400000 * 2).toISOString(),
        created_by: "1",
        created_at: today.toISOString(),
        updated_at: today.toISOString(),
        starts_at: null,
        ends_at: null,
        is_all_day: true,
      }
    ] as TrackerTask[];
  }, [isClient]);

  const emailError = email && !isValidEmail(email) ? "Please enter a valid email address." : "";
  const passwordError = getPasswordError(password);
  const liveConfirmPasswordError = getConfirmPasswordError(password, confirmPassword);
  const formBusy = loading !== null;

  const isBusy = formBusy;

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
    setConfirmPasswordError(liveConfirmPasswordError);

    if (emailError || passwordError || liveConfirmPasswordError) {
      setLoading(null);
      return;
    }

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

    setFullName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setConfirmPasswordError("");

    if (!payload.requiresEmailConfirmation) {
      setInfo("Account created successfully.");
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    setInfo("Account created successfully.");
    setLoading(null);
  }

  return (
    <div className="flex min-h-screen bg-background p-2 sm:p-4 md:p-6 lg:p-8 font-sans overflow-y-auto">
      <div className="flex w-full rounded-2xl sm:rounded-3xl bg-card border border-border shadow-2xl flex-col lg:flex-row">
        {/* Left Column: Form */}
        <div className="relative flex w-full flex-col px-4 py-6 sm:px-6 sm:py-8 lg:w-1/2 xl:w-5/12 lg:px-12 xl:px-20 border-b lg:border-b-0 lg:border-r border-border">
          {/* Header/Brand */}
            <div className="flex items-center gap-2 mb-8 lg:absolute lg:left-8 lg:top-8 lg:mb-0">
                   <Image 
                     src="/images/logo.png"
                     alt="Libré Logo" 
                     width={40} 
                     height={40} 
                     className="object-contain"
                     priority 
                   />
                   <span className="text-xl sm:text-2xl font-bold tracking-normal text-foreground">Libré</span>
                 </div>

          <div className="mx-auto flex w-full max-w-sm lg:max-w-md flex-col justify-center flex-1 py-4 sm:py-8">
            <div className="mb-4 sm:mb-6 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Create Account
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Start collaborating with your circle in minutes.
              </p>
            </div>

            <form className="grid gap-3" onSubmit={handleEmailSignUp}>
              <div className="grid gap-2 text-left">
                <label htmlFor="fullName" className="text-sm font-medium text-foreground">
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
                  className="h-11 rounded-lg"
                />
              </div>

              <div className="grid gap-2 text-left">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (error) setError("");
                  }}
                  autoComplete="email"
                  required
                  disabled={isBusy}
                  className="h-11 rounded-lg"
                />
                {emailError ? <p className="text-[13px] text-destructive mt-1">{emailError}</p> : null}
              </div>

              <div className="grid gap-2 text-left">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 12 chars with upper/lower/number/symbol"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) setError("");
                    if (confirmPasswordError) setConfirmPasswordError("");
                  }}
                  autoComplete="new-password"
                  minLength={12}
                  required
                  disabled={isBusy}
                  className="h-11 rounded-lg"
                />
                {passwordError ? <p className="text-[13px] text-destructive mt-1">{passwordError}</p> : null}
              </div>

              <div className="grid gap-2 text-left">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                  Re-enter password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (confirmPasswordError) setConfirmPasswordError("");
                    if (error) setError("");
                  }}
                  placeholder="Re-enter your password"
                  disabled={isBusy}
                  className="h-11 rounded-lg"
                />
                {confirmPasswordError ? (
                  <p className="text-[13px] text-destructive mt-1">{confirmPasswordError}</p>
                ) : null}
              </div>

              <Button
                type="submit"
                className="mt-2 h-11 w-full rounded-lg text-base font-medium shadow-sm"
                disabled={isBusy}
              >
                {loading === "email" ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner />
                    Creating account...
                  </span>
                ) : (
                  "Register"
                )}
              </Button>
            </form>

            <div className="mt-3">
              {error ? (
                <MessageBanner tone="error" title="Sign up failed" message={error} />
              ) : null}
              {info ? (
                <MessageBanner tone="success" title="Account created" message={info} />
              ) : null}
            </div>

            <div className="relative mt-4 py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground font-medium">
                  Or Register With
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="mt-4 h-11 w-full rounded-lg bg-card font-medium text-foreground hover:bg-muted gap-2 shadow-sm"
              onClick={handleGoogleSignIn}
              disabled={isBusy}
            >
              {loading === "google" ? (
                <Spinner />
              ) : (
                <Image
                  src="/google-logo.svg"
                  alt="Google"
                  width={18}
                  height={18}
                  className="h-4.5 w-4.5"
                />
              )}
              Google
            </Button>

            <div className="mt-8 text-center text-sm text-muted-foreground">
              Already Have An Account?{" "}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Log In.
              </Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between text-xs text-muted-foreground font-medium gap-2 mt-6 lg:mt-8 lg:absolute lg:bottom-8 lg:left-8 lg:right-8">
            <div>Copyright © {new Date().getFullYear()} Libré.</div>
            <Link href="#" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          </div>
        </div>

        {/* Right Column: Visual */}
        <div className="relative hidden w-0 flex-1 lg:flex flex-col justify-start bg-zinc-950 p-6 lg:p-12 xl:p-20 pt-12 lg:pt-24 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute top-0 left-0 right-0 h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]"></div>
            <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.15),transparent_50%)] translate-x-1/3 translate-y-1/3"></div>
            <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(167,139,250,0.1),transparent_50%)] rounded-full blur-3xl mix-blend-screen"></div>
          </div>
          
          <div className="relative z-10 mx-auto w-full max-w-5xl text-left">
            <h1 className="mb-4 text-3xl font-semibold leading-tight text-white xl:text-4xl animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
              Effortlessly manage your<br />circle and operations.
            </h1>
            <p className="mb-8 text-base text-zinc-300 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
              Bring your group together with seamless planning, scheduling, and event management.
            </p>

            {isClient && (
              <div 
                className="relative mt-12 h-[520px] w-full overflow-hidden rounded-2xl bg-background p-4 shadow-2xl ring-1 ring-border/50 flex justify-center animate-in fade-in zoom-in-95 duration-1000 delay-300 fill-mode-both"
                style={lightThemeVars}
              >
                <div className="pointer-events-none origin-top transform scale-[0.55] xl:scale-[0.65] w-[160%] shrink-0">
                  <TrackerCalendar 
                    group={dummyGroup}
                    members={dummyMembers}
                    sprints={[]}
                    tasks={dummyTasks}
                    currentUserId="1"
                    canManage={false}
                    hideAssistant={true}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
