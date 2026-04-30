import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireOwner } from "@/lib/require-owner";
import { getCurrentUser } from "@/lib/supabase-server";

type RouteContext = { params: Promise<{ id: string }> };

// DELETE — revoke an admin (owner only; can't revoke self).
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;

  const { id } = await ctx.params;
  const me = await getCurrentUser();
  if (me?.id === id) {
    return NextResponse.json({ error: "Cannot revoke yourself" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// PATCH — change a user's role (owner only). Body: { role: "owner" | "staff" }
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;

  const { id } = await ctx.params;
  const body = (await req.json()) as { role?: string };
  const safeRole = body.role === "owner" ? "owner" : "staff";

  const me = await getCurrentUser();
  if (me?.id === id && safeRole !== "owner") {
    return NextResponse.json({ error: "Cannot demote yourself" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
    app_metadata: { role: safeRole },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, role: safeRole });
}
