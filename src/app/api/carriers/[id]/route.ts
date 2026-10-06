import { NextResponse } from "next/server";
import { getPublicCarrierProfile } from "@/lib/marketplace";

/** Public, read-only carrier information used by customers when comparing offers. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const profile = await getPublicCarrierProfile(id);
    if (!profile) return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Unable to load public carrier profile", error);
    return NextResponse.json({ error: "Unable to load carrier profile" }, { status: 500 });
  }
}
