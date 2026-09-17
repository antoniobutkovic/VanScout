import { optionalEnv } from "@/lib/config";
import type { AddressLocation } from "@/lib/location";
import { NextRequest, NextResponse } from "next/server";

type GeoapifyResult = {
  formatted?: unknown;
  lat?: unknown;
  lon?: unknown;
  address_line1?: unknown;
  address_line2?: unknown;
  city?: unknown;
  postcode?: unknown;
  country_code?: unknown;
  place_id?: unknown;
};

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toAddressLocation(result: GeoapifyResult): AddressLocation | null {
  const formatted = stringValue(result.formatted);
  const latitude = numberValue(result.lat);
  const longitude = numberValue(result.lon);
  if (!formatted || latitude === undefined || longitude === undefined) return null;

  return {
    formatted,
    latitude,
    longitude,
    addressLine1: stringValue(result.address_line1),
    addressLine2: stringValue(result.address_line2),
    city: stringValue(result.city),
    postcode: stringValue(result.postcode),
    countryCode: stringValue(result.country_code),
    placeId: stringValue(result.place_id),
  };
}

function validCoordinate(value: string | null, min: number, max: number): number | null {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max ? coordinate : null;
}

export async function GET(request: NextRequest) {
  const latitude = validCoordinate(request.nextUrl.searchParams.get("lat"), -90, 90);
  const longitude = validCoordinate(request.nextUrl.searchParams.get("lon"), -180, 180);
  if (latitude === null || longitude === null) return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });

  const apiKey = optionalEnv("GEOAPIFY_API_KEY");
  if (!apiKey) return NextResponse.json({ error: "Location search is not configured" }, { status: 503 });

  const url = new URL("https://api.geoapify.com/v1/geocode/reverse");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("format", "json");
  url.searchParams.set("apiKey", apiKey);

  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return NextResponse.json({ error: "Unable to identify this location" }, { status: 502 });
    const payload = await response.json() as { results?: GeoapifyResult[] };
    const location = payload.results?.map(toAddressLocation).find((result): result is AddressLocation => Boolean(result));
    if (!location) return NextResponse.json({ error: "Unable to identify this location" }, { status: 404 });
    return NextResponse.json({ location });
  } catch {
    return NextResponse.json({ error: "Unable to identify this location" }, { status: 502 });
  }
}
