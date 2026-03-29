import { type ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import AppShellClient from "./AppShellClient";

type AppLayoutProps = {
  children: ReactNode;
};

export default async function AppLayout({ children }: AppLayoutProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <AppShellClient>{children}</AppShellClient>;
}
