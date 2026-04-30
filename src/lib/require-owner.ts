import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";

export function isOwner(user: { app_metadata?: Record<string, unknown> } | null | undefined): boolean {
  const role = user?.app_metadata?.role;
  return typeof role === "string" && role === "owner";
}

// Returns null if the current user is an owner; otherwise the appropriate
// error response (401 unauthenticated, 403 not-owner).
export async function requireOwner(): Promise<NextResponse | null> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOwner(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}
