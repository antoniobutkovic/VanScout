import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedUser } from "@/lib/request-auth";
import { removePushSubscription, savePushSubscription } from "@/lib/push";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2_000),
  expirationTime: z.number().finite().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1).max(1_000),
    auth: z.string().min(1).max(1_000),
  }),
});

const unsubscribeSchema = z.object({ endpoint: z.string().url().max(2_000) });

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  try {
    await savePushSubscription(user.id, parsed.data);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Unable to save push subscription", error);
    return NextResponse.json({ error: "Unable to save push subscription" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = unsubscribeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  try {
    await removePushSubscription(user.id, parsed.data.endpoint);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Unable to remove push subscription", error);
    return NextResponse.json({ error: "Unable to remove push subscription" }, { status: 500 });
  }
}
