import { NextResponse } from "next/server";
import { hasPendingNotificationPrompt, markNotificationPromptShown } from "@/lib/database";
import { authenticatedUser } from "@/lib/request-auth";

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ shouldPrompt: await hasPendingNotificationPrompt(user.id) });
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await markNotificationPromptShown(user.id);
  return NextResponse.json({ ok: true });
}
