import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createEmailVerification, createPasswordUser } from "@/lib/database";
import { sendEmailVerificationEmail } from "@/lib/mailer";
import { createVerificationCode, hashPassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(128),
  passwordConfirmation: z.string().min(12).max(128),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  role: z.enum(["requester", "transporter"]).default("requester"),
}).refine(body => body.password === body.passwordConfirmation, {
  message: "Passwords do not match",
  path: ["passwordConfirmation"],
});

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "password-register", 5, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many registration attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  try {
    const body = bodySchema.parse(await request.json());
    const user = await createPasswordUser(body.email, await hashPassword(body.password), body.role, body.firstName, body.lastName);
    if (!user) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });

    const code = createVerificationCode();
    await createEmailVerification(user.id, createHash("sha256").update(`${user.email}:${code}`).digest("hex"));
    await sendEmailVerificationEmail({ to: user.email, verificationCode: code });
    return NextResponse.json({ email: user.email });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message === "Passwords do not match" ? "Passwords do not match" : "Enter your name, a valid email and a password with at least 12 characters" }, { status: 400 });
    console.error("Account verification email failed", error);
    return NextResponse.json({ error: "Unable to send the verification email" }, { status: 500 });
  }
}
