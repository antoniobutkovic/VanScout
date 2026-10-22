import { NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/request-auth";
import { webPushPublicKey } from "@/lib/push";

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const publicKey = webPushPublicKey();
  return NextResponse.json({ enabled: Boolean(publicKey), publicKey });
}
