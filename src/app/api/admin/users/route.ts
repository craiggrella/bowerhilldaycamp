import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/require-admin";
import { requireOwner } from "@/lib/require-owner";
import { getCurrentUser } from "@/lib/supabase-server";
import { sendAdminInvite } from "@/lib/email";

const REDIRECT_TO =
  (process.env.NEXT_PUBLIC_SITE_URL || "https://www.bowerhilldaycamp.com") + "/admin/set-password";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET — any admin can see the list (transparency: staff sees who else has access).
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    users: data.users.map((u) => ({
      id: u.id,
      email: u.email,
      role: (u.app_metadata as { role?: string })?.role ?? "staff",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      invited_pending: !u.last_sign_in_at,
    })),
  });
}

// POST — invite a new admin (owner only). Defaults to "staff".
export async function POST(req: NextRequest) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;

  const body = (await req.json()) as { email?: string; role?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  const safeRole = body.role === "owner" ? "owner" : "staff";

  // Generate the invite link without sending Supabase's email — we send our own.
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo: REDIRECT_TO },
  });
  if (error || !data?.user) {
    return NextResponse.json(
      { error: error?.message || "Could not create invite" },
      { status: 500 },
    );
  }

  // Stamp the role into server-only app_metadata.
  const { error: roleErr } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { role: safeRole },
  });
  if (roleErr) {
    return NextResponse.json({ error: roleErr.message }, { status: 500 });
  }

  // Send the branded invite via our existing transactional pipeline.
  const inviter = await getCurrentUser();
  const sent = await sendAdminInvite({
    to: email,
    inviterEmail: inviter?.email ?? "an admin",
    actionLink: data.properties.action_link,
  });
  if (!sent) {
    return NextResponse.json(
      {
        error:
          "User created, but invite email failed to send. Try revoking and re-inviting.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, userId: data.user.id, role: safeRole });
}
