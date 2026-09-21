import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createPasswordReset } from "@/lib/database";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { createResetToken } from "@/lib/password";
import { optionalEnv } from "@/lib/config";
import { checkRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({ email: z.string().email() });
const genericResponse = { message: "If an account exists for this email, a reset link has been sent." };

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "password-forgot", 5, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json(genericResponse, { status: 202, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  try {
    const body = bodySchema.parse(await request.json());
    const token = createResetToken();
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const account = await createPasswordReset(body.email, tokenHash);

    if (account) {
      const baseUrl = optionalEnv("APP_URL") || new URL(request.url).origin;
      const resetUrl = `${baseUrl.replace(/\/$/, "")}/auth/reset-password?token=${encodeURIComponent(token)}`;
      await sendPasswordResetEmail({ to: account.email, resetUrl });
    }

    return NextResponse.json(genericResponse);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    console.error("Password reset email failed", error);
    return NextResponse.json({ error: "Unable to send the reset email" }, { status: 500 });
  }
}
