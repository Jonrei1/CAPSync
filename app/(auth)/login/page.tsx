"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState, CSSProperties, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CalendarShell from "@/components/circle-calendar/CalendarShell";
import type { CalendarMember, CalendarBlock, FreeWindow, CalendarDeadline } from "@/types";

type LoadingState = "google" | "email" | null;

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

const dummyCalendarMembers: CalendarMember[] = [
  {
    id: "1",
    name: "Alice L",
    ini: "AL",
    bg: "#4f46e5",
    lt: "rgba(79, 70, 229, 0.15)",
    bd: "rgba(79, 70, 229, 0.5)",
    tc: "#2e2a85",
    role: "pm",
  },
  {
    id: "2",
    name: "Bob M",
    ini: "BM",
    bg: "#ea580c",
    lt: "rgba(234, 88, 12, 0.15)",
    bd: "rgba(234, 88, 12, 0.5)",
    tc: "#9a3412",
    role: "member",
  },
];

const dummyCalendarBlocks: CalendarBlock[] = [
  // Alice's blocks (1 hr each)
  { memberId: "1", days: ["mon", "wed", "fri"], s: 9, e: 10, lbl: "Stand-up", sub: "Main Hall", routine: true },
  { memberId: "1", days: ["tue"], s: 10, e: 11, lbl: "Design Review", sub: "Room A", routine: false },
  { memberId: "1", days: ["thu"], s: 14, e: 15, lbl: "Sprint Planning", sub: "Conference", routine: false },
  // Bob's blocks (1 hr each)
  { memberId: "2", days: ["mon", "wed"], s: 10, e: 11, lbl: "Code Review", sub: "Remote", routine: true },
  { memberId: "2", days: ["tue", "thu"], s: 9, e: 10, lbl: "Dev Sync", sub: "Room B", routine: false },
  { memberId: "2", days: ["fri"], s: 13, e: 14, lbl: "Retrospective", sub: "Main Hall", routine: false },
];

const dummyFreeWindows: FreeWindow[] = [
  { days: ["mon", "tue", "wed"], s: 11, e: 13, memberIds: ["1", "2"], lbl: "Both free", dur: "2 hrs" },
  { days: ["thu"], s: 10, e: 12, memberIds: ["1", "2"], lbl: "Both free", dur: "2 hrs" },
  { days: ["fri"], s: 10, e: 12, memberIds: ["1", "2"], lbl: "Both free", dur: "2 hrs" },
];

const dummyCalendarDeadlines: CalendarDeadline[] = [
  { days: ["wed"], lbl: "Project Milestone" },
  { days: ["fri"], lbl: "Sprint Deadline" },
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<LoadingState>(null);

  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => setIsClient(true));
    return () => window.cancelAnimationFrame(animationFrameId);
  }, []);

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

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Unable to sign in.");
      setLoading(null);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
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

          <div className="mx-auto flex w-full max-w-sm flex-col justify-center flex-1 py-4 sm:py-8">
            <div className="mb-4 sm:mb-6 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Welcome Back
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your email and password to access your account.
              </p>
            </div>

            <form className="grid gap-4" onSubmit={handleEmailSignIn}>
              {/* Email */}
              <div className="grid gap-2 text-left">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email
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
                  className="h-11 rounded-lg"
                />
              </div>

              {/* Password */}
              <div className="grid gap-2 text-left">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={isBusy}
                  className="h-11 rounded-lg"
                />
              </div>

                {/* Remember Me */}
                <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <input type="checkbox" id="remember" className="h-4 w-4 rounded border-border accent-black focus:ring-black cursor-pointer" />
                    <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">Remember Me</label>
                 </div>
              </div>

              <Button
                type="submit"
                className="mt-2 h-11 w-full rounded-lg text-base font-medium shadow-sm"
                disabled={isBusy}
              >
                {loading === "email" ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner />
                    Logging in...
                  </span>
                ) : (
                  "Log In"
                )}
              </Button>
            </form>

            {error ? <p className="mt-4 text-center text-sm font-medium text-destructive">{error}</p> : null}

            <div className="relative mt-4 py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground font-medium">
                  Or Login With
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="mt-6 h-11 w-full rounded-lg bg-card font-medium text-foreground hover:bg-muted gap-2 shadow-sm"
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
              Don&apos;t Have An Account?{" "}
              <Link href="/signup" className="font-semibold text-primary hover:underline">
                Register Now.
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
              Your team’s time finally Libré <br/>in one place.
              
            </h1>
            <p className="mb-8 text-base text-zinc-300 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
              Coordinate events, track schedules, and keep everyone aligned effortlessly.
            </p>

            {isClient && (
              <div 
                className="relative mt-12 h-[520px] w-full overflow-hidden rounded-2xl bg-background p-4 shadow-2xl ring-1 ring-border/50 flex justify-center animate-in fade-in zoom-in-95 duration-1000 delay-300 fill-mode-both"
                style={lightThemeVars}
              >
                <div className="pointer-events-none origin-top transform scale-[0.55] xl:scale-[0.65] w-[160%] h-[720px] shrink-0">
                  <CalendarShell
                    members={dummyCalendarMembers}
                    blocks={dummyCalendarBlocks}
                    freeWindows={dummyFreeWindows}
                    deadlines={dummyCalendarDeadlines}
                    groupId="dummy"
                    groupName="Design Circle"
                    groupColor="#4f46e5"
                    weekOffset={0}
                    selectedDate={new Date().toISOString().split("T")[0]}
                    startHour={8}
                    endHour={15}
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
