import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type CamperPayload = {
  campTypeId: string | null;
  firstName: string;
  lastName: string;
  grade: string;
  afternoonOptOut: boolean;
};

type Body = {
  amountCents: number;
  stripePaymentId: string;
  stripeStatus: string;
  campers: CamperPayload[];
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;

  if (!body.stripePaymentId || !Array.isArray(body.campers) || body.campers.length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Idempotency: if this payment intent already produced a registration, return it.
  const { data: existing } = await supabaseAdmin
    .from("registrations")
    .select("id")
    .eq("stripe_payment_id", body.stripePaymentId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ registrationId: existing.id });
  }

  const { data: reg, error: regError } = await supabaseAdmin
    .from("registrations")
    .insert({
      amount_cents: body.amountCents,
      status: "paid",
      stripe_payment_id: body.stripePaymentId,
      stripe_payment_status: body.stripeStatus,
    })
    .select()
    .single();

  if (regError || !reg) {
    return NextResponse.json({ error: regError?.message || "Could not create registration" }, { status: 500 });
  }

  const camperRows = body.campers.map((c) => ({
    registration_id: reg.id,
    camp_type_id: c.campTypeId,
    first_name: c.firstName,
    last_name: c.lastName,
    grade: c.grade,
    afternoon_opt_out: c.afternoonOptOut,
  }));

  const { error: camperError } = await supabaseAdmin.from("campers").insert(camperRows);
  if (camperError) {
    return NextResponse.json({ error: camperError.message }, { status: 500 });
  }

  return NextResponse.json({ registrationId: reg.id });
}
