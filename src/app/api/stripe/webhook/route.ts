import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { completeCreditPurchase, recordCreditPurchaseInvoice } from "@/lib/credits";
import { optionalEnv } from "@/lib/config";
import { stripeClient } from "@/lib/stripe";
import { finalizeReadyOffersForCarrier, listTransportDealTargets } from "@/lib/marketplace";
import { publishRealtimeEvent } from "@/lib/realtime";

function paymentIntentId(session: Stripe.Checkout.Session) {
  return typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null;
}

function invoiceId(session: Stripe.Checkout.Session) {
  return typeof session.invoice === "string" ? session.invoice : session.invoice?.id || null;
}

async function recordInvoice(stripe: NonNullable<ReturnType<typeof stripeClient>>, purchaseId: string, session: Stripe.Checkout.Session) {
  const id = invoiceId(session);
  if (!id) return;
  try {
    const invoice = await stripe.invoices.retrieve(id);
    await recordCreditPurchaseInvoice({
      purchaseId,
      invoiceId: invoice.id,
      hostedInvoiceUrl: invoice.hosted_invoice_url || null,
      invoicePdfUrl: invoice.invoice_pdf || null,
    });
  } catch (error) {
    // Invoice generation is owned by Stripe. Do not withhold already paid
    // credits if its optional document URLs are briefly unavailable.
    console.error("Unable to record Stripe invoice", { purchaseId, error });
  }
}

export async function POST(request: Request) {
  const stripe = stripeClient();
  const webhookSecret = optionalEnv("STRIPE_WEBHOOK_SECRET");
  const signature = request.headers.get("stripe-signature");
  if (!stripe || !webhookSecret || !signature) return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch (error) {
    console.error("Invalid Stripe webhook signature", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    const purchaseId = session.metadata?.purchaseId || session.client_reference_id;
    if (purchaseId && session.payment_status === "paid" && session.amount_total && session.currency) {
      const completed = await completeCreditPurchase({
        purchaseId,
        sessionId: session.id,
        paymentIntentId: paymentIntentId(session),
        amountCents: session.amount_total,
        currency: session.currency,
        invoiceId: invoiceId(session),
      });
      await recordInvoice(stripe, purchaseId, session);
      if (completed) {
        const finalized = await finalizeReadyOffersForCarrier(completed.carrierId);
        for (const deal of finalized) {
          const targets = await listTransportDealTargets(deal.transportId);
          await Promise.all([
            publishRealtimeEvent(`user:${deal.requesterId}`, "deal-updated", { offerId: deal.offerId }),
            ...targets.flatMap(target => [
              publishRealtimeEvent(`chat:${target.offerId}`, "deal-updated", { offerId: target.offerId }),
              publishRealtimeEvent(`user:${target.carrierId}`, "deal-updated", { offerId: target.offerId }),
            ]),
          ]);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
