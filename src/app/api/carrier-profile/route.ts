import { NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/request-auth";
import { accountLogId, logAuthEvent, safeErrorName } from "@/lib/auth-log";
import { getCarrierProfile, updateCarrierProfile } from "@/lib/marketplace";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "transporter") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ profile: await getCarrierProfile(user) });
  } catch (error) {
    console.error("Unable to load carrier profile", error);
    return NextResponse.json({ error: "Unable to load profile" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "transporter") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const context = { account: accountLogId(user.email), requestId: undefined };
  const form = await request.formData().catch(() => null);
  if (!form) {
    logAuthEvent(context, "carrier_profile_save", "invalid_form", { status: 400 });
    return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
  }
  const companyName = String(form.get("companyName") || "").trim();
  const bio = String(form.get("bio") || "").trim();
  const galleryChanged = form.get("galleryChanged") === "true";
  const retainedImageIds = form.getAll("retainedImageIds").map(String);
  const images = form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
  const profileImageValue = form.get("profileImage");
  const profileImage = profileImageValue instanceof File && profileImageValue.size > 0 ? profileImageValue : null;
  const details = { imageCount: images.length + (profileImage ? 1 : 0), totalImageBytes: images.reduce((total, image) => total + image.size, profileImage?.size || 0) };
  if (!companyName || companyName.length > 150 || bio.length > 1500) {
    logAuthEvent(context, "carrier_profile_save", "invalid_details", { status: 400, ...details });
    return NextResponse.json({ error: "Check the profile details" }, { status: 400 });
  }
  if (retainedImageIds.length + images.length > 3 || images.some(image => !image.type.startsWith("image/") || image.size > MAX_IMAGE_BYTES)) {
    logAuthEvent(context, "carrier_profile_save", "invalid_gallery", { status: 400, ...details });
    return NextResponse.json({ error: "Choose up to 3 images, no larger than 10 MB each" }, { status: 400 });
  }
  if (profileImage && (!profileImage.type.startsWith("image/") || profileImage.size > MAX_IMAGE_BYTES)) {
    logAuthEvent(context, "carrier_profile_save", "invalid_profile_image", { status: 400, ...details });
    return NextResponse.json({ error: "Choose an image no larger than 10 MB" }, { status: 400 });
  }
  try {
    const profile = await updateCarrierProfile(user, companyName, bio, galleryChanged ? { retainedImageIds, newImages: images } : null, profileImage);
    logAuthEvent(context, "carrier_profile_save", "saved", { status: 200, ...details });
    return NextResponse.json({ profile });
  } catch (error) {
    logAuthEvent(context, "carrier_profile_save", "failed", { status: 500, errorName: safeErrorName(error), ...details });
    return NextResponse.json({ error: "Unable to save profile" }, { status: 500 });
  }
}
