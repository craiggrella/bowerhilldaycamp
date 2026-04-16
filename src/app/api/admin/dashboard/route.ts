import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const [campers, campTypes] = await Promise.all([
    supabaseAdmin
      .from("campers")
      .select(`
        id, first_name, last_name, camp_type_id, registration_id, created_at,
        camp_types (name),
        registrations (status, amount_cents, stripe_payment_id, created_at)
      `)
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("camp_types").select("*"),
  ]);

  if (campers.error) return NextResponse.json({ error: campers.error.message }, { status: 500 });

  const regIds = [...new Set((campers.data || []).map((c) => c.registration_id))];
  const guardiansRes = regIds.length
    ? await supabaseAdmin.from("guardians").select("*").in("registration_id", regIds)
    : { data: [] as { registration_id: string; first_name: string; last_name: string; email: string; phone: string }[] };

  return NextResponse.json({
    campers: campers.data ?? [],
    guardians: guardiansRes.data ?? [],
    campTypes: campTypes.data ?? [],
  });
}
