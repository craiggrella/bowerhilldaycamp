import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/require-admin";

type Camper = {
  id: string;
  first_name: string;
  last_name: string | null;
  grade: string | null;
  afternoon_opt_out: boolean;
  registration_id: string;
  camp_types: { name: string } | { name: string }[] | null;
};

type Guardian = {
  registration_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
};

type Junction = {
  camper_id: string;
  emergency_contacts:
    | { first_name: string; last_name: string; phone: string; relationship: string }
    | { first_name: string; last_name: string; phone: string; relationship: string }[]
    | null;
};

type Legacy = {
  registration_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  relationship: string;
};

type Medical = {
  camper_id: string;
  allergies: string | null;
  medications: string | null;
  special_needs: string | null;
};

function escapeCSV(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n") || val.includes("\r")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function scheduleFor(campName: string, optOut: boolean): string {
  if (campName === "Jr Day Camp") return "9:30 AM – 12:00 PM";
  if (optOut) return "9:30 AM – 12:00 PM (Morning only)";
  return "9:30 AM – 3:00 PM";
}

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const campersRes = await supabaseAdmin
    .from("campers")
    .select("id, first_name, last_name, grade, afternoon_opt_out, registration_id, camp_types(name)")
    .order("last_name")
    .order("first_name");

  if (campersRes.error) return NextResponse.json({ error: campersRes.error.message }, { status: 500 });
  const campers = (campersRes.data || []) as Camper[];

  const regIds = [...new Set(campers.map((c) => c.registration_id))];
  const camperIds = campers.map((c) => c.id);

  const [guardiansRes, junctionsRes, legacyRes, medicalRes] = await Promise.all([
    regIds.length
      ? supabaseAdmin.from("guardians").select("registration_id, first_name, last_name, phone, email").in("registration_id", regIds)
      : Promise.resolve({ data: [] as Guardian[] }),
    camperIds.length
      ? supabaseAdmin.from("camper_emergency_contacts").select("camper_id, emergency_contacts(first_name, last_name, phone, relationship)").in("camper_id", camperIds)
      : Promise.resolve({ data: [] as Junction[] }),
    regIds.length
      ? supabaseAdmin.from("emergency_contacts").select("registration_id, first_name, last_name, phone, relationship").in("registration_id", regIds)
      : Promise.resolve({ data: [] as Legacy[] }),
    camperIds.length
      ? supabaseAdmin.from("medical_info").select("camper_id, allergies, medications, special_needs").in("camper_id", camperIds)
      : Promise.resolve({ data: [] as Medical[] }),
  ]);

  const guardianMap: Record<string, Guardian> = {};
  for (const g of (guardiansRes.data || []) as Guardian[]) guardianMap[g.registration_id] = g;

  const ecByCamper: Record<string, { first_name: string; last_name: string; phone: string; relationship: string }[]> = {};
  for (const j of (junctionsRes.data || []) as Junction[]) {
    if (!ecByCamper[j.camper_id]) ecByCamper[j.camper_id] = [];
    const ec = j.emergency_contacts;
    if (ec) {
      const list = Array.isArray(ec) ? ec : [ec];
      for (const c of list) ecByCamper[j.camper_id].push(c);
    }
  }

  const legacyByReg: Record<string, Legacy[]> = {};
  for (const ec of (legacyRes.data || []) as Legacy[]) {
    if (!legacyByReg[ec.registration_id]) legacyByReg[ec.registration_id] = [];
    legacyByReg[ec.registration_id].push(ec);
  }

  const medByCamper: Record<string, { allergies: string; notes: string }> = {};
  for (const m of (medicalRes.data || []) as Medical[]) {
    const parts = [m.medications, m.special_needs].filter(Boolean) as string[];
    medByCamper[m.camper_id] = {
      allergies: m.allergies || "",
      notes: parts.join("; "),
    };
  }

  const header = [
    "First Name",
    "Last Name",
    "Grade",
    "Camp",
    "Schedule",
    "Guardian",
    "Guardian Phone",
    "Guardian Email",
    "Emergency Contacts",
    "Medical / Allergies",
  ];

  const rows = campers.map((c) => {
    const campName = Array.isArray(c.camp_types) ? c.camp_types[0]?.name : c.camp_types?.name;
    const g = guardianMap[c.registration_id];
    const contacts = ecByCamper[c.id]?.length ? ecByCamper[c.id] : (legacyByReg[c.registration_id] || []);
    const med = medByCamper[c.id];

    const contactsStr = contacts
      .map((ec) => `${ec.first_name} ${ec.last_name} (${ec.relationship}) ${ec.phone}`.trim())
      .join("; ");

    const medical = [med?.allergies, med?.notes].filter(Boolean).join("; ");

    return [
      c.first_name || "",
      c.last_name || "",
      c.grade || "",
      campName || "",
      scheduleFor(campName || "", c.afternoon_opt_out),
      g ? `${g.first_name} ${g.last_name}` : "",
      g?.phone || "",
      g?.email || "",
      contactsStr,
      medical,
    ];
  });

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => escapeCSV(String(cell))).join(","))
    .join("\r\n");

  const today = new Date().toISOString().slice(0, 10);

  // Prepend UTF-8 BOM so Excel picks up the encoding and handles non-ASCII names.
  return new NextResponse("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bhdc-roster-${today}.csv"`,
    },
  });
}
