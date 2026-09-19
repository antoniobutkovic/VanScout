import { NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/request-auth";
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
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
  const companyName = String(form.get("companyName") || "").trim();
  const bio = String(form.get("bio") || "").trim();
  const replaceImages = form.get("replaceImages") === "true";
  const images = form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
  if (!companyName || companyName.length > 150 || bio.length > 1500) return NextResponse.json({ error: "Check the profile details" }, { status: 400 });
  if (images.length > 3 || images.some(image => !image.type.startsWith("image/") || image.size > MAX_IMAGE_BYTES)) {
    return NextResponse.json({ error: "Choose up to 3 images, no larger than 10 MB each" }, { status: 400 });
  }
  try {
    return NextResponse.json({ profile: await updateCarrierProfile(user, companyName, bio, replaceImages ? images : null) });
  } catch (error) {
    console.error("Unable to update carrier profile", error);
    return NextResponse.json({ error: "Unable to save profile" }, { status: 500 });
  }
}
