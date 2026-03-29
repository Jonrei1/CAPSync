import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        try {
          (cookieStore as unknown as { set: (args: unknown) => void }).set({
            name,
            value,
            ...options,
          });
        } catch {
          // Ignore cookie writes in contexts where they are not supported.
        }
      },
      remove(name: string, options: Record<string, unknown>) {
        try {
          (cookieStore as unknown as { set: (args: unknown) => void }).set({
            name,
            value: "",
            ...options,
          });
        } catch {
          // Ignore cookie writes in contexts where they are not supported.
        }
      },
    },
  });
}
