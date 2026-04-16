import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const { amountCents } = await req.json();
  if (!Number.isInteger(amountCents) || amountCents < 50) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    payment_method_types: ["card"],
  });
  return NextResponse.json({
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
  });
}
