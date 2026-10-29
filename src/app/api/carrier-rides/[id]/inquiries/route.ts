import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedUser } from "@/lib/request-auth";
import { createRideInquiry, listCarrierRideInquiries } from "@/lib/carrier-rides";
import { RestrictedContactDetailsError } from "@/lib/contact-details";
import { publishRealtimeEvent } from "@/lib/realtime";
import { sendPushNotification } from "@/lib/push";

const inquirySchema = z.object({ message: z.string().trim().min(1).max(2000) });

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "transporter") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  try {
    const inquiries = await listCarrierRideInquiries(id, user.id);
    if (!inquiries) return NextResponse.json({ error: "Ride not found" }, { status: 404 });
    return NextResponse.json({ inquiries }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load ride inquiries", error);
    return NextResponse.json({ error: "Unable to load ride inquiries" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "requester") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = inquirySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a message before sending" }, { status: 400 });
  const { id } = await context.params;
  try {
    const inquiry = await createRideInquiry(id, user.id, parsed.data.message);
    if (!inquiry) return NextResponse.json({ error: "This ride is no longer available" }, { status: 409 });
    await Promise.all([
      publishRealtimeEvent(`user:${inquiry.carrierId}`, "conversation-created", { offerId: inquiry.inquiryId }),
      publishRealtimeEvent(`user:${user.id}`, "conversation-created", { offerId: inquiry.inquiryId }),
      sendPushNotification(inquiry.carrierId, {
        title: "VanScout",
        body: "You received a new ride request.",
        url: "/carrier/messages",
        tag: `ride-request-${inquiry.inquiryId}`,
      }),
    ]);
    return NextResponse.json({ inquiry }, { status: 201 });
  } catch (error) {
    if (error instanceof RestrictedContactDetailsError) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error("Unable to create ride inquiry", error);
    return NextResponse.json({ error: "Unable to send ride request" }, { status: 500 });
  }
}
