import { NextResponse } from "next/server";
import { completeDueTransports } from "@/lib/marketplace";
import { optionalEnv } from "@/lib/config";

/** Called once a day by the deployment scheduler after the agreed delivery date. */
async function run(request: Request) {
  const secret = optionalEnv("CRON_SECRET");
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await completeDueTransports(new URL(request.url).origin));
  } catch (error) {
    console.error("Unable to complete due transports", error);
    return NextResponse.json({ error: "Unable to complete due transports" }, { status: 500 });
  }
}

export async function GET(request: Request) { return run(request); }
export async function POST(request: Request) { return run(request); }
