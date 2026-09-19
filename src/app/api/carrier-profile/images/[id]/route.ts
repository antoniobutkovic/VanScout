import { NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/request-auth";
import { getCarrierProfileImage } from "@/lib/marketplace";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await authenticatedUser(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const image = await getCarrierProfileImage(id);
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: { "Content-Type": image.contentType, "Cache-Control": "private, max-age=300" },
  });
}
