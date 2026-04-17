import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendReceiptEmail, notifyAdmin } from "@/lib/email";

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
  contactEmail?: string; // from the Stripe LinkAuthenticationElement
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
    await notifyAdmin("Registration insert failed after successful Stripe payment", {
      stripePaymentId: body.stripePaymentId,
      amountCents: body.amountCents,
      contactEmail: body.contactEmail ?? "(none)",
      campers: body.campers,
      error: regError?.message || "unknown",
    });
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
    await notifyAdmin("Camper insert failed after registration was saved", {
      registrationId: reg.id,
      stripePaymentId: body.stripePaymentId,
      campers: body.campers,
      error: camperError.message,
    });
    return NextResponse.json({ error: camperError.message }, { status: 500 });
  }

  // Fire-and-log the payment receipt email. A failed send must never fail the registration.
  // Exactly one admin alert per failure: either the send returns false (ESP non-200) OR it throws.
  if (body.contactEmail) {
    let sent = false;
    let thrown: unknown = null;
    try {
      const { data: campTypes } = await supabaseAdmin.from("camp_types").select("id, name");
      const nameById = new Map<string, string>((campTypes ?? []).map((ct) => [ct.id as string, ct.name as string]));
      sent = await sendReceiptEmail({
        to: body.contactEmail,
        totalCents: body.amountCents,
        stripePaymentId: body.stripePaymentId,
        campers: body.campers.map((c) => ({
          firstName: c.firstName,
          lastName: c.lastName,
          grade: c.grade,
          campName: c.campTypeId ? (nameById.get(c.campTypeId) ?? "") : "",
          afternoonOptOut: c.afternoonOptOut,
        })),
      });
    } catch (e) {
      console.error("Receipt email failed:", e);
      thrown = e;
    }
    if (!sent) {
      await notifyAdmin("Receipt email failed", {
        registrationId: reg.id,
        contactEmail: body.contactEmail,
        stripePaymentId: body.stripePaymentId,
        error: thrown ? (thrown instanceof Error ? thrown.message : String(thrown)) : "ESP returned non-200 (see server logs)",
      });
    }
  }

  return NextResponse.json({ registrationId: reg.id });
}
