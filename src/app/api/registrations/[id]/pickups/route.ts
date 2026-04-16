import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Pickup = {
  name: string;
  phone: string;
  relationship: string;
  camperIds: string[];
};

type Body = {
  pickups: Pickup[];
  sameContactForAll: boolean;
  allCamperIds: string[];
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as Body;

  const validPickups = (body.pickups || []).filter((p) => p.name?.trim());

  for (const p of validPickups) {
    const nameParts = p.name.trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || firstName;

    const { data: contact, error } = await supabaseAdmin
      .from("emergency_contacts")
      .insert({
        registration_id: id,
        first_name: firstName,
        last_name: lastName,
        relationship: p.relationship,
        phone: p.phone,
      })
      .select()
      .single();

    if (error || !contact) {
      return NextResponse.json({ error: error?.message || "Could not save contact" }, { status: 500 });
    }

    const targetCamperIds = body.sameContactForAll ? body.allCamperIds : p.camperIds;
    if (targetCamperIds.length > 0) {
      const { error: linkError } = await supabaseAdmin.from("camper_emergency_contacts").insert(
        targetCamperIds.map((cid) => ({
          camper_id: cid,
          emergency_contact_id: contact.id,
        }))
      );
      if (linkError) {
        return NextResponse.json({ error: linkError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
