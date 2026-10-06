import { randomUUID } from "node:crypto";
import { ensureDatabaseSchema, sqlClient, type AppUser } from "./database";
import { dateOnly, toTransportRequest } from "./transports";
import type { CarrierProfile, ChatMessage, Conversation, MarketplaceTransport, OfferStatus, TransportOffer } from "./marketplace-types";
import { decryptMessage, encryptMessage } from "./message-crypto";
import { hasRestrictedContactDetails, RestrictedContactDetailsError } from "./contact-details";
import type { TransportStatus } from "./transport-types";
import { sendTransportReviewEmail } from "./mailer";
import { optionalEnv } from "./config";
import type { CarrierReview, CarrierVehicle } from "./marketplace-types";

function iso(value: unknown) {
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

function toOffer(row: Record<string, unknown>): TransportOffer {
  return {
    id: String(row.offer_id ?? row.id),
    transportId: String(row.transport_request_id),
    carrierId: String(row.carrier_id),
    carrierName: String(row.carrier_name ?? "Transporter"),
    companyName: typeof row.company_name === "string" ? row.company_name : "",
    completedTransports: Number(row.completed_transports ?? 0),
    priceCents: Number(row.price_cents),
    vatIncluded: row.vat_included === undefined ? true : Boolean(row.vat_included),
    availableDate: dateOnly(row.available_date) || "",
    message: typeof row.message === "string" ? decryptMessage(row.message) : "",
    status: String(row.offer_status ?? row.status) as OfferStatus,
    selectedByCustomer: Boolean(row.selected_by_customer),
    carrierAgreed: Boolean(row.carrier_agreed_at),
    confirmedAt: row.confirmed_at ? iso(row.confirmed_at) : null,
    commissionCents: Number(row.commission_cents ?? 0),
    createdAt: iso(row.offer_created_at ?? row.created_at),
  };
}

const transportColumns = `
  tr.id, tr.category, tr.item_name, tr.description, tr.length_cm, tr.width_cm, tr.weight_kg,
  tr.pickup_formatted, tr.pickup_latitude, tr.pickup_longitude,
  tr.delivery_formatted, tr.delivery_latitude, tr.delivery_longitude,
  tr.timing, tr.preferred_date, tr.preferred_date_to, tr.status, tr.created_at, tr.updated_at,
  COALESCE((SELECT ARRAY_AGG(image.id ORDER BY image.position) FROM vanscout_request_draft_images image WHERE image.transport_request_id = tr.id), ARRAY[]::text[]) AS image_ids
`;

export async function listMarketplaceTransports(carrierId: string, { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {}) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql.query(`
    SELECT ${transportColumns}, requester.name AS requester_name,
      (SELECT COUNT(*)::int FROM vanscout_transport_offers offer_count WHERE offer_count.transport_request_id = tr.id) AS offer_count,
      mine.id AS offer_id, mine.carrier_id, mine.price_cents, mine.vat_included, mine.available_date, mine.message,
      mine.status AS offer_status, mine.carrier_agreed_at, mine.confirmed_at, mine.commission_cents,
      (selection.offer_id = mine.id) AS selected_by_customer, mine.created_at AS offer_created_at,
      carrier.name AS carrier_name, profile.company_name,
      (SELECT COUNT(*)::int
       FROM vanscout_transport_offers won
       JOIN vanscout_transport_requests done ON done.id = won.transport_request_id
       WHERE won.carrier_id = mine.carrier_id AND won.status = 'confirmed' AND done.status = 'completed') AS completed_transports
    FROM vanscout_transport_requests tr
    JOIN vanscout_users requester ON requester.id = tr.requester_id
    LEFT JOIN vanscout_transport_offers mine ON mine.transport_request_id = tr.id AND mine.carrier_id = $1
    LEFT JOIN vanscout_users carrier ON carrier.id = mine.carrier_id
    LEFT JOIN vanscout_carrier_profiles profile ON profile.carrier_id = mine.carrier_id
    LEFT JOIN vanscout_transport_selections selection ON selection.transport_request_id = tr.id
    WHERE tr.status = 'looking_for_carriers'
    ORDER BY tr.created_at DESC, tr.id DESC
    LIMIT $2 OFFSET $3
  `, [carrierId, limit + 1, offset]);
  const transports = rows.slice(0, limit).map(raw => {
    const row = raw as Record<string, unknown>;
    return {
      ...toTransportRequest(row),
      requesterName: String(row.requester_name),
      offerCount: Number(row.offer_count ?? 0),
      myOffer: row.offer_id ? toOffer(row) : null,
    };
  });
  return { transports, hasMore: rows.length > limit };
}

export async function createOrUpdateOffer(carrier: AppUser, transportId: string, input: { priceCents: number; vatIncluded: boolean; availableDate: string; message: string }): Promise<(TransportOffer & { requesterId: string }) | null> {
  if (hasRestrictedContactDetails(input.message)) throw new RestrictedContactDetailsError();
  await ensureDatabaseSchema();
  await requireCarrierCredits(carrier.id, input.priceCents);
  const sql = sqlClient();
  const encryptedOfferMessage = encryptMessage(input.message);
  const rows = await sql`
    WITH saved AS (
      INSERT INTO vanscout_transport_offers (id, transport_request_id, carrier_id, price_cents, vat_included, available_date, message)
      SELECT ${randomUUID()}, tr.id, ${carrier.id}, ${input.priceCents}, ${input.vatIncluded}, ${input.availableDate}, ${encryptedOfferMessage}
      FROM vanscout_transport_requests tr
      WHERE tr.id = ${transportId} AND tr.status = 'looking_for_carriers' AND tr.requester_id <> ${carrier.id}
      ON CONFLICT (transport_request_id, carrier_id) DO UPDATE SET
        price_cents = EXCLUDED.price_cents,
        vat_included = EXCLUDED.vat_included,
        available_date = EXCLUDED.available_date,
        message = EXCLUDED.message,
        carrier_agreed_at = NULL,
        updated_at = NOW()
      WHERE vanscout_transport_offers.status = 'pending'
      RETURNING id AS offer_id, transport_request_id, carrier_id, price_cents, vat_included, available_date,
        message, status AS offer_status, carrier_agreed_at, confirmed_at, commission_cents,
        created_at AS offer_created_at
    ), cleared_selection AS (
      DELETE FROM vanscout_transport_selections selection
      WHERE selection.offer_id IN (SELECT offer_id FROM saved)
      RETURNING selection.offer_id
    )
    SELECT saved.*, tr.requester_id, FALSE AS selected_by_customer
    FROM saved
    JOIN vanscout_transport_requests tr ON tr.id = saved.transport_request_id
  `;
  if (!rows[0]) return null;
  await sql`
    INSERT INTO vanscout_carrier_credit_accounts (carrier_id)
    VALUES (${carrier.id})
    ON CONFLICT (carrier_id) DO NOTHING
  `;
  return {
    ...toOffer({ ...rows[0], carrier_name: carrier.name, company_name: "", completed_transports: 0 } as Record<string, unknown>),
    requesterId: String(rows[0].requester_id),
  };
}

export async function listOffersForCustomer(transportId: string, requesterId: string) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  await sql`
    INSERT INTO vanscout_transport_offer_reads (transport_request_id, read_at)
    SELECT id, NOW()
    FROM vanscout_transport_requests
    WHERE id = ${transportId} AND requester_id = ${requesterId}
    ON CONFLICT (transport_request_id) DO UPDATE SET read_at = EXCLUDED.read_at
  `;
  const rows = await sql.query(`
    SELECT offer.id AS offer_id, offer.transport_request_id, offer.carrier_id, carrier.name AS carrier_name,
      profile.company_name, offer.price_cents, offer.vat_included, offer.available_date, offer.message,
      offer.status AS offer_status, offer.carrier_agreed_at, offer.confirmed_at,
      CASE WHEN offer.commission_cents > 0 THEN offer.commission_cents ELSE ((offer.price_cents * 5 + 99) / 100) END AS commission_cents,
      (selection.offer_id = offer.id) AS selected_by_customer, offer.created_at AS offer_created_at,
      (SELECT COUNT(*)::int
       FROM vanscout_transport_offers won
       JOIN vanscout_transport_requests done ON done.id = won.transport_request_id
       WHERE won.carrier_id = offer.carrier_id AND won.status = 'confirmed' AND done.status = 'completed') AS completed_transports
    FROM vanscout_transport_offers offer
    JOIN vanscout_transport_requests tr ON tr.id = offer.transport_request_id
    JOIN vanscout_users carrier ON carrier.id = offer.carrier_id
    LEFT JOIN vanscout_carrier_profiles profile ON profile.carrier_id = offer.carrier_id
    LEFT JOIN vanscout_transport_selections selection ON selection.transport_request_id = offer.transport_request_id
    WHERE offer.transport_request_id = $1 AND tr.requester_id = $2
    ORDER BY CASE WHEN selection.offer_id = offer.id THEN 0 WHEN offer.status = 'confirmed' THEN 1 WHEN offer.status = 'pending' THEN 2 ELSE 3 END, offer.created_at DESC
  `, [transportId, requesterId]);
  return rows.map(row => toOffer(row as Record<string, unknown>));
}

export async function listCarrierOffers(carrierId: string, confirmedOnly = false) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql.query(`
    SELECT offer.id AS offer_id, offer.transport_request_id, offer.carrier_id, carrier.name AS carrier_name,
      profile.company_name, offer.price_cents, offer.vat_included, offer.available_date, offer.message,
      offer.status AS offer_status, offer.carrier_agreed_at, offer.confirmed_at,
      CASE WHEN offer.commission_cents > 0 THEN offer.commission_cents ELSE ((offer.price_cents * 5 + 99) / 100) END AS commission_cents,
      (selection.offer_id = offer.id) AS selected_by_customer, offer.created_at AS offer_created_at,
      tr.item_name, tr.pickup_formatted, tr.delivery_formatted, tr.status AS transport_status,
      tr.preferred_date AS preferred_date_from, tr.preferred_date_to, requester.name AS requester_name,
      (SELECT COUNT(*)::int
       FROM vanscout_transport_offers won
       JOIN vanscout_transport_requests done ON done.id = won.transport_request_id
       WHERE won.carrier_id = offer.carrier_id AND won.status = 'confirmed' AND done.status = 'completed') AS completed_transports
    FROM vanscout_transport_offers offer
    JOIN vanscout_transport_requests tr ON tr.id = offer.transport_request_id
    JOIN vanscout_users carrier ON carrier.id = offer.carrier_id
    JOIN vanscout_users requester ON requester.id = tr.requester_id
    LEFT JOIN vanscout_carrier_profiles profile ON profile.carrier_id = offer.carrier_id
    LEFT JOIN vanscout_transport_selections selection ON selection.transport_request_id = offer.transport_request_id
    WHERE offer.carrier_id = $1 ${confirmedOnly ? "AND offer.status = 'confirmed'" : ""}
    ORDER BY offer.updated_at DESC
  `, [carrierId]);
  return rows.map(raw => {
    const row = raw as Record<string, unknown>;
    return {
      ...toOffer(row),
      itemName: String(row.item_name),
      pickup: String(row.pickup_formatted),
      delivery: String(row.delivery_formatted),
      requesterName: String(row.requester_name),
      transportStatus: String(row.transport_status) as TransportStatus,
      preferredDateFrom: dateOnly(row.preferred_date_from),
      preferredDateTo: dateOnly(row.preferred_date_to),
    };
  });
}

export function commissionForPrice(priceCents: number) {
  return Math.ceil(priceCents * 0.05);
}

export class InsufficientCreditsError extends Error {
  constructor(public requiredCents: number, public balanceCents: number) {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
  }
}

async function requireCarrierCredits(carrierId: string, priceCents: number) {
  const sql = sqlClient();
  await sql`
    INSERT INTO vanscout_carrier_credit_accounts (carrier_id)
    VALUES (${carrierId})
    ON CONFLICT (carrier_id) DO NOTHING
  `;
  const rows = await sql`SELECT balance_cents FROM vanscout_carrier_credit_accounts WHERE carrier_id = ${carrierId}`;
  const balanceCents = Number(rows[0]?.balance_cents ?? 0);
  const requiredCents = commissionForPrice(priceCents);
  if (balanceCents < requiredCents) throw new InsufficientCreditsError(requiredCents, balanceCents);
  return { requiredCents, balanceCents };
}

type DealState = {
  offerId: string;
  transportId: string;
  requesterId: string;
  carrierId: string;
  status: OfferStatus;
  selectedByCustomer: boolean;
  carrierAgreed: boolean;
  confirmed: boolean;
  commissionCents: number;
  carrierBalanceCents: number;
  insufficientCredits: boolean;
};

async function getDealState(offerId: string): Promise<DealState | null> {
  const sql = sqlClient();
  const rows = await sql`
    SELECT offer.id AS offer_id, offer.transport_request_id, tr.requester_id, offer.carrier_id,
      offer.status, (selection.offer_id = offer.id) AS selected_by_customer,
      (offer.carrier_agreed_at IS NOT NULL) AS carrier_agreed,
      (offer.confirmed_at IS NOT NULL) AS confirmed,
      CASE WHEN offer.commission_cents > 0 THEN offer.commission_cents ELSE ((offer.price_cents * 5 + 99) / 100) END AS commission_cents,
      COALESCE(account.balance_cents, 0) AS carrier_balance_cents
    FROM vanscout_transport_offers offer
    JOIN vanscout_transport_requests tr ON tr.id = offer.transport_request_id
    LEFT JOIN vanscout_transport_selections selection ON selection.transport_request_id = tr.id
    LEFT JOIN vanscout_carrier_credit_accounts account ON account.carrier_id = offer.carrier_id
    WHERE offer.id = ${offerId}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  const row = rows[0] as Record<string, unknown>;
  const commissionCents = Number(row.commission_cents);
  const carrierBalanceCents = Number(row.carrier_balance_cents);
  const selectedByCustomer = Boolean(row.selected_by_customer);
  const carrierAgreed = Boolean(row.carrier_agreed);
  const confirmed = Boolean(row.confirmed);
  return {
    offerId: String(row.offer_id),
    transportId: String(row.transport_request_id),
    requesterId: String(row.requester_id),
    carrierId: String(row.carrier_id),
    status: String(row.status) as OfferStatus,
    selectedByCustomer,
    carrierAgreed,
    confirmed,
    commissionCents,
    carrierBalanceCents,
    insufficientCredits: selectedByCustomer && carrierAgreed && !confirmed && carrierBalanceCents < commissionCents,
  };
}

async function tryFinalizeOffer(offerId: string) {
  const sql = sqlClient();
  const rows = await sql.query(`
    WITH candidate AS MATERIALIZED (
      SELECT offer.id AS offer_id, offer.transport_request_id, offer.carrier_id,
        ((offer.price_cents * 5 + 99) / 100)::int AS commission_cents
      FROM vanscout_transport_offers offer
      JOIN vanscout_transport_requests tr ON tr.id = offer.transport_request_id
      JOIN vanscout_transport_selections selection
        ON selection.transport_request_id = tr.id AND selection.offer_id = offer.id
      JOIN vanscout_carrier_credit_accounts account ON account.carrier_id = offer.carrier_id
      WHERE offer.id = $1 AND offer.status = 'pending' AND offer.carrier_agreed_at IS NOT NULL
        AND tr.status = 'looking_for_carriers'
        AND account.balance_cents >= ((offer.price_cents * 5 + 99) / 100)::int
      FOR UPDATE OF offer, account
    ), debited AS (
      UPDATE vanscout_carrier_credit_accounts account
      SET balance_cents = account.balance_cents - candidate.commission_cents, updated_at = NOW()
      FROM candidate
      WHERE account.carrier_id = candidate.carrier_id
      RETURNING account.balance_cents, candidate.*
    ), charged AS (
      INSERT INTO vanscout_credit_transactions (id, carrier_id, amount_cents, kind, description, offer_id)
      SELECT $2, debited.carrier_id, -debited.commission_cents, 'commission',
        'Commission for confirmed transport', debited.offer_id
      FROM debited
      RETURNING offer_id
    ), confirmed AS (
      UPDATE vanscout_transport_offers offer
      SET status = 'confirmed', confirmed_at = NOW(), commission_cents = debited.commission_cents, updated_at = NOW()
      FROM debited, charged
      WHERE offer.id = debited.offer_id AND charged.offer_id = offer.id
      RETURNING offer.id, offer.transport_request_id
    ), rejected AS (
      UPDATE vanscout_transport_offers offer
      SET status = 'rejected', updated_at = NOW()
      FROM confirmed
      WHERE offer.transport_request_id = confirmed.transport_request_id AND offer.id <> confirmed.id
      RETURNING offer.id
    ), booked AS (
      UPDATE vanscout_transport_requests tr
      SET status = 'carrier_booked', updated_at = NOW()
      FROM confirmed
      WHERE tr.id = confirmed.transport_request_id
      RETURNING tr.id
    )
    SELECT debited.offer_id, debited.transport_request_id, debited.carrier_id,
      debited.commission_cents, debited.balance_cents
    FROM debited
    JOIN confirmed ON confirmed.id = debited.offer_id
    JOIN booked ON booked.id = debited.transport_request_id
  `, [offerId, randomUUID()]);
  return rows[0] || null;
}

export async function selectOfferForTransport(offerId: string, requesterId: string) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const selected = await sql`
    INSERT INTO vanscout_transport_selections (transport_request_id, offer_id)
    SELECT offer.transport_request_id, offer.id
    FROM vanscout_transport_offers offer
    JOIN vanscout_transport_requests tr ON tr.id = offer.transport_request_id
    WHERE offer.id = ${offerId} AND tr.requester_id = ${requesterId}
      AND tr.status = 'looking_for_carriers' AND offer.status = 'pending'
    ON CONFLICT (transport_request_id) DO UPDATE SET
      offer_id = EXCLUDED.offer_id,
      selected_at = NOW(),
      updated_at = NOW()
    RETURNING offer_id
  `;
  if (!selected[0]) return null;
  await tryFinalizeOffer(offerId);
  return getDealState(offerId);
}

export async function agreeToOffer(offerId: string, carrierId: string) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const available = await sql`
    SELECT offer.price_cents
    FROM vanscout_transport_offers offer
    JOIN vanscout_transport_requests tr ON tr.id = offer.transport_request_id
    WHERE offer.id = ${offerId} AND offer.carrier_id = ${carrierId} AND offer.status = 'pending'
      AND tr.status = 'looking_for_carriers'
    LIMIT 1
  `;
  if (!available[0]) return null;
  await requireCarrierCredits(carrierId, Number(available[0].price_cents));
  const agreed = await sql`
    UPDATE vanscout_transport_offers offer
    SET carrier_agreed_at = COALESCE(offer.carrier_agreed_at, NOW()), updated_at = NOW()
    WHERE offer.id = ${offerId} AND offer.carrier_id = ${carrierId} AND offer.status = 'pending'
      AND offer.transport_request_id IN (
        SELECT id FROM vanscout_transport_requests WHERE status = 'looking_for_carriers'
      )
    RETURNING offer.id
  `;
  if (!agreed[0]) return null;
  await tryFinalizeOffer(offerId);
  return getDealState(offerId);
}

export async function finalizeReadyOffersForCarrier(carrierId: string) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const ready = await sql`
    SELECT offer.id
    FROM vanscout_transport_offers offer
    JOIN vanscout_transport_selections selection ON selection.offer_id = offer.id
    JOIN vanscout_transport_requests tr ON tr.id = offer.transport_request_id
    WHERE offer.carrier_id = ${carrierId} AND offer.status = 'pending'
      AND offer.carrier_agreed_at IS NOT NULL AND tr.status = 'looking_for_carriers'
    ORDER BY offer.carrier_agreed_at ASC
  `;
  const finalized: DealState[] = [];
  for (const row of ready) {
    const offerId = String(row.id);
    await tryFinalizeOffer(offerId);
    const state = await getDealState(offerId);
    if (state?.confirmed) finalized.push(state);
  }
  return finalized;
}

export async function listTransportDealTargets(transportId: string) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql`
    SELECT offer.id AS offer_id, offer.carrier_id
    FROM vanscout_transport_offers offer
    WHERE offer.transport_request_id = ${transportId}
  `;
  return rows.map(row => ({ offerId: String(row.offer_id), carrierId: String(row.carrier_id) }));
}

function toVehicle(row: Record<string, unknown>): CarrierVehicle {
  return {
    id: String(row.id),
    name: String(row.name),
    sizeDescription: String(row.size_description),
  };
}

function toReview(row: Record<string, unknown>): CarrierReview {
  return {
    id: String(row.id),
    rating: Number(row.rating),
    feedback: String(row.feedback || ""),
    customerName: String(row.customer_name),
    createdAt: iso(row.created_at),
  };
}

export async function getPublicCarrierProfile(carrierId: string): Promise<CarrierProfile | null> {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql`
    SELECT carrier.id AS carrier_id, carrier.name AS carrier_name, profile.company_name, profile.bio,
      (SELECT photo.id FROM vanscout_carrier_profile_photos photo WHERE photo.carrier_id = carrier.id) AS profile_image_id,
      COALESCE((SELECT ARRAY_AGG(image.id ORDER BY image.position) FROM vanscout_carrier_profile_images image WHERE image.carrier_id = carrier.id), ARRAY[]::text[]) AS image_ids,
      (SELECT COUNT(*)::int
       FROM vanscout_transport_offers offer
       JOIN vanscout_transport_requests tr ON tr.id = offer.transport_request_id
       WHERE offer.carrier_id = carrier.id AND offer.status = 'confirmed' AND tr.status = 'completed') AS completed_transports,
      COALESCE((SELECT ROUND(SUM(
        6371 * 2 * ASIN(SQRT(
          POWER(SIN(RADIANS((tr.delivery_latitude - tr.pickup_latitude) / 2)), 2)
          + COS(RADIANS(tr.pickup_latitude)) * COS(RADIANS(tr.delivery_latitude))
          * POWER(SIN(RADIANS((tr.delivery_longitude - tr.pickup_longitude) / 2)), 2)
        ))
      ))::int
       FROM vanscout_transport_offers offer
       JOIN vanscout_transport_requests tr ON tr.id = offer.transport_request_id
       WHERE offer.carrier_id = carrier.id AND offer.status = 'confirmed' AND tr.status = 'completed'), 0) AS kilometres_travelled,
      (SELECT ROUND(AVG(review.rating)::numeric, 1) FROM vanscout_carrier_reviews review WHERE review.carrier_id = carrier.id) AS rating_average,
      (SELECT COUNT(*)::int FROM vanscout_carrier_reviews review WHERE review.carrier_id = carrier.id) AS rating_count
    FROM vanscout_users carrier
    LEFT JOIN vanscout_carrier_profiles profile ON profile.carrier_id = carrier.id
    WHERE carrier.id = ${carrierId} AND carrier.role = 'transporter'
  `;
  if (!rows[0]) return null;
  const row = rows[0] as Record<string, unknown>;
  const [vehicles, reviews] = await Promise.all([
    sql`SELECT id, name, size_description FROM vanscout_carrier_vehicles WHERE carrier_id = ${carrierId} ORDER BY created_at ASC`,
    sql`
      SELECT review.id, review.rating, review.feedback, reviewer.first_name AS customer_name, review.created_at
      FROM vanscout_carrier_reviews review
      JOIN vanscout_users reviewer ON reviewer.id = review.requester_id
      WHERE review.carrier_id = ${carrierId}
      ORDER BY review.created_at DESC
      LIMIT 50
    `,
  ]);
  return {
    carrierId: String(row.carrier_id),
    carrierName: String(row.carrier_name),
    companyName: typeof row.company_name === "string" ? row.company_name : "",
    bio: typeof row.bio === "string" ? row.bio : "",
    completedTransports: Number(row.completed_transports ?? 0),
    kilometresTravelled: Number(row.kilometres_travelled ?? 0),
    profileImageId: typeof row.profile_image_id === "string" ? row.profile_image_id : null,
    imageIds: Array.isArray(row.image_ids) ? row.image_ids.map(String) : [],
    ratingAverage: row.rating_average === null || row.rating_average === undefined ? null : Number(row.rating_average),
    ratingCount: Number(row.rating_count ?? 0),
    vehicles: vehicles.map(raw => toVehicle(raw as Record<string, unknown>)),
    reviews: reviews.map(raw => toReview(raw as Record<string, unknown>)),
  };
}

export async function getCarrierProfile(carrier: AppUser): Promise<CarrierProfile> {
  const profile = await getPublicCarrierProfile(carrier.id);
  if (!profile) throw new Error("Carrier profile not found");
  return profile;
}

export async function addCarrierVehicle(carrierId: string, input: Omit<CarrierVehicle, "id">) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql`
    INSERT INTO vanscout_carrier_vehicles (id, carrier_id, name, size_description)
    VALUES (${randomUUID()}, ${carrierId}, ${input.name}, ${input.sizeDescription})
    RETURNING id, name, size_description
  `;
  return toVehicle(rows[0] as Record<string, unknown>);
}

export async function updateCarrierVehicle(carrierId: string, vehicleId: string, input: Omit<CarrierVehicle, "id">) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql`
    UPDATE vanscout_carrier_vehicles
    SET name = ${input.name}, size_description = ${input.sizeDescription}, updated_at = NOW()
    WHERE id = ${vehicleId} AND carrier_id = ${carrierId}
    RETURNING id, name, size_description
  `;
  return rows[0] ? toVehicle(rows[0] as Record<string, unknown>) : null;
}

export async function deleteCarrierVehicle(carrierId: string, vehicleId: string) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql`DELETE FROM vanscout_carrier_vehicles WHERE id = ${vehicleId} AND carrier_id = ${carrierId} RETURNING id`;
  return Boolean(rows[0]);
}

export async function submitCarrierReview(requesterId: string, transportId: string, rating: number, feedback: string) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql`
    INSERT INTO vanscout_carrier_reviews (id, transport_request_id, carrier_id, requester_id, rating, feedback)
    SELECT ${randomUUID()}, tr.id, offer.carrier_id, tr.requester_id, ${rating}, ${feedback}
    FROM vanscout_transport_requests tr
    JOIN vanscout_transport_offers offer ON offer.transport_request_id = tr.id AND offer.status = 'confirmed'
    WHERE tr.id = ${transportId} AND tr.requester_id = ${requesterId} AND tr.status = 'completed'
    ON CONFLICT (transport_request_id) DO NOTHING
    RETURNING id
  `;
  return Boolean(rows[0]);
}

export async function completeDueTransports(appUrl = optionalEnv("APP_URL") || "https://vanscout.hr") {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const completed = await sql`
    UPDATE vanscout_transport_requests tr
    SET status = 'completed', completed_at = COALESCE(completed_at, NOW()), updated_at = NOW()
    FROM vanscout_transport_offers offer
    WHERE offer.transport_request_id = tr.id AND offer.status = 'confirmed'
      AND tr.status = 'carrier_booked' AND offer.available_date < CURRENT_DATE
    RETURNING tr.id, tr.item_name, tr.requester_id, offer.carrier_id
  `;
  const invitations = await sql`
    SELECT tr.id, tr.item_name, requester.email AS requester_email, carrier.name AS carrier_name
    FROM vanscout_transport_requests tr
    JOIN vanscout_transport_offers offer ON offer.transport_request_id = tr.id AND offer.status = 'confirmed'
    JOIN vanscout_users requester ON requester.id = tr.requester_id
    JOIN vanscout_users carrier ON carrier.id = offer.carrier_id
    WHERE tr.status = 'completed' AND tr.review_invitation_sent_at IS NULL AND offer.available_date < CURRENT_DATE
  `;
  let sent = 0;
  for (const raw of invitations) {
    const invitation = raw as Record<string, unknown>;
    const reviewUrl = new URL(`/customer/review/${String(invitation.id)}`, appUrl).toString();
    try {
      await sendTransportReviewEmail({ to: String(invitation.requester_email), transporterName: String(invitation.carrier_name), transportName: String(invitation.item_name), reviewUrl });
      await sql`UPDATE vanscout_transport_requests SET review_invitation_sent_at = NOW() WHERE id = ${String(invitation.id)} AND review_invitation_sent_at IS NULL`;
      sent += 1;
    } catch (error) {
      console.error("Unable to send transport review invitation", error);
    }
  }
  return { completed: completed.length, invitationsSent: sent };
}

export async function updateCarrierProfile(carrier: AppUser, companyName: string, bio: string, gallery: { retainedImageIds: string[]; newImages: File[] } | null, profileImage: File | null) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  await sql`
    INSERT INTO vanscout_carrier_profiles (carrier_id, company_name, bio)
    VALUES (${carrier.id}, ${companyName}, ${bio})
    ON CONFLICT (carrier_id) DO UPDATE SET company_name = EXCLUDED.company_name, bio = EXCLUDED.bio, updated_at = NOW()
  `;
  if (gallery) {
    const retainedRows = gallery.retainedImageIds.length
      ? await sql.query(`
          SELECT id, filename, content_type, image_data
          FROM vanscout_carrier_profile_images
          WHERE carrier_id = $1 AND id = ANY($2::text[])
        `, [carrier.id, gallery.retainedImageIds])
      : [];
    const retainedById = new Map(retainedRows.map(row => [String(row.id), row as Record<string, unknown>]));
    const retained = gallery.retainedImageIds.map(id => retainedById.get(id)).filter((row): row is Record<string, unknown> => Boolean(row));
    await sql`DELETE FROM vanscout_carrier_profile_images WHERE carrier_id = ${carrier.id}`;
    for (let position = 0; position < retained.length; position += 1) {
      const image = retained[position];
      const data = image.image_data;
      await sql`
        INSERT INTO vanscout_carrier_profile_images (id, carrier_id, filename, content_type, image_data, position)
        VALUES (${String(image.id)}, ${carrier.id}, ${String(image.filename)}, ${String(image.content_type)}, ${Buffer.isBuffer(data) ? data : Buffer.from(data as Uint8Array)}, ${position})
      `;
    }
    for (let index = 0; index < gallery.newImages.length; index += 1) {
      const image = gallery.newImages[index];
      const bytes = Buffer.from(await image.arrayBuffer());
      await sql`
        INSERT INTO vanscout_carrier_profile_images (id, carrier_id, filename, content_type, image_data, position)
        VALUES (${randomUUID()}, ${carrier.id}, ${image.name}, ${image.type}, ${bytes}, ${retained.length + index})
      `;
    }
  }
  if (profileImage) {
    const bytes = Buffer.from(await profileImage.arrayBuffer());
    await sql`
      INSERT INTO vanscout_carrier_profile_photos (id, carrier_id, filename, content_type, image_data)
      VALUES (${randomUUID()}, ${carrier.id}, ${profileImage.name}, ${profileImage.type}, ${bytes})
      ON CONFLICT (carrier_id) DO UPDATE SET
        filename = EXCLUDED.filename,
        content_type = EXCLUDED.content_type,
        image_data = EXCLUDED.image_data,
        updated_at = NOW()
    `;
  }
  return getCarrierProfile(carrier);
}

export async function getCarrierProfileImage(imageId: string) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql`
    SELECT content_type, image_data FROM vanscout_carrier_profile_images WHERE id = ${imageId}
    UNION ALL
    SELECT content_type, image_data FROM vanscout_carrier_profile_photos WHERE id = ${imageId}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  const data = rows[0].image_data;
  return { contentType: String(rows[0].content_type), data: Buffer.isBuffer(data) ? data : Buffer.from(data as Uint8Array) };
}

export async function listConversations(user: AppUser): Promise<Conversation[]> {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql.query(`
    SELECT offer.id AS offer_id, tr.id AS transport_id, tr.item_name, offer.price_cents, offer.vat_included,
      offer.available_date, offer.message AS offer_message,
      CASE WHEN $1 = offer.carrier_id THEN requester.name ELSE carrier.name END AS other_party_name,
      CASE WHEN $1 = offer.carrier_id THEN requester.avatar_url ELSE carrier.avatar_url END AS other_party_avatar_url,
      CASE WHEN $1 = offer.carrier_id THEN NULL
           ELSE (SELECT photo.id FROM vanscout_carrier_profile_photos photo WHERE photo.carrier_id = carrier.id) END AS other_party_profile_image_id,
      CASE WHEN offer.confirmed_at IS NOT NULL AND $1 = offer.carrier_id THEN requester.email
           WHEN offer.confirmed_at IS NOT NULL THEN carrier.email ELSE NULL END AS other_party_email,
      CASE WHEN offer.confirmed_at IS NOT NULL AND $1 = offer.carrier_id THEN requester.phone_number
           WHEN offer.confirmed_at IS NOT NULL THEN carrier.phone_number ELSE NULL END AS other_party_phone,
      profile.company_name,
      offer.status AS offer_status, offer.carrier_agreed_at, offer.confirmed_at,
      CASE WHEN offer.commission_cents > 0 THEN offer.commission_cents ELSE ((offer.price_cents * 5 + 99) / 100) END AS commission_cents,
      (selection.offer_id = offer.id) AS selected_by_customer,
      latest.body AS last_message, latest.created_at AS last_message_at,
      EXISTS (
        SELECT 1 FROM vanscout_messages unread
        WHERE unread.offer_id = offer.id AND unread.sender_id <> $1
          AND unread.created_at > COALESCE(read_state.read_at, TIMESTAMPTZ 'epoch')
      ) AS has_unread_messages,
      COALESCE(account.balance_cents, 0) AS carrier_balance_cents
    FROM vanscout_transport_offers offer
    JOIN vanscout_transport_requests tr ON tr.id = offer.transport_request_id
    JOIN vanscout_users requester ON requester.id = tr.requester_id
    JOIN vanscout_users carrier ON carrier.id = offer.carrier_id
    LEFT JOIN vanscout_carrier_profiles profile ON profile.carrier_id = offer.carrier_id
    LEFT JOIN vanscout_carrier_credit_accounts account ON account.carrier_id = offer.carrier_id
    LEFT JOIN vanscout_transport_selections selection ON selection.transport_request_id = tr.id
    LEFT JOIN vanscout_conversation_reads read_state ON read_state.offer_id = offer.id AND read_state.user_id = $1
    LEFT JOIN LATERAL (
      SELECT message.body, message.created_at FROM vanscout_messages message
      WHERE message.offer_id = offer.id ORDER BY message.created_at DESC LIMIT 1
    ) latest ON TRUE
    WHERE ($1 = offer.carrier_id OR $1 = tr.requester_id)
    ORDER BY COALESCE(latest.created_at, offer.updated_at) DESC
  `, [user.id]);
  return rows.map(raw => {
    const row = raw as Record<string, unknown>;
    return {
      offerId: String(row.offer_id),
      transportId: String(row.transport_id),
      itemName: String(row.item_name),
      otherPartyName: String(row.other_party_name),
      otherPartyAvatarUrl: typeof row.other_party_avatar_url === "string" ? row.other_party_avatar_url : null,
      otherPartyProfileImageId: typeof row.other_party_profile_image_id === "string" ? row.other_party_profile_image_id : null,
      companyName: typeof row.company_name === "string" ? row.company_name : "",
      priceCents: Number(row.price_cents),
      vatIncluded: Boolean(row.vat_included),
      availableDate: dateOnly(row.available_date) || "",
      offerMessage: typeof row.offer_message === "string" ? decryptMessage(row.offer_message) : "",
      role: user.role,
      status: String(row.offer_status) as OfferStatus,
      selectedByCustomer: Boolean(row.selected_by_customer),
      carrierAgreed: Boolean(row.carrier_agreed_at),
      confirmedAt: row.confirmed_at ? iso(row.confirmed_at) : null,
      commissionCents: Number(row.commission_cents ?? 0),
      carrierBalanceCents: Number(row.carrier_balance_cents ?? 0),
      otherPartyEmail: typeof row.other_party_email === "string" ? row.other_party_email : null,
      otherPartyPhone: typeof row.other_party_phone === "string" ? row.other_party_phone : null,
      lastMessage: typeof row.last_message === "string" ? decryptMessage(row.last_message) : null,
      lastMessageAt: row.last_message_at ? iso(row.last_message_at) : null,
      hasUnreadMessages: Boolean(row.has_unread_messages),
    };
  });
}

async function canUseConversation(offerId: string, userId: string, requireWritable = false) {
  const sql = sqlClient();
  const rows = requireWritable
    ? await sql`
        SELECT offer.id
        FROM vanscout_transport_offers offer
        JOIN vanscout_transport_requests tr ON tr.id = offer.transport_request_id
        WHERE offer.id = ${offerId} AND offer.status IN ('pending', 'confirmed')
          AND (${userId} = offer.carrier_id OR ${userId} = tr.requester_id)
        LIMIT 1
      `
    : await sql`
        SELECT offer.id
        FROM vanscout_transport_offers offer
        JOIN vanscout_transport_requests tr ON tr.id = offer.transport_request_id
        WHERE offer.id = ${offerId}
          AND (${userId} = offer.carrier_id OR ${userId} = tr.requester_id)
        LIMIT 1
      `;
  return Boolean(rows[0]);
}

export async function listMessages(offerId: string, userId: string): Promise<ChatMessage[] | null> {
  await ensureDatabaseSchema();
  if (!await canUseConversation(offerId, userId)) return null;
  const sql = sqlClient();
  const rows = await sql`
    SELECT message.id, message.sender_id, sender.name AS sender_name, message.body, message.created_at
    FROM vanscout_messages message
    JOIN vanscout_users sender ON sender.id = message.sender_id
    WHERE message.offer_id = ${offerId}
    ORDER BY message.created_at ASC
    LIMIT 500
  `;
  if (rows.length) {
    const readThrough = rows[rows.length - 1].created_at;
    await sql`
      INSERT INTO vanscout_conversation_reads (offer_id, user_id, read_at)
      VALUES (${offerId}, ${userId}, ${readThrough})
      ON CONFLICT (offer_id, user_id) DO UPDATE
      SET read_at = GREATEST(vanscout_conversation_reads.read_at, EXCLUDED.read_at)
    `;
  }
  return rows.map(raw => {
    const row = raw as Record<string, unknown>;
    return { id: String(row.id), senderId: String(row.sender_id), senderName: String(row.sender_name), body: decryptMessage(String(row.body)), createdAt: iso(row.created_at) };
  });
}

export async function sendMessage(offerId: string, senderId: string, body: string) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const access = await sql`
    SELECT offer.carrier_id, tr.requester_id, offer.price_cents, offer.status
    FROM vanscout_transport_offers offer
    JOIN vanscout_transport_requests tr ON tr.id = offer.transport_request_id
    WHERE offer.id = ${offerId} AND offer.status IN ('pending', 'confirmed')
      AND (${senderId} = offer.carrier_id OR ${senderId} = tr.requester_id)
    LIMIT 1
  `;
  if (!access[0]) return null;
  if (String(access[0].status) === "pending" && hasRestrictedContactDetails(body)) {
    throw new RestrictedContactDetailsError();
  }
  if (String(access[0].carrier_id) === senderId && String(access[0].status) === "pending") {
    await requireCarrierCredits(senderId, Number(access[0].price_cents));
  }
  const encryptedBody = encryptMessage(body);
  const rows = await sql`
    INSERT INTO vanscout_messages (id, offer_id, sender_id, body)
    VALUES (${randomUUID()}, ${offerId}, ${senderId}, ${encryptedBody})
    RETURNING id, sender_id, created_at
  `;
  const row = rows[0] as Record<string, unknown>;
  const recipientId = String(access[0].carrier_id) === senderId
    ? String(access[0].requester_id)
    : String(access[0].carrier_id);
  return { id: String(row.id), senderId: String(row.sender_id), recipientId, body, createdAt: iso(row.created_at) };
}
