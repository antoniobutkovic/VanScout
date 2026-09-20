import { randomUUID } from "node:crypto";
import { ensureDatabaseSchema, sqlClient } from "./database";
import type { CreateTransportRequest, TransportRequest, TransportStatus } from "./transport-types";

function distanceKm(pickupLatitude: number, pickupLongitude: number, deliveryLatitude: number, deliveryLongitude: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(deliveryLatitude - pickupLatitude);
  const longitudeDelta = radians(deliveryLongitude - pickupLongitude);
  const startLatitude = radians(pickupLatitude);
  const endLatitude = radians(deliveryLatitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)) * 10) / 10;
}

export function dateOnly(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export function toTransportRequest(row: Record<string, unknown>): TransportRequest {
  const pickupLatitude = Number(row.pickup_latitude);
  const pickupLongitude = Number(row.pickup_longitude);
  const deliveryLatitude = Number(row.delivery_latitude);
  const deliveryLongitude = Number(row.delivery_longitude);
  return {
    id: String(row.id),
    category: String(row.category),
    itemName: String(row.item_name),
    description: typeof row.description === "string" ? row.description : "",
    lengthCm: Number(row.length_cm),
    widthCm: Number(row.width_cm),
    weightKg: Number(row.weight_kg),
    pickup: { formatted: String(row.pickup_formatted), latitude: pickupLatitude, longitude: pickupLongitude },
    delivery: { formatted: String(row.delivery_formatted), latitude: deliveryLatitude, longitude: deliveryLongitude },
    timing: String(row.timing),
    preferredDateFrom: dateOnly(row.preferred_date),
    preferredDateTo: dateOnly(row.preferred_date_to),
    status: String(row.status) as TransportStatus,
    distanceKm: distanceKm(pickupLatitude, pickupLongitude, deliveryLatitude, deliveryLongitude),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    imageIds: Array.isArray(row.image_ids) ? row.image_ids.map(String) : [],
    hasUnreadOffers: Boolean(row.has_unread_offers),
  };
}

export async function listTransportRequests(requesterId: string, filter: "active" | "completed" | "all") {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const statusFilter = filter === "all" ? "TRUE" : filter === "completed" ? "status = 'completed'" : "status <> 'completed'";
  const rows = await sql.query(`
    SELECT id, category, item_name, description, length_cm, width_cm, weight_kg,
      pickup_formatted, pickup_latitude, pickup_longitude,
      delivery_formatted, delivery_latitude, delivery_longitude,
      timing, preferred_date, preferred_date_to, status, created_at, updated_at,
      COALESCE((SELECT ARRAY_AGG(image.id ORDER BY image.position) FROM vanscout_request_draft_images image WHERE image.transport_request_id = vanscout_transport_requests.id), ARRAY[]::text[]) AS image_ids,
      EXISTS (
        SELECT 1 FROM vanscout_transport_offers unread_offer
        LEFT JOIN vanscout_transport_offer_reads read_state
          ON read_state.transport_request_id = unread_offer.transport_request_id
        WHERE unread_offer.transport_request_id = vanscout_transport_requests.id
          AND unread_offer.updated_at > COALESCE(read_state.read_at, TIMESTAMPTZ 'epoch')
      ) AS has_unread_offers
    FROM vanscout_transport_requests
    WHERE requester_id = $1 AND ${statusFilter}
    ORDER BY created_at DESC
  `, [requesterId]);
  return rows.map(row => toTransportRequest(row as Record<string, unknown>));
}

export async function createTransportRequest(requesterId: string, input: CreateTransportRequest) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql`
    INSERT INTO vanscout_transport_requests (
      id, requester_id, category, item_name, description, length_cm, width_cm, weight_kg,
      pickup_formatted, pickup_latitude, pickup_longitude,
      delivery_formatted, delivery_latitude, delivery_longitude, timing, preferred_date, preferred_date_to
    ) VALUES (
      ${randomUUID()}, ${requesterId}, ${input.category}, ${input.itemName}, ${input.description},
      ${input.lengthCm}, ${input.widthCm}, ${input.weightKg},
      ${input.pickup.formatted}, ${input.pickup.latitude}, ${input.pickup.longitude},
      ${input.delivery.formatted}, ${input.delivery.latitude}, ${input.delivery.longitude},
      ${input.timing}, ${input.preferredDateFrom}, ${input.preferredDateTo}
    )
    RETURNING id, category, item_name, description, length_cm, width_cm, weight_kg,
      pickup_formatted, pickup_latitude, pickup_longitude,
      delivery_formatted, delivery_latitude, delivery_longitude,
      timing, preferred_date, preferred_date_to, status, created_at, updated_at
  `;
  return toTransportRequest(rows[0] as Record<string, unknown>);
}
