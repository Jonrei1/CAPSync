"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import JoinCreateDialog from "@/components/circles/JoinCreateDialog";
import CircleSwitcher from "@/components/circles/CircleSwitcher";
import MemberList from "@/components/circles/MemberList";
import { Button } from "@/components/ui/button";
import { CircleProvider, useCircle } from "@/contexts/CircleContext";

type AppLayoutProps = {
  children: ReactNode;
};

type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Calendar",
    href: "/calendar",
    icon: (
      <svg className="h-3.75 w-3.75 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
];

function AppShell({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { activeCircle, dialogOpen, setDialogOpen, dialogTab } = useCircle();
  const isPersonalCalendarRoute = pathname === "/calendar" || pathname.startsWith("/calendar/");
  const showCircleChrome = Boolean(activeCircle) && !isPersonalCalendarRoute;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [accountName, setAccountName] = useState("Account");
  const [accountEmail, setAccountEmail] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const response = await fetch("/api/profile/me");
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          profile?: { full_name?: string | null; email?: string | null };
        };

        if (!mounted) {
          return;
        }

        const resolvedName =
          payload.profile?.full_name?.trim() ||
          payload.profile?.email?.split("@")[0] ||
          "Account";

        setAccountName(resolvedName);
        setAccountEmail(payload.profile?.email ?? null);
      } catch {
        // Ignore profile fetch errors here; auth guard will handle invalid sessions.
      }
    }

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogout() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <JoinCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        existingGroupCount={0}
        initialTab={dialogTab}
      />

      <div className="min-h-screen bg-zinc-50">
      <div
        className={[
          "fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden",
          sidebarOpen ? "opacity-100 pointer-events-auto" : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-55 flex-col border-r bg-white py-4 transition-transform md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <Button
          variant="outline"
          size="icon-sm"
          className="absolute top-3 right-3 cursor-pointer md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          ✕
        </Button>

        <div className="mb-2 border-b px-4 pb-4 text-[15px] font-semibold tracking-[-0.03em] text-zinc-900">
          CAP<span className="text-green-600">Sync</span>
        </div>

        <div className="px-3">
          <div className="mb-1 px-1 text-[11px] font-medium tracking-[0.08em] text-zinc-500 uppercase">Main</div>
          <nav className="flex flex-col gap-px">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={[
                    "flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-zinc-500 transition-colors",
                    isActive ? "bg-zinc-100 font-medium text-zinc-900" : "hover:bg-zinc-100 hover:text-zinc-900",
                  ].join(" ")}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <CircleSwitcher />

        <div className="mt-auto">
          {showCircleChrome ? <MemberList /> : null}

          <div className="mt-2 border-t px-2 pt-3 pb-1">
            <div className="mb-2 px-1">
              <div className="truncate text-[12px] font-semibold text-zinc-900">{accountName}</div>
              {accountEmail ? <div className="truncate text-[11px] text-zinc-500">{accountEmail}</div> : null}
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-8 w-full cursor-pointer justify-start text-[12px]"
              onClick={handleLogout}
              disabled={signingOut}
            >
              <span className="inline-flex items-center gap-1.5">
                <LogOut className="size-3.5" />
                {signingOut ? "Signing out..." : "Logout"}
              </span>
            </Button>
          </div>
        </div>
      </aside>

      <div className="md:ml-55">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-white px-4 py-3 md:px-6">
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="icon"
              className="cursor-pointer md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="size-4" />
            </Button>

            <div className="flex items-center gap-2">
              {showCircleChrome ? (
                <>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: activeCircle?.color ?? "#4f46e5" }}
                  />
                  <span className="text-sm font-medium text-zinc-900">{activeCircle?.name}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2" />
        </header>

        <main className="p-4 md:p-6">{children}</main>
      </div>
      </div>
  </>
  );
}

export default function AppShellClient({ children }: AppLayoutProps) {
  return (
    <CircleProvider>
      <AppShell>{children}</AppShell>
    </CircleProvider>
  );
}
