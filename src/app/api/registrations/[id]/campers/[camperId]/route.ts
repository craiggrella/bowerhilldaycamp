import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Body = {
  last_name: string;
  age: string;
  grade: string;
  allergies_conditions: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; camperId: string }> }
) {
  const { id, camperId } = await params;
  const body = (await req.json()) as Body;

  // Verify the camper belongs to this registration before updating.
  const { data: camper } = await supabaseAdmin
    .from("campers")
    .select("id, registration_id")
    .eq("id", camperId)
    .maybeSingle();
  if (!camper || camper.registration_id !== id) {
    return NextResponse.json({ error: "Camper not found" }, { status: 404 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("campers")
    .update({ last_name: body.last_name, age: body.age, grade: body.grade })
    .eq("id", camperId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: medError } = await supabaseAdmin.from("medical_info").insert({
    camper_id: camperId,
    allergies: body.allergies_conditions,
  });
  if (medError) {
    return NextResponse.json({ error: medError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
