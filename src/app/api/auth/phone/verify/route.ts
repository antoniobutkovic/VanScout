import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedUser } from "@/lib/request-auth";
import { createGoogleUserWithPhone, verifyUserPhone } from "@/lib/database";
import { verifiedFirebasePhoneNumber } from "@/lib/firebase-token";
import { bearerToken, createSessionToken, setSessionCookie, verifyGoogleRegistrationToken } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { accountLogId, logAuthEvent, safeErrorCode, safeErrorName } from "@/lib/auth-log";
import { TERMS_VERSION } from "@/lib/legal";

const bodySchema = z.object({
  firebaseIdToken: z.string().min(100),
  role: z.enum(["requester", "transporter"]).optional(),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  termsAccepted: z.literal(true).optional(),
});

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "phone-verify", 10, 60 * 60 * 1000);
  if (!rate.allowed) {
    logAuthEvent({}, "phone_verification", "rate_limited", { status: 429, retryAfterSeconds: rate.retryAfterSeconds });
    return NextResponse.json({ error: "Too many phone verification attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }
  const authenticated = await authenticatedUser(request);
  let context = { account: accountLogId(authenticated?.email) };
  let stage = "validation";

  try {
    const body = bodySchema.parse(await request.json());
    if (authenticated) {
      stage = "firebase_token";
      const phoneNumber = await verifiedFirebasePhoneNumber(body.firebaseIdToken);
      stage = "save_phone";
      const user = await verifyUserPhone(authenticated.id, phoneNumber);
      logAuthEvent(context, "phone_verification", "verified", { status: 200 });
      return NextResponse.json({ user });
    }

    const pendingToken = bearerToken(request);
    if (!pendingToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    stage = "google_registration";
    const identity = await verifyGoogleRegistrationToken(pendingToken);
    context = { account: accountLogId(identity.email) };
    if (!body.role || !body.firstName || !body.lastName || !body.termsAccepted) {
      return NextResponse.json({ error: "Name, account type and acceptance of the Terms and Conditions are required" }, { status: 400 });
    }
    stage = "firebase_token";
    const phoneNumber = await verifiedFirebasePhoneNumber(body.firebaseIdToken);
    stage = "create_account";
    const user = await createGoogleUserWithPhone(identity, body.role, body.firstName, body.lastName, phoneNumber, TERMS_VERSION);
    const token = await createSessionToken(user);
    logAuthEvent(context, "phone_verification", "verified", { status: 200 });
    return setSessionCookie(NextResponse.json({ user }), token);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logAuthEvent(context, "phone_verification", "invalid_input", { status: 400 });
      return NextResponse.json({ error: "Phone verification token is required" }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("unique")) {
      logAuthEvent(context, "phone_verification", "phone_in_use", { status: 409 });
      return NextResponse.json({ error: "This phone number is already used by another account" }, { status: 409 });
    }
    if (error instanceof Error && error.message.includes("Google registration")) return NextResponse.json({ error: error.message }, { status: 401 });
    logAuthEvent(context, "phone_verification", "failed", { status: 401, stage, errorName: safeErrorName(error), errorCode: safeErrorCode(error) });
    return NextResponse.json({ error: "We couldn't verify your phone number right now. Please try again in a moment." }, { status: 401 });
  }
}
