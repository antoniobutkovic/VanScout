import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedUser } from "@/lib/request-auth";
import { InsufficientCreditsError, listMessages, sendMessage } from "@/lib/marketplace";
import { publishRealtimeEvent } from "@/lib/realtime";
import { checkRateLimit } from "@/lib/rate-limit";

const messageSchema = z.object({ body: z.string().trim().min(1).max(2000) });

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const messages = await listMessages(id, user.id);
  if (!messages) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ messages, userId: user.id }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const rate = checkRateLimit(request, "send-message", 60, 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many messages. Try again shortly." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = messageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a message" }, { status: 400 });
  const { id } = await context.params;
  try {
    const message = await sendMessage(id, user.id, parsed.data.body);
    if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await publishRealtimeEvent(`chat:${id}`, "message-created", { messageId: message.id });
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "Insufficient credits", requiredCents: error.requiredCents, balanceCents: error.balanceCents }, { status: 402 });
    }
    console.error("Unable to send message", error);
    return NextResponse.json({ error: "Unable to send message" }, { status: 500 });
  }
}
