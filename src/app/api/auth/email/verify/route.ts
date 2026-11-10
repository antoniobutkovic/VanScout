import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyEmail } from "@/lib/database";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { authLogContext, logAuthEvent, safeErrorName } from "@/lib/auth-log";
import { checkRateLimit } from "@/lib/rate-limit";

const bodySchema = z.union([
  z.object({ token: z.string().min(1) }),
  z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/) }),
]);

export async function POST(request: Request) {
  const context = await authLogContext(request);
  let stage = "validation";
  const rate = checkRateLimit(request, "email-verify", 10, 15 * 60 * 1000);
  if (!rate.allowed) {
    logAuthEvent(context, "email_verification", "rate_limited", { status: 429, retryAfterSeconds: rate.retryAfterSeconds });
    return NextResponse.json({ error: "Too many verification attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }
  try {
    const body = bodySchema.parse(await request.json());
    const email = "email" in body ? body.email.trim().toLowerCase() : undefined;
    const secret = "token" in body ? body.token : `${email}:${body.code}`;
    stage = "verify_code";
    const user = await verifyEmail(createHash("sha256").update(secret).digest("hex"), email);
    if (!user) {
      logAuthEvent(context, "email_verification", "invalid_expired_or_locked", { status: 400 });
      return NextResponse.json({ error: "This verification code is invalid or expired. Request a new code and try again." }, { status: 400 });
    }
    stage = "create_session";
    const token = await createSessionToken(user);
    logAuthEvent(context, "email_verification", "verified", { status: 200 });
    return setSessionCookie(NextResponse.json({ message: "Email verified", user }), token);
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      logAuthEvent(context, "email_verification", "invalid_input", { status: 400 });
      return NextResponse.json({ error: "Enter a valid six-digit verification code" }, { status: 400 });
    }
    logAuthEvent(context, "email_verification", "failed", { status: 500, stage, errorName: safeErrorName(error) });
    return NextResponse.json({ error: "Unable to verify your email" }, { status: 500 });
  }
}
