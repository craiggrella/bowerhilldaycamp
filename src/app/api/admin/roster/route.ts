import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const campersRes = await supabaseAdmin
    .from("campers")
    .select("id, first_name, last_name, grade, afternoon_opt_out, first_year, pairing_notes, registration_id, camp_types(name)")
    .order("last_name")
    .order("first_name");

  if (campersRes.error) return NextResponse.json({ error: campersRes.error.message }, { status: 500 });
  const campers = campersRes.data || [];

  const regIds = [...new Set(campers.map((c) => c.registration_id))];
  const camperIds = campers.map((c) => c.id);

  const [guardiansRes, junctionsRes, legacyRes, medicalRes] = await Promise.all([
    regIds.length
      ? supabaseAdmin.from("guardians").select("registration_id, first_name, last_name, phone, email").in("registration_id", regIds)
      : Promise.resolve({ data: [] }),
    camperIds.length
      ? supabaseAdmin.from("camper_emergency_contacts").select("camper_id, emergency_contacts(first_name, last_name, phone, relationship)").in("camper_id", camperIds)
      : Promise.resolve({ data: [] }),
    regIds.length
      ? supabaseAdmin.from("emergency_contacts").select("registration_id, first_name, last_name, phone, relationship").in("registration_id", regIds)
      : Promise.resolve({ data: [] }),
    camperIds.length
      ? supabaseAdmin.from("medical_info").select("camper_id, allergies, medications, special_needs").in("camper_id", camperIds)
      : Promise.resolve({ data: [] }),
  ]);

  return NextResponse.json({
    campers,
    guardians: guardiansRes.data ?? [],
    junctions: junctionsRes.data ?? [],
    legacyContacts: legacyRes.data ?? [],
    medical: medicalRes.data ?? [],
  });
}
