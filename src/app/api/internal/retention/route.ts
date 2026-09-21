import { NextResponse } from "next/server";
import { enforceRetention } from "@/lib/privacy";
import { optionalEnv } from "@/lib/config";

export async function GET(request: Request) {
  const expected = optionalEnv("CRON_SECRET");
  if (!expected) return NextResponse.json({ error: "Retention job is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${expected}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await enforceRetention(), { headers: { "Cache-Control": "no-store" } });
}
