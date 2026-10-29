import { NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/request-auth";
import { agreeToRideInquiry } from "@/lib/carrier-rides";
import { publishRealtimeEvent } from "@/lib/realtime";
import { sendPushNotification } from "@/lib/push";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticatedUser(request);
  if (!user || (user.role !== "requester" && user.role !== "transporter")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  try {
    const deal = await agreeToRideInquiry(id, user.id, user.role);
    if (!deal) return NextResponse.json({ error: "This ride request can no longer be changed" }, { status: 409 });
    const recipientId = user.role === "requester" ? deal.carrierId : deal.requesterId;
    await Promise.all([
      publishRealtimeEvent(`chat:${deal.inquiryId}`, "deal-updated", { offerId: deal.inquiryId }),
      publishRealtimeEvent(`user:${deal.requesterId}`, "deal-updated", { offerId: deal.inquiryId }),
      publishRealtimeEvent(`user:${deal.carrierId}`, "deal-updated", { offerId: deal.inquiryId }),
      sendPushNotification(recipientId, {
        title: "VanScout",
        body: deal.confirmed
          ? "Your transport request is confirmed."
          : user.role === "transporter"
            ? "The transporter accepted your transport request."
            : "The requester is ready to confirm the transport.",
        url: user.role === "requester" ? "/carrier/messages" : "/customer/messages",
        tag: `ride-deal-${deal.inquiryId}`,
      }),
    ]);
    return NextResponse.json({ deal });
  } catch (error) {
    console.error("Unable to update ride agreement", error);
    return NextResponse.json({ error: "Unable to update ride agreement" }, { status: 500 });
  }
}
