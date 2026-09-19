import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedUser } from "@/lib/request-auth";
import { createOrUpdateOffer, listOffersForCustomer } from "@/lib/marketplace";
import { publishRealtimeEvent } from "@/lib/realtime";

const offerSchema = z.object({
  priceCents: z.number().int().positive().max(100_000_000),
  availableDate: z.string().date(),
  message: z.string().trim().max(2000).default(""),
});

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "requester") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  try {
    return NextResponse.json({ offers: await listOffersForCustomer(id, user.id) });
  } catch (error) {
    console.error("Unable to load offers", error);
    return NextResponse.json({ error: "Unable to load offers" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "transporter") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = offerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid price and date" }, { status: 400 });
  const { id } = await context.params;
  try {
    const offer = await createOrUpdateOffer(user, id, parsed.data);
    if (!offer) return NextResponse.json({ error: "This request is no longer available" }, { status: 409 });
    await Promise.all([
      publishRealtimeEvent(`user:${offer.requesterId}`, "conversation-created", { offerId: offer.id }),
      publishRealtimeEvent(`user:${user.id}`, "conversation-created", { offerId: offer.id }),
    ]);
    return NextResponse.json({ offer }, { status: 201 });
  } catch (error) {
    console.error("Unable to save offer", error);
    return NextResponse.json({ error: "Unable to save offer" }, { status: 500 });
  }
}
