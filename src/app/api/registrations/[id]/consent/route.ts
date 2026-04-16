import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Body = {
  liability_waiver: boolean;
  photo_release: boolean;
  authorized_pickup_persons: string;
  signed_by: string;
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
  return NextResponse.json({ ok: true });
}
