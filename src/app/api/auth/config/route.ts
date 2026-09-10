import { NextResponse } from "next/server";
import { optionalEnv } from "@/lib/config";

export function GET() {
  const clientId = optionalEnv("GOOGLE_CLIENT_ID");
  return NextResponse.json({ google: { enabled: Boolean(clientId), clientId: clientId ?? null } });
}
