import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedUser } from "@/lib/request-auth";
import { createGoogleUserWithPhone, verifyUserPhone } from "@/lib/database";
import { verifiedFirebasePhoneNumber } from "@/lib/firebase-token";
import { bearerToken, createSessionToken, setSessionCookie, verifyGoogleRegistrationToken } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  firebaseIdToken: z.string().min(100),
  role: z.enum(["requester", "transporter"]).optional(),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
});

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "phone-verify", 10, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many phone verification attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const authenticated = await authenticatedUser(request);

  try {
    const body = bodySchema.parse(await request.json());
    if (authenticated) {
      const phoneNumber = await verifiedFirebasePhoneNumber(body.firebaseIdToken);
      const user = await verifyUserPhone(authenticated.id, phoneNumber);
      return NextResponse.json({ user });
    }

    const pendingToken = bearerToken(request);
    if (!pendingToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const identity = await verifyGoogleRegistrationToken(pendingToken);
    if (!body.role || !body.firstName || !body.lastName) {
      return NextResponse.json({ error: "Name and account type are required" }, { status: 400 });
    }
    const phoneNumber = await verifiedFirebasePhoneNumber(body.firebaseIdToken);
    const user = await createGoogleUserWithPhone(identity, body.role, body.firstName, body.lastName, phoneNumber);
    const token = await createSessionToken(user);
    return setSessionCookie(NextResponse.json({ user }), token);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Phone verification token is required" }, { status: 400 });
    if (error instanceof Error && error.message.includes("unique")) return NextResponse.json({ error: "This phone number is already used by another account" }, { status: 409 });
    if (error instanceof Error && error.message.includes("Google registration")) return NextResponse.json({ error: error.message }, { status: 401 });
    // Log only error metadata, never the Firebase ID token or phone number.
    console.error("Phone verification token rejected", {
      name: error instanceof Error ? error.name : "UnknownError",
      code: error && typeof error === "object" && "code" in error ? String(error.code) : undefined,
    });
    return NextResponse.json({ error: "We couldn't verify your phone number right now. Please try again in a moment." }, { status: 401 });
  }
}
