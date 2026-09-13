import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedUser } from "@/lib/request-auth";
import { verifyUserPhone } from "@/lib/database";
import { verifiedFirebasePhoneNumber } from "@/lib/firebase-token";

const bodySchema = z.object({
  firebaseIdToken: z.string().min(100),
});

export async function POST(request: Request) {
  const authenticated = await authenticatedUser(request);
  if (!authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = bodySchema.parse(await request.json());
    const phoneNumber = await verifiedFirebasePhoneNumber(body.firebaseIdToken);
    const user = await verifyUserPhone(authenticated.id, phoneNumber);
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Phone verification token is required" }, { status: 400 });
    if (error instanceof Error && error.message.includes("unique")) return NextResponse.json({ error: "This phone number is already used by another account" }, { status: 409 });
    return NextResponse.json({ error: "Phone verification is invalid or expired" }, { status: 401 });
  }
}
