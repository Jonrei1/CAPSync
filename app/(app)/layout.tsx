"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
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
  {
    label: "Tracker",
    href: "/tracker",
    icon: (
      <svg className="h-3.75 w-3.75 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    label: "Fund",
    href: "/fund",
    icon: (
      <svg className="h-3.75 w-3.75 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
];

function AppShell({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const { activeCircle } = useCircle();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
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
          <MemberList />
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
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: activeCircle?.color ?? "#4f46e5" }}
              />
              <span className="text-sm font-medium text-zinc-900">{activeCircle?.name ?? "No active circle"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2" />
        </header>

        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <CircleProvider>
      <AppShell>{children}</AppShell>
    </CircleProvider>
  );
}
