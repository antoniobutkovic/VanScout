import { randomUUID } from "node:crypto";
import { ensureDatabaseSchema, sqlClient } from "./database";
import { isStripeConfigured, stripeClient } from "./stripe";
import type { CreditAccount, CreditTransaction } from "./marketplace-types";

function iso(value: unknown) {
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

export async function getCreditAccount(carrierId: string): Promise<CreditAccount> {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  await sql`
    INSERT INTO vanscout_carrier_credit_accounts (carrier_id)
    VALUES (${carrierId})
    ON CONFLICT (carrier_id) DO NOTHING
  `;
  const [accountRows, transactionRows] = await Promise.all([
    sql`SELECT balance_cents FROM vanscout_carrier_credit_accounts WHERE carrier_id = ${carrierId}`,
    sql`
      SELECT id, amount_cents, kind, description, created_at
      FROM vanscout_credit_transactions
      WHERE carrier_id = ${carrierId}
      ORDER BY created_at DESC
      LIMIT 100
    `,
  ]);
  const transactions: CreditTransaction[] = transactionRows.map(raw => {
    const row = raw as Record<string, unknown>;
    return {
      id: String(row.id),
      amountCents: Number(row.amount_cents),
      kind: String(row.kind) as CreditTransaction["kind"],
      description: String(row.description),
      createdAt: iso(row.created_at),
    };
  });
  return {
    balanceCents: Number(accountRows[0]?.balance_cents ?? 0),
    transactions,
    stripeConfigured: isStripeConfigured(),
  };
}

export async function createCreditPurchase(carrierId: string, amountCents: number) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const id = randomUUID();
  await sql`
    INSERT INTO vanscout_carrier_credit_accounts (carrier_id)
    VALUES (${carrierId})
    ON CONFLICT (carrier_id) DO NOTHING
  `;
  await sql`
    INSERT INTO vanscout_credit_purchases (id, carrier_id, amount_cents)
    VALUES (${id}, ${carrierId}, ${amountCents})
  `;
  return id;
}

export async function attachCheckoutSession(purchaseId: string, carrierId: string, sessionId: string) {
  const sql = sqlClient();
  const rows = await sql`
    UPDATE vanscout_credit_purchases
    SET stripe_checkout_session_id = ${sessionId}
    WHERE id = ${purchaseId} AND carrier_id = ${carrierId} AND status = 'pending'
    RETURNING id
  `;
  return Boolean(rows[0]);
}

export async function expireCreditPurchase(purchaseId: string) {
  const sql = sqlClient();
  await sql`
    UPDATE vanscout_credit_purchases SET status = 'expired'
    WHERE id = ${purchaseId} AND status = 'pending'
  `;
}

export async function completeCreditPurchase(input: {
  purchaseId: string;
  sessionId: string;
  paymentIntentId: string | null;
  amountCents: number;
  currency: string;
}) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql.query(`
    WITH paid AS (
      UPDATE vanscout_credit_purchases purchase
      SET status = 'paid', stripe_payment_intent_id = $3, paid_at = NOW()
      WHERE purchase.id = $1 AND purchase.stripe_checkout_session_id = $2
        AND purchase.status = 'pending' AND purchase.amount_cents = $4 AND purchase.currency = $5
      RETURNING purchase.id, purchase.carrier_id, purchase.amount_cents
    ), credited AS (
      UPDATE vanscout_carrier_credit_accounts account
      SET balance_cents = account.balance_cents + paid.amount_cents, updated_at = NOW()
      FROM paid
      WHERE account.carrier_id = paid.carrier_id
      RETURNING account.carrier_id, account.balance_cents, paid.id AS purchase_id, paid.amount_cents
    ), ledger AS (
      INSERT INTO vanscout_credit_transactions
        (id, carrier_id, amount_cents, kind, description, credit_purchase_id)
      SELECT $6, credited.carrier_id, credited.amount_cents, 'purchase', 'Stripe credit purchase', credited.purchase_id
      FROM credited
      RETURNING credit_purchase_id
    )
    SELECT credited.carrier_id, credited.balance_cents
    FROM credited
    JOIN ledger ON ledger.credit_purchase_id = credited.purchase_id
  `, [input.purchaseId, input.sessionId, input.paymentIntentId, input.amountCents, input.currency.toLowerCase(), randomUUID()]);
  return rows[0] ? { carrierId: String(rows[0].carrier_id), balanceCents: Number(rows[0].balance_cents) } : null;
}

/**
 * Reconcile paid Checkout Sessions when a webhook was delayed or could not
 * reach the app (for example, a local URL or an SSO-protected preview URL).
 * The webhook remains the primary path; this is an idempotent safety net for
 * the signed-in carrier returning from Stripe.
 */
export async function reconcilePendingCreditPurchases(carrierId: string) {
  const stripe = stripeClient();
  if (!stripe) return;
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const purchases = await sql`
    SELECT id, amount_cents, currency, stripe_checkout_session_id
    FROM vanscout_credit_purchases
    WHERE carrier_id = ${carrierId}
      AND status = 'pending'
      AND stripe_checkout_session_id IS NOT NULL
    ORDER BY created_at ASC
    LIMIT 20
  `;

  for (const raw of purchases) {
    const purchase = raw as Record<string, unknown>;
    const purchaseId = String(purchase.id);
    const sessionId = String(purchase.stripe_checkout_session_id);
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const sessionPurchaseId = session.metadata?.purchaseId || session.client_reference_id;
      if (
        sessionPurchaseId !== purchaseId
        || session.payment_status !== "paid"
        || session.amount_total !== Number(purchase.amount_cents)
        || session.currency?.toLowerCase() !== String(purchase.currency).toLowerCase()
      ) continue;

      await completeCreditPurchase({
        purchaseId,
        sessionId,
        paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null,
        amountCents: session.amount_total,
        currency: session.currency || "eur",
      });
    } catch (error) {
      // A single unavailable Stripe session must not prevent the balance from
      // loading. Stripe/webhook retries can reconcile it later.
      console.error("Unable to reconcile Stripe credit purchase", { purchaseId, error });
    }
  }
}
