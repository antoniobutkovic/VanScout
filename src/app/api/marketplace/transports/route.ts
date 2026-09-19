import { NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/request-auth";
import { listMarketplaceTransports } from "@/lib/marketplace";

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "transporter") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ transports: await listMarketplaceTransports(user.id) });
  } catch (error) {
    console.error("Unable to load transport marketplace", error);
    return NextResponse.json({ error: "Unable to load transports" }, { status: 500 });
  }
}
