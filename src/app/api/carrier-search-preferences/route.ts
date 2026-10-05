import { NextResponse } from "next/server";
import { z } from "zod";
import { getCarrierSearchPreferences, saveCarrierSearchPreferences } from "@/lib/carrier-search-preferences";
import { authenticatedUser } from "@/lib/request-auth";

const locationSchema = z.object({
  formatted: z.string().trim().min(1).max(500),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  city: z.string().trim().min(1).max(150).optional(),
});

const preferencesSchema = z.object({
  distanceKm: z.number().int().min(10).max(10_000).nullable(),
  pickupArea: locationSchema.nullable(),
  pickupRadiusKm: z.number().int().min(5).max(5_000),
});

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "transporter") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ preferences: await getCarrierSearchPreferences(user.id) });
  } catch (error) {
    console.error("Unable to load carrier search preferences", error);
    return NextResponse.json({ error: "Unable to load search preferences" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "transporter") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = preferencesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid search preferences" }, { status: 400 });
  try {
    return NextResponse.json({ preferences: await saveCarrierSearchPreferences(user.id, parsed.data) });
  } catch (error) {
    console.error("Unable to save carrier search preferences", error);
    return NextResponse.json({ error: "Unable to save search preferences" }, { status: 500 });
  }
}
