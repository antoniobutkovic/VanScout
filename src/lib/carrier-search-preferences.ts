import { ensureDatabaseSchema, sqlClient } from "./database";
import type { AddressLocation } from "./location";
import type { TransportRequest } from "./transport-types";

export type CarrierSearchPreferences = {
  distanceKm: number | null;
  pickupArea: AddressLocation | null;
  pickupRadiusKm: number;
  notifyOnMatch: boolean;
};

function toPreferences(row: Record<string, unknown>): CarrierSearchPreferences {
  const latitude = Number(row.pickup_latitude);
  const longitude = Number(row.pickup_longitude);
  const formatted = typeof row.pickup_formatted === "string" ? row.pickup_formatted : "";
  return {
    distanceKm: row.distance_km === null || row.distance_km === undefined ? null : Number(row.distance_km),
    pickupArea: formatted && Number.isFinite(latitude) && Number.isFinite(longitude) ? {
      formatted,
      latitude,
      longitude,
      city: typeof row.pickup_city === "string" || row.pickup_city === null ? row.pickup_city || undefined : undefined,
    } : null,
    pickupRadiusKm: Number(row.pickup_radius_km) || 25,
    notifyOnMatch: row.notify_on_match === true || row.notify_on_match === "true",
  };
}

export async function getCarrierSearchPreferences(carrierId: string): Promise<CarrierSearchPreferences | null> {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql`
    SELECT distance_km, pickup_formatted, pickup_latitude, pickup_longitude, pickup_city, pickup_radius_km, notify_on_match
    FROM vanscout_carrier_search_preferences
    WHERE carrier_id = ${carrierId}
    LIMIT 1
  `;
  return rows[0] ? toPreferences(rows[0] as Record<string, unknown>) : null;
}

export async function saveCarrierSearchPreferences(carrierId: string, preferences: CarrierSearchPreferences) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const pickup = preferences.pickupArea;
  const rows = await sql`
    INSERT INTO vanscout_carrier_search_preferences (
      carrier_id, distance_km, pickup_formatted, pickup_latitude, pickup_longitude, pickup_city, pickup_radius_km, notify_on_match
    ) VALUES (
      ${carrierId}, ${preferences.distanceKm}, ${pickup?.formatted || null}, ${pickup?.latitude ?? null},
      ${pickup?.longitude ?? null}, ${pickup?.city || null}, ${preferences.pickupRadiusKm}, ${preferences.notifyOnMatch}
    )
    ON CONFLICT (carrier_id) DO UPDATE SET
      distance_km = EXCLUDED.distance_km,
      pickup_formatted = EXCLUDED.pickup_formatted,
      pickup_latitude = EXCLUDED.pickup_latitude,
      pickup_longitude = EXCLUDED.pickup_longitude,
      pickup_city = EXCLUDED.pickup_city,
      pickup_radius_km = EXCLUDED.pickup_radius_km,
      notify_on_match = EXCLUDED.notify_on_match,
      updated_at = NOW()
    RETURNING distance_km, pickup_formatted, pickup_latitude, pickup_longitude, pickup_city, pickup_radius_km, notify_on_match
  `;
  return toPreferences(rows[0] as Record<string, unknown>);
}

function distanceBetweenCoordinates(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDifference = radians(to.latitude - from.latitude);
  const longitudeDifference = radians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDifference / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function findCarrierIdsWithMatchingSearchPreferences(transport: TransportRequest) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql`
    SELECT preferences.carrier_id, preferences.distance_km,
      preferences.pickup_latitude, preferences.pickup_longitude, preferences.pickup_radius_km
    FROM vanscout_carrier_search_preferences preferences
    JOIN vanscout_users user_account ON user_account.id = preferences.carrier_id
    WHERE user_account.role = 'transporter'
      AND preferences.notify_on_match = TRUE
      AND (preferences.distance_km IS NOT NULL OR preferences.pickup_latitude IS NOT NULL)
  `;
  return rows.flatMap(row => {
    const maximumDistance = row.distance_km === null ? null : Number(row.distance_km);
    if (maximumDistance !== null && transport.distanceKm > maximumDistance) return [];
    const latitude = row.pickup_latitude === null ? null : Number(row.pickup_latitude);
    const longitude = row.pickup_longitude === null ? null : Number(row.pickup_longitude);
    if (latitude !== null && longitude !== null) {
      const radius = Number(row.pickup_radius_km) || 25;
      if (distanceBetweenCoordinates({ latitude, longitude }, transport.pickup) > radius) return [];
    }
    return [String(row.carrier_id)];
  });
}
