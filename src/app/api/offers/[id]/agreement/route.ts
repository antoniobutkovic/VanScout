import { NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/request-auth";
import { agreeToOffer, InsufficientCreditsError, listTransportDealTargets, selectOfferForTransport } from "@/lib/marketplace";
import { publishRealtimeEvent } from "@/lib/realtime";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  try {
    const deal = user.role === "requester"
      ? await selectOfferForTransport(id, user.id)
      : await agreeToOffer(id, user.id);
    if (!deal) return NextResponse.json({ error: "This offer can no longer be changed" }, { status: 409 });
    const targets = await listTransportDealTargets(deal.transportId);
    await Promise.all([
      publishRealtimeEvent(`user:${deal.requesterId}`, "deal-updated", { offerId: deal.offerId }),
      ...targets.flatMap(target => [
        publishRealtimeEvent(`chat:${target.offerId}`, "deal-updated", { offerId: target.offerId }),
        publishRealtimeEvent(`user:${target.carrierId}`, "deal-updated", { offerId: target.offerId }),
      ]),
    ]);
    return NextResponse.json({ deal });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "Insufficient credits", requiredCents: error.requiredCents, balanceCents: error.balanceCents }, { status: 402 });
    }
    console.error("Unable to update transport agreement", error);
    return NextResponse.json({ error: "Unable to update agreement" }, { status: 500 });
  }
}
