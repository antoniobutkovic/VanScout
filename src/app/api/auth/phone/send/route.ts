import { NextResponse } from "next/server";
import { z } from "zod";
import { isPhoneNumberInUse } from "@/lib/database";
import { authenticatedUser } from "@/lib/request-auth";
import { bearerToken, verifyGoogleRegistrationToken } from "@/lib/session";
import { accountLogId, logAuthEvent, safeErrorName } from "@/lib/auth-log";
import { checkRateLimit } from "@/lib/rate-limit";
import { isE164PhoneNumber } from "@/lib/phone-number";

const bodySchema = z.object({ phoneNumber: z.string().refine(isE164PhoneNumber) });

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "phone-send", 5, 60 * 60 * 1000);
  if (!rate.allowed) {
    logAuthEvent({}, "phone_send", "rate_limited", { status: 429, retryAfterSeconds: rate.retryAfterSeconds });
    return NextResponse.json({ error: "Too many phone verification attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }
  const user = await authenticatedUser(request);
  if (!user) {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      await verifyGoogleRegistrationToken(token);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const context = { account: accountLogId(user?.email) };
  try {
    const { phoneNumber } = bodySchema.parse(await request.json());
    if (await isPhoneNumberInUse(phoneNumber, user?.id)) {
      logAuthEvent(context, "phone_send", "phone_in_use", { status: 409 });
      return NextResponse.json({ error: "This phone number is already used by another account" }, { status: 409 });
    }
    logAuthEvent(context, "phone_send", "phone_accepted", { status: 200 });
    return NextResponse.json({ message: "Phone number accepted" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logAuthEvent(context, "phone_send", "invalid_phone", { status: 400 });
      return NextResponse.json({ error: "Enter a valid international phone number" }, { status: 400 });
    }
    logAuthEvent(context, "phone_send", "failed", { status: 500, errorName: safeErrorName(error) });
    return NextResponse.json({ error: "We couldn't send a verification code right now. Please try again in a moment." }, { status: 500 });
  }
}
