import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedUser } from "@/lib/request-auth";
import { createTransportRequest, listTransportRequests } from "@/lib/transports";

const locationSchema = z.object({
  formatted: z.string().trim().min(1).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const createSchema = z.object({
  category: z.string().trim().min(1).max(100),
  itemName: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  lengthCm: z.number().positive().max(100_000),
  widthCm: z.number().positive().max(100_000),
  weightKg: z.number().positive().max(100_000),
  pickup: locationSchema,
  delivery: locationSchema,
  timing: z.string().trim().min(1).max(100),
  preferredDateFrom: z.string().date().nullable(),
  preferredDateTo: z.string().date().nullable(),
}).refine(input => !input.preferredDateFrom || !input.preferredDateTo || input.preferredDateTo >= input.preferredDateFrom, {
  message: "End date must be on or after start date",
  path: ["preferredDateTo"],
});

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "requester") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requestedFilter = new URL(request.url).searchParams.get("status");
  const filter = requestedFilter === "completed" ? "completed" : requestedFilter === "all" ? "all" : "active";
  try {
    return NextResponse.json({ transports: await listTransportRequests(user.id, filter) });
  } catch {
    return NextResponse.json({ error: "Unable to load transports" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "requester") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid transport request" }, { status: 400 });
  try {
    return NextResponse.json({ transport: await createTransportRequest(user.id, parsed.data) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to publish transport" }, { status: 500 });
  }
}
