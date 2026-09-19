import { NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/request-auth";
import { isRealtimeConfigured } from "@/lib/realtime";

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ enabled: isRealtimeConfigured() });
}
