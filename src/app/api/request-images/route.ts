import { NextResponse } from "next/server";
import { replaceRequestDraftImages } from "@/lib/database";
import { authenticatedUser } from "@/lib/request-auth";

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await request.formData();
    const transportId = String(form.get("transportId") || "").trim() || undefined;
    const images = form.getAll("images").filter((value): value is File => value instanceof File);
    if (!images.length || images.length > MAX_IMAGES) {
      return NextResponse.json({ error: "Choose between one and three images" }, { status: 400 });
    }
    if (images.some(image => !ALLOWED_IMAGE_TYPES.has(image.type) || image.size <= 0 || image.size > MAX_IMAGE_BYTES)) {
      return NextResponse.json({ error: "Images must be JPEG, PNG, WebP, HEIC, or HEIF and no larger than 10 MB" }, { status: 400 });
    }

    await replaceRequestDraftImages(user.id, await Promise.all(images.map(async image => ({
      name: image.name.slice(0, 255) || "request-image",
      type: image.type,
      bytes: new Uint8Array(await image.arrayBuffer()),
    }))), transportId);
    return NextResponse.json({ uploaded: images.length });
  } catch {
    return NextResponse.json({ error: "Unable to save request images" }, { status: 500 });
  }
}
