import { NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/request-auth";
import { createRealtimeTokenRequest, isRealtimeConfigured } from "@/lib/realtime";

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isRealtimeConfigured()) return NextResponse.json({ error: "Realtime is not configured" }, { status: 503 });
  try {
    const tokenRequest = await createRealtimeTokenRequest(user);
    return tokenRequest
      ? NextResponse.json(tokenRequest)
      : NextResponse.json({ error: "Realtime is not configured" }, { status: 503 });
  } catch (error) {
    console.error("Unable to create Ably token", error);
    return NextResponse.json({ error: "Realtime is unavailable" }, { status: 503 });
  }
}
