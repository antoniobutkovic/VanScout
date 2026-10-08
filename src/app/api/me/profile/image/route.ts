import { NextResponse } from "next/server";
import { getRequesterProfilePhoto } from "@/lib/database";
import { authenticatedUser } from "@/lib/request-auth";

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "requester") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const image = await getRequesterProfilePhoto(user.id);
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new Response(new Uint8Array(image.data), { headers: { "Content-Type": image.contentType, "Cache-Control": "private, max-age=300" } });
}
