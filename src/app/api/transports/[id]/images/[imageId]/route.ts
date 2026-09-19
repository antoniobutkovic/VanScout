import { NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/request-auth";
import { getTransportRequestImage } from "@/lib/database";

export async function GET(request: Request, context: { params: Promise<{ id: string; imageId: string }> }) {
  if (!await authenticatedUser(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, imageId } = await context.params;
  const image = await getTransportRequestImage(id, imageId);
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new Response(new Uint8Array(image.data), { headers: { "Content-Type": image.contentType, "Cache-Control": "private, max-age=300" } });
}
