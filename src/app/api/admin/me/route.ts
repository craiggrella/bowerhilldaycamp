import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";

// Returns the signed-in admin's id, email, and role.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (user.app_metadata as { role?: string } | undefined)?.role ?? "staff";
  return NextResponse.json({
    user: { id: user.id, email: user.email, role },
  });
}
