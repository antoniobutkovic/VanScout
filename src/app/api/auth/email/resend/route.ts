import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createEmailVerification, findUserByEmailWithPassword } from "@/lib/database";
import { sendEmailVerificationEmail } from "@/lib/mailer";
import { createVerificationCode } from "@/lib/password";
import { authLogContext, logAuthEvent, safeErrorName } from "@/lib/auth-log";
import { checkRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({ email: z.string().email() });
const genericResponse = { message: "If the account needs verification, a new six-digit code has been sent." };

export async function POST(request: Request) {
  const context = await authLogContext(request);
  let stage = "validation";
  const rate = checkRateLimit(request, "email-resend", 5, 60 * 60 * 1000);
  if (!rate.allowed) {
    logAuthEvent(context, "email_resend", "rate_limited", { status: 429, retryAfterSeconds: rate.retryAfterSeconds });
    return NextResponse.json({ error: "Too many requests for a verification code. Try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }
  try {
    const body = bodySchema.parse(await request.json());
    stage = "lookup_account";
    const account = await findUserByEmailWithPassword(body.email);
    if (account && !account.emailVerified) {
      const code = createVerificationCode();
      const tokenHash = createHash("sha256").update(`${account.user.email}:${code}`).digest("hex");
      stage = "create_verification";
      await createEmailVerification(account.user.id, tokenHash);
      stage = "send_email";
      await sendEmailVerificationEmail({ to: account.user.email, verificationCode: code });
    }
    logAuthEvent(context, "email_resend", account && !account.emailVerified ? "verification_sent" : "no_unverified_account", { status: 200 });
    return NextResponse.json(genericResponse);
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      logAuthEvent(context, "email_resend", "invalid_input", { status: 400 });
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }
    logAuthEvent(context, "email_resend", "failed", { status: 500, stage, errorName: safeErrorName(error) });
    return NextResponse.json({ error: "Unable to send the verification email" }, { status: 500 });
  }
}
