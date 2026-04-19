import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/require-admin";
import { sendConfirmationEmail } from "@/lib/email";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_req: NextRequest, context: RouteContext) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Missing registration id" }, { status: 400 });

  const { data: reg, error: regErr } = await supabaseAdmin
    .from("registrations")
    .select("id, amount_cents, stripe_payment_id")
    .eq("id", id)
    .maybeSingle();
  if (regErr || !reg) {
    return NextResponse.json({ error: regErr?.message || "Registration not found" }, { status: 404 });
  }

  const [guardianRes, campersRes, medicalRes, junctionsRes, legacyRes, campTypesRes] = await Promise.all([
    supabaseAdmin.from("guardians").select("*").eq("registration_id", id).maybeSingle(),
    supabaseAdmin.from("campers").select("*").eq("registration_id", id),
    supabaseAdmin.from("medical_info").select("camper_id, allergies").in(
      "camper_id",
      [], // placeholder; filled below once we have camper ids
    ).limit(0),
    supabaseAdmin
      .from("camper_emergency_contacts")
      .select("camper_id, emergency_contacts(first_name, last_name, phone, relationship)"),
    supabaseAdmin
      .from("emergency_contacts")
      .select("registration_id, first_name, last_name, phone, relationship")
      .eq("registration_id", id),
    supabaseAdmin.from("camp_types").select("id, name"),
  ]);

  const guardian = guardianRes.data;
  const campers = campersRes.data || [];

  if (!guardian) {
    return NextResponse.json({ error: "No guardian on this registration" }, { status: 400 });
  }

  const camperIds = campers.map((c) => c.id);
  let medicalByCamper: Record<string, string> = {};
  if (camperIds.length) {
    const { data: medRows } = await supabaseAdmin
      .from("medical_info")
      .select("camper_id, allergies")
      .in("camper_id", camperIds);
    medicalByCamper = Object.fromEntries((medRows || []).map((m) => [m.camper_id, m.allergies || ""]));
  }
  void medicalRes; // unused placeholder (kept to keep the parallel block readable)

  // Emergency contacts — prefer junction-based contacts tied to this registration's campers.
  type EcShape = { first_name: string; last_name: string; phone: string; relationship: string };
  const ecByCamperJunction: Record<string, EcShape[]> = {};
  for (const row of (junctionsRes.data || []) as Array<{ camper_id: string; emergency_contacts: EcShape | EcShape[] | null }>) {
    if (!camperIds.includes(row.camper_id)) continue;
    const ec = row.emergency_contacts;
    if (!ec) continue;
    const list = Array.isArray(ec) ? ec : [ec];
    if (!ecByCamperJunction[row.camper_id]) ecByCamperJunction[row.camper_id] = [];
    for (const e of list) ecByCamperJunction[row.camper_id].push(e);
  }

  const junctionUnique = new Map<string, EcShape>();
  for (const list of Object.values(ecByCamperJunction)) {
    for (const e of list) {
      const key = `${e.first_name}|${e.last_name}|${e.phone}`;
      if (!junctionUnique.has(key)) junctionUnique.set(key, e);
    }
  }

  const legacyContacts = (legacyRes.data || []) as EcShape[];
  const emergencyContacts = junctionUnique.size > 0 ? Array.from(junctionUnique.values()) : legacyContacts;

  const campNameById = new Map<string, string>(
    ((campTypesRes.data || []) as Array<{ id: string; name: string }>).map((ct) => [ct.id, ct.name]),
  );

  try {
    const ok = await sendConfirmationEmail({
      to: guardian.email,
      totalCents: reg.amount_cents || 0,
      stripePaymentId: reg.stripe_payment_id || "",
      guardian: {
        firstName: guardian.first_name,
        lastName: guardian.last_name,
        email: guardian.email,
        phone: guardian.phone,
        address: [guardian.address_line1, guardian.city, guardian.state, guardian.zip]
          .filter(Boolean)
          .join(", "),
      },
      campers: campers.map((c) => ({
        firstName: c.first_name,
        lastName: c.last_name,
        grade: c.grade,
        age: c.age,
        campName: c.camp_type_id ? (campNameById.get(c.camp_type_id) ?? "") : "",
        afternoonOptOut: !!c.afternoon_opt_out,
        allergies: medicalByCamper[c.id] || "",
        firstYear: !!c.first_year,
        priceCents: 0, // not stored per-camper; totalCents on the registration covers this
      })),
      emergencyContacts: emergencyContacts.map((e) => ({
        name: `${e.first_name} ${e.last_name}`.trim(),
        relationship: e.relationship,
        phone: e.phone,
      })),
    });
    if (!ok) {
      return NextResponse.json({ error: "Email provider returned non-200" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, to: guardian.email });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
