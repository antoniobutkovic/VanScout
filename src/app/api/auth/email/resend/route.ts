import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createEmailVerification, findUserByEmailWithPassword } from "@/lib/database";
import { sendEmailVerificationEmail } from "@/lib/mailer";
import { createVerificationCode } from "@/lib/password";
import { checkRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({ email: z.string().email() });
const genericResponse = { message: "If the account needs verification, a new six-digit code has been sent." };

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "email-resend", 5, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json(genericResponse, { status: 202, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  try {
    const body = bodySchema.parse(await request.json());
    const account = await findUserByEmailWithPassword(body.email);
    if (account && !account.emailVerified) {
      const code = createVerificationCode();
      const tokenHash = createHash("sha256").update(`${account.user.email}:${code}`).digest("hex");
      await createEmailVerification(account.user.id, tokenHash);
      await sendEmailVerificationEmail({ to: account.user.email, verificationCode: code });
    }
    return NextResponse.json(genericResponse);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    console.error("Verification email resend failed", error);
    return NextResponse.json({ error: "Unable to send the verification email" }, { status: 500 });
  }
}
