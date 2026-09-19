import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedUser } from "@/lib/request-auth";
import { attachCheckoutSession, createCreditPurchase, expireCreditPurchase } from "@/lib/credits";
import { optionalEnv } from "@/lib/config";
import { stripeClient } from "@/lib/stripe";

const checkoutSchema = z.object({ amountCents: z.number().int().min(500).max(50_000) });

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "transporter") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose an amount between €5 and €500" }, { status: 400 });
  const stripe = stripeClient();
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured yet" }, { status: 503 });

  const purchaseId = await createCreditPurchase(user.id, parsed.data.amountCents);
  try {
    const appUrl = (optionalEnv("APP_URL") || new URL(request.url).origin).replace(/\/$/, "");
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      client_reference_id: purchaseId,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: parsed.data.amountCents,
          product_data: {
            name: "VanScout credits",
            description: "Credits used for VanScout transport commission fees",
          },
        },
      }],
      metadata: {
        purchaseId,
        carrierId: user.id,
      },
      payment_intent_data: {
        metadata: {
          purchaseId,
          carrierId: user.id,
        },
      },
      success_url: `${appUrl}/carrier/credits?checkout=success`,
      cancel_url: `${appUrl}/carrier/credits?checkout=cancelled`,
    });
    if (!session.url || !await attachCheckoutSession(purchaseId, user.id, session.id)) {
      await expireCreditPurchase(purchaseId);
      return NextResponse.json({ error: "Unable to start checkout" }, { status: 500 });
    }
    return NextResponse.json({ url: session.url });
  } catch (error) {
    await expireCreditPurchase(purchaseId);
    console.error("Unable to create Stripe checkout", error);
    return NextResponse.json({ error: "Unable to start checkout" }, { status: 500 });
  }
}

