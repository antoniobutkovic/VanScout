import { NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/request-auth";
import { listCarrierOffers } from "@/lib/marketplace";

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "transporter") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const confirmedOnly = new URL(request.url).searchParams.get("status") === "confirmed";
  try {
    return NextResponse.json({ offers: await listCarrierOffers(user.id, confirmedOnly) });
  } catch (error) {
    console.error("Unable to load carrier offers", error);
    return NextResponse.json({ error: "Unable to load offers" }, { status: 500 });
  }
}
