"use client";
import { createBrowserClient } from "@supabase/ssr";

// Browser-side client used only for auth flows (admin sign-in/out).
// All data reads/writes go through API routes; do not query tables here.
export function getSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
