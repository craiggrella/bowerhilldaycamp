import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendDetailedConfirmationEmail, notifyAdmin, type DetailedCamper, type DetailedEmergencyContact } from "@/lib/email";

type Body = {
  liability_waiver: boolean;
  photo_release: boolean;
  authorized_pickup_persons: string;
  signed_by: string;
};

type CamperRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  grade: string | null;
  afternoon_opt_out: boolean;
  camp_types: { name: string } | { name: string }[] | null;
};

type GuardianRow = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

type JunctionRow = {
  camper_id: string;
  emergency_contacts:
    | { first_name: string; last_name: string; phone: string; relationship: string }
    | { first_name: string; last_name: string; phone: string; relationship: string }[]
    | null;
};

type LegacyEcRow = {
  first_name: string;
  last_name: string;
  phone: string;
  relationship: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as Body;

  const { error } = await supabaseAdmin.from("consents").insert({
    registration_id: id,
    liability_waiver: body.liability_waiver,
    photo_release: body.photo_release,
    authorized_pickup_persons: body.authorized_pickup_persons,
    signed_by: body.signed_by,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send the detailed confirmation email. Failure must not fail the consent save.
  // One admin alert per failure.
  try {
    await sendDetailedEmail(id);
  } catch (e) {
    console.error("Detailed confirmation email failed:", e);
    await notifyAdmin("Detailed confirmation email failed", {
      registrationId: id,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  return NextResponse.json({ ok: true });
}

async function sendDetailedEmail(registrationId: string) {
  const camperRes = await supabaseAdmin
    .from("campers")
    .select("id, first_name, last_name, grade, afternoon_opt_out, camp_types(name)")
    .eq("registration_id", registrationId);
  if (camperRes.error) throw camperRes.error;

  const campers = (camperRes.data ?? []) as CamperRow[];
  const camperIds = campers.map((c) => c.id);

  const [guardianRes, junctionRes, legacyEcRes, medicalRes] = await Promise.all([
    supabaseAdmin
      .from("guardians")
      .select("first_name, last_name, email, phone, address_line1, city, state, zip")
      .eq("registration_id", registrationId)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
    camperIds.length
      ? supabaseAdmin
          .from("camper_emergency_contacts")
          .select("camper_id, emergency_contacts(first_name, last_name, phone, relationship)")
          .in("camper_id", camperIds)
      : Promise.resolve({ data: [] as JunctionRow[], error: null }),
    supabaseAdmin
      .from("emergency_contacts")
      .select("first_name, last_name, phone, relationship")
      .eq("registration_id", registrationId),
    camperIds.length
      ? supabaseAdmin
          .from("medical_info")
          .select("camper_id, allergies, medications, special_needs")
          .in("camper_id", camperIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const guardian = guardianRes.data as GuardianRow | null;
  if (!guardian || !guardian.email) {
    console.warn("No guardian email on file for registration", registrationId, "— skipping detailed email");
    return;
  }

  // Build emergency contacts — prefer junction table; fall back to legacy.
  const seen = new Set<string>();
  const contacts: DetailedEmergencyContact[] = [];
  for (const j of (junctionRes.data ?? []) as JunctionRow[]) {
    const ec = j.emergency_contacts;
    if (!ec) continue;
    const list = Array.isArray(ec) ? ec : [ec];
    for (const c of list) {
      const key = `${c.first_name}|${c.last_name}|${c.phone}`;
      if (seen.has(key)) continue;
      seen.add(key);
      contacts.push({
        name: `${c.first_name} ${c.last_name}`.trim(),
        relationship: c.relationship,
        phone: c.phone,
      });
    }
  }
  if (contacts.length === 0) {
    for (const c of (legacyEcRes.data ?? []) as LegacyEcRow[]) {
      contacts.push({
        name: `${c.first_name} ${c.last_name}`.trim(),
        relationship: c.relationship,
        phone: c.phone,
      });
    }
  }

  // Build medical map.
  const medMap: Record<string, { allergies: string | null; notes: string | null }> = {};
  for (const m of (medicalRes.data ?? []) as { camper_id: string; allergies: string | null; medications: string | null; special_needs: string | null }[]) {
    const notes = [m.medications, m.special_needs].filter(Boolean).join("; ");
    medMap[m.camper_id] = { allergies: m.allergies, notes: notes || null };
  }

  const detailedCampers: DetailedCamper[] = campers.map((c) => {
    const campName = Array.isArray(c.camp_types) ? (c.camp_types[0]?.name ?? "") : (c.camp_types?.name ?? "");
    const med = medMap[c.id];
    return {
      firstName: c.first_name,
      lastName: c.last_name ?? "",
      grade: c.grade ?? "",
      campName,
      afternoonOptOut: c.afternoon_opt_out,
      allergies: med?.allergies ?? null,
      medicalNotes: med?.notes ?? null,
    };
  });

  const addressParts = [guardian.address_line1, guardian.city, guardian.state, guardian.zip].filter(Boolean);
  const address = addressParts.join(", ");

  await sendDetailedConfirmationEmail({
    to: guardian.email,
    guardian: {
      firstName: guardian.first_name,
      lastName: guardian.last_name,
      email: guardian.email,
      phone: guardian.phone,
      address,
    },
    campers: detailedCampers,
    emergencyContacts: contacts,
  });
}
