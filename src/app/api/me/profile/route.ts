import { NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/request-auth";
import { getRequesterProfilePhotoId, updateRequesterProfilePhoto } from "@/lib/database";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  const profileImageId = user.role === "requester" ? await getRequesterProfilePhotoId(user.id) : null;
  return NextResponse.json({ ok: true, data: { profile: { ...user, profileImageId, emailVerified: true } } });
}

export async function PUT(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "requester") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const image = form?.get("profileImage");
  if (!(image instanceof File) || image.size === 0 || !image.type.startsWith("image/") || image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Choose an image no larger than 10 MB" }, { status: 400 });
  }
  try {
    const profileImageId = await updateRequesterProfilePhoto(user.id, image);
    return NextResponse.json({ profileImageId });
  } catch (error) {
    console.error("Unable to save requester profile photo", error);
    return NextResponse.json({ error: "Unable to save profile" }, { status: 500 });
  }
}
