import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendConfirmationEmail, notifyAdmin } from "@/lib/email";

type CamperPayload = {
  campTypeId: string | null;
  firstName: string;
  lastName: string;
  grade: string;
  age: string;
  allergies: string;
  afternoonOptOut: boolean;
  firstYear: boolean;
  priceCents: number;
};

type GuardianPayload = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address_line1: string;
  city: string;
  state: string;
  zip: string;
};

type PickupPayload = {
  name: string;
  phone: string;
  relationship: string;
  camperIndexes: number[];
};

type ConsentPayload = {
  liability_waiver: boolean;
  photo_release: boolean;
  signed_by: string;
};

type Body = {
  amountCents: number;
  stripePaymentId: string | null;
  stripeStatus: string;
  campers: CamperPayload[];
  guardian: GuardianPayload;
  pickups: PickupPayload[];
  sameContactForAll: boolean;
  consent: ConsentPayload;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;

  if (!Array.isArray(body.campers) || body.campers.length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  // Paid registrations must have a Stripe id; free registrations (all-first-year) may not.
  if (body.amountCents > 0 && !body.stripePaymentId) {
    return NextResponse.json({ error: "Missing payment id for paid registration" }, { status: 400 });
  }

  // Idempotency: if this payment intent already produced a registration, return it. (paid only)
  if (body.stripePaymentId) {
    const { data: existing } = await supabaseAdmin
      .from("registrations")
      .select("id")
      .eq("stripe_payment_id", body.stripePaymentId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ registrationId: existing.id });
    }
  }

  // 1) Registration row
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
      guardianEmail: body.guardian?.email ?? "(none)",
      error: regError?.message || "unknown",
    });
    return NextResponse.json({ error: regError?.message || "Could not create registration" }, { status: 500 });
  }

  // 2) Campers — insert individually so we can keep the ids in-order for junctions + medical
  const camperIds: string[] = [];
  for (const c of body.campers) {
    const { data: camperRow, error: camperError } = await supabaseAdmin
      .from("campers")
      .insert({
        registration_id: reg.id,
        camp_type_id: c.campTypeId,
        first_name: c.firstName,
        last_name: c.lastName,
        grade: c.grade,
        age: c.age,
        afternoon_opt_out: c.afternoonOptOut,
        first_year: c.firstYear,
      })
      .select()
      .single();

    if (camperError || !camperRow) {
      await notifyAdmin("Camper insert failed after registration was saved", {
        registrationId: reg.id,
        stripePaymentId: body.stripePaymentId,
        camper: c,
        error: camperError?.message || "unknown",
      });
      return NextResponse.json({ error: camperError?.message || "Could not create camper" }, { status: 500 });
    }
    camperIds.push(camperRow.id);
  }

  // 3) Medical info per camper
  const medicalRows = body.campers.map((c, i) => ({
    camper_id: camperIds[i],
    allergies: c.allergies,
  }));
  const { error: medError } = await supabaseAdmin.from("medical_info").insert(medicalRows);
  if (medError) {
    await notifyAdmin("Medical info insert failed", {
      registrationId: reg.id,
      error: medError.message,
    });
    // Non-fatal — registration is saved; continue.
  }

  // 4) Guardian
  const { error: guardianError } = await supabaseAdmin.from("guardians").insert({
    registration_id: reg.id,
    first_name: body.guardian.first_name,
    last_name: body.guardian.last_name,
    relationship: "Parent/Guardian",
    email: body.guardian.email,
    phone: body.guardian.phone,
    address_line1: body.guardian.address_line1,
    city: body.guardian.city,
    state: body.guardian.state,
    zip: body.guardian.zip,
  });
  if (guardianError) {
    await notifyAdmin("Guardian insert failed", {
      registrationId: reg.id,
      error: guardianError.message,
    });
    // Non-fatal.
  }

  // 5) Emergency contacts + junction rows
  const validPickups = body.pickups.filter((p) => p.name?.trim());
  for (const p of validPickups) {
    const nameParts = p.name.trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || firstName;

    const { data: contact, error: contactError } = await supabaseAdmin
      .from("emergency_contacts")
      .insert({
        registration_id: reg.id,
        first_name: firstName,
        last_name: lastName,
        relationship: p.relationship,
        phone: p.phone,
      })
      .select()
      .single();

    if (contactError || !contact) {
      await notifyAdmin("Emergency contact insert failed", {
        registrationId: reg.id,
        error: contactError?.message,
        pickup: p,
      });
      continue;
    }

    const targetIndexes = body.sameContactForAll ? camperIds.map((_, i) => i) : p.camperIndexes;
    const junctionRows = targetIndexes
      .map((idx) => camperIds[idx])
      .filter(Boolean)
      .map((cid) => ({ camper_id: cid, emergency_contact_id: contact.id }));

    if (junctionRows.length > 0) {
      const { error: junctionError } = await supabaseAdmin.from("camper_emergency_contacts").insert(junctionRows);
      if (junctionError) {
        await notifyAdmin("Emergency contact junction insert failed", {
          registrationId: reg.id,
          error: junctionError.message,
        });
      }
    }
  }

  // 6) Consent
  const pickupNames = validPickups.map((p) => p.name.trim()).join(", ");
  const { error: consentError } = await supabaseAdmin.from("consents").insert({
    registration_id: reg.id,
    liability_waiver: body.consent.liability_waiver,
    photo_release: body.consent.photo_release,
    authorized_pickup_persons: pickupNames,
    signed_by: body.consent.signed_by,
  });
  if (consentError) {
    await notifyAdmin("Consent insert failed", {
      registrationId: reg.id,
      error: consentError.message,
    });
  }

  // 7) Fetch camp type names for the email
  const { data: allCampTypes } = await supabaseAdmin.from("camp_types").select("id, name");
  const campNameById = new Map<string, string>((allCampTypes ?? []).map((ct) => [ct.id as string, ct.name as string]));

  // 8) Send ONE combined confirmation + receipt email to the guardian.
  let emailSent = false;
  let emailError: unknown = null;
  try {
    emailSent = await sendConfirmationEmail({
      to: body.guardian.email,
      totalCents: body.amountCents,
      stripePaymentId: body.stripePaymentId ?? "",
      guardian: {
        firstName: body.guardian.first_name,
        lastName: body.guardian.last_name,
        email: body.guardian.email,
        phone: body.guardian.phone,
        address: [body.guardian.address_line1, body.guardian.city, body.guardian.state, body.guardian.zip]
          .filter(Boolean)
          .join(", "),
      },
      campers: body.campers.map((c) => ({
        firstName: c.firstName,
        lastName: c.lastName,
        grade: c.grade,
        age: c.age,
        campName: c.campTypeId ? (campNameById.get(c.campTypeId) ?? "") : "",
        afternoonOptOut: c.afternoonOptOut,
        allergies: c.allergies,
        firstYear: c.firstYear,
        priceCents: c.priceCents,
      })),
      emergencyContacts: validPickups.map((p) => ({
        name: p.name.trim(),
        relationship: p.relationship,
        phone: p.phone,
      })),
    });
  } catch (e) {
    emailError = e;
    console.error("Confirmation email failed:", e);
  }
  if (!emailSent) {
    await notifyAdmin("Confirmation email failed", {
      registrationId: reg.id,
      guardianEmail: body.guardian.email,
      stripePaymentId: body.stripePaymentId,
      error: emailError
        ? emailError instanceof Error
          ? emailError.message
          : String(emailError)
        : "ESP returned non-200 (see server logs)",
    });
  }

  return NextResponse.json({ registrationId: reg.id });
}
