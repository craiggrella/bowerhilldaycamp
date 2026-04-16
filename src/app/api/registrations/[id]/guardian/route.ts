import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const { error } = await supabaseAdmin.from("guardians").insert({
    registration_id: id,
    first_name: body.first_name,
    last_name: body.last_name,
    relationship: "Parent/Guardian",
    email: body.email,
    phone: body.phone,
    address_line1: body.address_line1,
    city: body.city,
    state: body.state,
    zip: body.zip,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
