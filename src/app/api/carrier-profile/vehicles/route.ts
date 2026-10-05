import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedUser } from "@/lib/request-auth";
import { addCarrierVehicle, deleteCarrierVehicle, updateCarrierVehicle } from "@/lib/marketplace";

const vehicleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  sizeDescription: z.string().trim().min(1).max(250),
  completedTransports: z.number().int().min(0).max(1_000_000),
  kilometresTravelled: z.number().int().min(0).max(100_000_000),
});

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "transporter") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = vehicleSchema.omit({ id: true }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the vehicle details" }, { status: 400 });
  try { return NextResponse.json({ vehicle: await addCarrierVehicle(user.id, parsed.data) }, { status: 201 }); }
  catch (error) { console.error("Unable to add vehicle", error); return NextResponse.json({ error: "Unable to add vehicle" }, { status: 500 }); }
}

export async function PUT(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "transporter") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = vehicleSchema.extend({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the vehicle details" }, { status: 400 });
  try {
    const { id, ...input } = parsed.data;
    const vehicle = await updateCarrierVehicle(user.id, id, input);
    if (!vehicle) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    return NextResponse.json({ vehicle });
  } catch (error) { console.error("Unable to update vehicle", error); return NextResponse.json({ error: "Unable to update vehicle" }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "transporter") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Vehicle id is required" }, { status: 400 });
  try {
    if (!await deleteCarrierVehicle(user.id, id)) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (error) { console.error("Unable to delete vehicle", error); return NextResponse.json({ error: "Unable to delete vehicle" }, { status: 500 }); }
}
