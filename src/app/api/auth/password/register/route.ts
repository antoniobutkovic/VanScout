import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createEmailVerification, createPasswordUser } from "@/lib/database";
import { sendEmailVerificationEmail } from "@/lib/mailer";
import { createVerificationCode, hashPassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rate-limit";
import { authLogContext, logAuthEvent, safeErrorName } from "@/lib/auth-log";
import { TERMS_VERSION } from "@/lib/legal";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(128),
  passwordConfirmation: z.string().min(12).max(128),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  role: z.enum(["requester", "transporter"]).default("requester"),
  termsAccepted: z.literal(true),
}).refine(body => body.password === body.passwordConfirmation, {
  message: "Passwords do not match",
  path: ["passwordConfirmation"],
});

export async function POST(request: Request) {
  const context = await authLogContext(request);
  let stage = "validation";
  const rate = checkRateLimit(request, "password-register", 5, 60 * 60 * 1000);
  if (!rate.allowed) {
    logAuthEvent(context, "registration", "rate_limited", { status: 429, retryAfterSeconds: rate.retryAfterSeconds });
    return NextResponse.json({ error: "Too many registration attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }
  try {
    const body = bodySchema.parse(await request.json());
    stage = "create_account";
    const user = await createPasswordUser(body.email, await hashPassword(body.password), body.role, body.firstName, body.lastName, TERMS_VERSION);
    if (!user) {
      logAuthEvent(context, "registration", "account_exists", { status: 409 });
      return NextResponse.json({ error: "An account with this email already exists. Sign in to continue or request a new verification code." }, { status: 409 });
    }

    const code = createVerificationCode();
    stage = "create_verification";
    await createEmailVerification(user.id, createHash("sha256").update(`${user.email}:${code}`).digest("hex"));
    stage = "send_email";
    await sendEmailVerificationEmail({ to: user.email, verificationCode: code });
    logAuthEvent(context, "registration", "verification_sent", { status: 200 });
    return NextResponse.json({ email: user.email });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      logAuthEvent(context, "registration", "invalid_input", { status: 400 });
      return NextResponse.json({ error: error instanceof z.ZodError && error.issues[0]?.message === "Passwords do not match" ? "Passwords do not match" : "Enter your name, a valid email and a password with at least 12 characters, and accept the Terms and Conditions" }, { status: 400 });
    }
    logAuthEvent(context, "registration", "failed", { status: 500, stage, errorName: safeErrorName(error) });
    return NextResponse.json({ error: "Unable to send the verification email" }, { status: 500 });
  }
}
