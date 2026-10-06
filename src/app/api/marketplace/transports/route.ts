import { NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/request-auth";
import { listMarketplaceTransports } from "@/lib/marketplace";

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "transporter") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const searchParams = new URL(request.url).searchParams;
    const requestedLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
    const requestedOffset = Number.parseInt(searchParams.get("offset") || "0", 10);
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 20;
    const offset = Number.isInteger(requestedOffset) ? Math.max(requestedOffset, 0) : 0;
    return NextResponse.json(await listMarketplaceTransports(user.id, { limit, offset }));
  } catch (error) {
    console.error("Unable to load transport marketplace", error);
    return NextResponse.json({ error: "Unable to load transports" }, { status: 500 });
  }
}
