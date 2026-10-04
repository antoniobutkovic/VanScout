import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedUser } from "@/lib/request-auth";
import { attachCheckoutSession, createCreditPurchase, expireCreditPurchase } from "@/lib/credits";
import { optionalEnv } from "@/lib/config";
import { stripeClient } from "@/lib/stripe";

const checkoutSchema = z.object({
  amountCents: z.number().int().min(500).max(50_000),
  billingRecipient: z.enum(["personal", "company"]).default("personal"),
  companyName: z.string().trim().max(150).optional(),
  companyOib: z.string().trim().max(32).optional(),
}).superRefine((value, context) => {
  if (value.billingRecipient !== "company") return;
  if (!value.companyName) context.addIssue({ code: "custom", path: ["companyName"], message: "Enter the company name" });
  if (!value.companyOib || !isValidCroatianOib(normalizeOib(value.companyOib))) {
    context.addIssue({ code: "custom", path: ["companyOib"], message: "Enter a valid 11-digit Croatian OIB" });
  }
});

function normalizeOib(value: string) {
  return value.replace(/\D/g, "");
}

// Croatian OIB uses ISO 7064 MOD 11,10. This catches input mistakes before a
// tax ID is attached to the Stripe customer and printed on an invoice.
function isValidCroatianOib(value: string) {
  if (!/^\d{11}$/.test(value)) return false;
  let remainder = 10;
  for (const digit of value.slice(0, -1)) {
    remainder = (remainder + Number(digit)) % 10;
    if (remainder === 0) remainder = 10;
    remainder = (remainder * 2) % 11;
  }
  const checkDigit = (11 - remainder) % 10;
  return checkDigit === Number(value.at(-1));
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "transporter") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue?.message || "Choose an amount between €5 and €500" }, { status: 400 });
  }
  const stripe = stripeClient();
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured yet" }, { status: 503 });

  const purchaseId = await createCreditPurchase(user.id, parsed.data.amountCents, parsed.data.billingRecipient);
  try {
    const appUrl = (optionalEnv("APP_URL") || new URL(request.url).origin).replace(/\/$/, "");
    let customerId: string | null = null;
    if (parsed.data.billingRecipient === "company") {
      const customer = await stripe.customers.create({
        email: user.email,
        name: parsed.data.companyName,
        metadata: { carrierId: user.id, purchaseId, billingRecipient: "company" },
      });
      customerId = customer.id;
      await stripe.customers.createTaxId(customer.id, {
        type: "hr_oib",
        value: normalizeOib(parsed.data.companyOib || ""),
      });
    }
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ...(customerId
        ? { customer: customerId, customer_update: { address: "auto", name: "auto" } }
        : { customer_email: user.email, customer_creation: "always" }),
      client_reference_id: purchaseId,
      billing_address_collection: "required",
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
      invoice_creation: {
        enabled: true,
        invoice_data: {
          description: "VanScout credits",
          metadata: { purchaseId, carrierId: user.id, billingRecipient: parsed.data.billingRecipient },
          footer: optionalEnv("STRIPE_INVOICE_FOOTER"),
        },
      },
      automatic_tax: { enabled: optionalEnv("STRIPE_TAX_ENABLED") === "true" },
      success_url: `${appUrl}/carrier/credits?checkout=success`,
      cancel_url: `${appUrl}/carrier/credits?checkout=cancelled`,
    });
    if (!session.url || !await attachCheckoutSession(purchaseId, user.id, session.id, customerId)) {
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
