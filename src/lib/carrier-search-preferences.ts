import { ensureDatabaseSchema, sqlClient } from "./database";
import type { AddressLocation } from "./location";

export type CarrierSearchPreferences = {
  distanceKm: number | null;
  pickupArea: AddressLocation | null;
  pickupRadiusKm: number;
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
  };
}

export async function getCarrierSearchPreferences(carrierId: string): Promise<CarrierSearchPreferences | null> {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql`
    SELECT distance_km, pickup_formatted, pickup_latitude, pickup_longitude, pickup_city, pickup_radius_km
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
      carrier_id, distance_km, pickup_formatted, pickup_latitude, pickup_longitude, pickup_city, pickup_radius_km
    ) VALUES (
      ${carrierId}, ${preferences.distanceKm}, ${pickup?.formatted || null}, ${pickup?.latitude ?? null},
      ${pickup?.longitude ?? null}, ${pickup?.city || null}, ${preferences.pickupRadiusKm}
    )
    ON CONFLICT (carrier_id) DO UPDATE SET
      distance_km = EXCLUDED.distance_km,
      pickup_formatted = EXCLUDED.pickup_formatted,
      pickup_latitude = EXCLUDED.pickup_latitude,
      pickup_longitude = EXCLUDED.pickup_longitude,
      pickup_city = EXCLUDED.pickup_city,
      pickup_radius_km = EXCLUDED.pickup_radius_km,
      updated_at = NOW()
    RETURNING distance_km, pickup_formatted, pickup_latitude, pickup_longitude, pickup_city, pickup_radius_km
  `;
  return toPreferences(rows[0] as Record<string, unknown>);
}
