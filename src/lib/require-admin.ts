import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";

// Helper for admin API routes. Returns null if authorized; otherwise a 401 response.
export async function requireAdmin(): Promise<NextResponse | null> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Any authenticated user is treated as admin — accounts are provisioned manually
  // via the Supabase dashboard.
  return null;
}
