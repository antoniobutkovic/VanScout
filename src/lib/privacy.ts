import { ensureDatabaseSchema, sqlClient, type AppUser } from "./database";
import { decryptMessage } from "./message-crypto";

function normalizeRow(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]));
}

export async function exportUserData(user: AppUser) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const [accounts, requests, offers, messages, creditPurchases, creditTransactions, profiles] = await Promise.all([
    sql`SELECT id, email, name, first_name, last_name, avatar_url, role, phone_number, email_verified_at, phone_verified_at, created_at, updated_at FROM vanscout_users WHERE id = ${user.id}`,
    sql`SELECT id, category, item_name, description, length_cm, width_cm, weight_kg, pickup_formatted, delivery_formatted, timing, preferred_date, preferred_date_to, status, created_at, updated_at FROM vanscout_transport_requests WHERE requester_id = ${user.id} ORDER BY created_at`,
    sql`
      SELECT offer.id, offer.transport_request_id, offer.carrier_id, offer.price_cents, offer.vat_included,
        offer.available_date, offer.message, offer.status, offer.carrier_agreed_at, offer.confirmed_at,
        offer.commission_cents, offer.created_at, offer.updated_at
      FROM vanscout_transport_offers offer
      JOIN vanscout_transport_requests request ON request.id = offer.transport_request_id
      WHERE offer.carrier_id = ${user.id} OR request.requester_id = ${user.id}
      ORDER BY offer.created_at
    `,
    sql`
      SELECT message.id, message.offer_id, message.sender_id, message.body, message.created_at
      FROM vanscout_messages message
      JOIN vanscout_transport_offers offer ON offer.id = message.offer_id
      JOIN vanscout_transport_requests request ON request.id = offer.transport_request_id
      WHERE offer.carrier_id = ${user.id} OR request.requester_id = ${user.id}
      ORDER BY message.created_at
    `,
    sql`SELECT id, amount_cents, currency, status, stripe_checkout_session_id, stripe_payment_intent_id, created_at, paid_at FROM vanscout_credit_purchases WHERE carrier_id = ${user.id} ORDER BY created_at`,
    sql`SELECT id, amount_cents, kind, description, offer_id, credit_purchase_id, created_at FROM vanscout_credit_transactions WHERE carrier_id = ${user.id} ORDER BY created_at`,
    sql`SELECT company_name, bio, created_at, updated_at FROM vanscout_carrier_profiles WHERE carrier_id = ${user.id}`,
  ]);

  return {
    exportedAt: new Date().toISOString(),
    account: accounts[0] ? normalizeRow(accounts[0] as Record<string, unknown>) : null,
    carrierProfile: profiles[0] ? normalizeRow(profiles[0] as Record<string, unknown>) : null,
    transportRequests: requests.map(row => normalizeRow(row as Record<string, unknown>)),
    offers: offers.map(raw => {
      const row = normalizeRow(raw as Record<string, unknown>);
      return { ...row, message: decryptMessage(String(row.message || "")) };
    }),
    conversations: messages.map(raw => {
      const row = normalizeRow(raw as Record<string, unknown>);
      return { ...row, body: decryptMessage(String(row.body || "")) };
    }),
    creditPurchases: creditPurchases.map(row => normalizeRow(row as Record<string, unknown>)),
    creditTransactions: creditTransactions.map(row => normalizeRow(row as Record<string, unknown>)),
  };
}

export async function eraseUserAccount(userId: string) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql`DELETE FROM vanscout_users WHERE id = ${userId} RETURNING id`;
  return Boolean(rows[0]);
}

export async function enforceRetention() {
  await ensureDatabaseSchema();
  const configuredDays = Number(process.env.MESSAGE_RETENTION_DAYS || "730");
  if (!Number.isInteger(configuredDays) || configuredDays < 30 || configuredDays > 3650) {
    throw new Error("MESSAGE_RETENTION_DAYS must be an integer between 30 and 3650");
  }
  const sql = sqlClient();
  const [messages, offerMessages, verificationCodes, resetTokens] = await Promise.all([
    sql`DELETE FROM vanscout_messages WHERE created_at < NOW() - make_interval(days => ${configuredDays}) RETURNING id`,
    sql`UPDATE vanscout_transport_offers SET message = '' WHERE message <> '' AND updated_at < NOW() - make_interval(days => ${configuredDays}) RETURNING id`,
    sql`DELETE FROM vanscout_email_verifications WHERE expires_at < NOW() RETURNING token_hash`,
    sql`DELETE FROM vanscout_password_resets WHERE expires_at < NOW() RETURNING token_hash`,
  ]);
  return { messageRetentionDays: configuredDays, messagesDeleted: messages.length, offerMessagesCleared: offerMessages.length, verificationCodesDeleted: verificationCodes.length, resetTokensDeleted: resetTokens.length };
}
