import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createEmailVerification, findUserByEmailWithPassword } from "@/lib/database";
import { optionalEnv } from "@/lib/config";
import { sendEmailVerificationEmail } from "@/lib/mailer";
import { createVerificationToken } from "@/lib/password";

const bodySchema = z.object({ email: z.string().email() });
const genericResponse = { message: "If the account needs verification, a new verification link has been sent." };

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const account = await findUserByEmailWithPassword(body.email);
    if (account && !account.emailVerified) {
      const token = createVerificationToken();
      const tokenHash = createHash("sha256").update(token).digest("hex");
      await createEmailVerification(account.user.id, tokenHash);
      const baseUrl = optionalEnv("APP_URL") || new URL(request.url).origin;
      const verificationUrl = `${baseUrl.replace(/\/$/, "")}/auth/verify-email?token=${encodeURIComponent(token)}`;
      await sendEmailVerificationEmail({ to: account.user.email, verificationUrl });
    }
    return NextResponse.json(genericResponse);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    console.error("Verification email resend failed", error);
    return NextResponse.json({ error: "Unable to send the verification email" }, { status: 500 });
  }
}
