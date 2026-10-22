import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedUser } from "@/lib/request-auth";
import { createCarrierRide, listCarrierRides } from "@/lib/carrier-rides";

const createSchema = z.object({
  pickup: z.string().trim().min(1).max(500),
  delivery: z.string().trim().min(1).max(500),
  departureDate: z.string().date(),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  capacity: z.string().trim().min(1).max(500),
});

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const mine = new URL(request.url).searchParams.get("mine") === "true";
  if (mine && user.role !== "transporter") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ rides: await listCarrierRides(mine ? user.id : undefined, mine ? undefined : user.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load carrier rides", error);
    return NextResponse.json({ error: "Unable to load carrier rides" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "transporter") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid route, date, time and available space" }, { status: 400 });
  try {
    return NextResponse.json({ ride: await createCarrierRide(user.id, parsed.data) }, { status: 201 });
  } catch (error) {
    console.error("Unable to create carrier ride", error);
    return NextResponse.json({ error: "Unable to create carrier ride" }, { status: 500 });
  }
}
