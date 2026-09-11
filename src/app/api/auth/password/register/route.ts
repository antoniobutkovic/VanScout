import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createEmailVerification, createPasswordUser } from "@/lib/database";
import { sendEmailVerificationEmail } from "@/lib/mailer";
import { createVerificationToken, hashPassword } from "@/lib/password";
import { optionalEnv } from "@/lib/config";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  passwordConfirmation: z.string().min(8),
  role: z.enum(["requester", "transporter"]).default("requester"),
}).refine(body => body.password === body.passwordConfirmation, {
  message: "Passwords do not match",
  path: ["passwordConfirmation"],
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const user = await createPasswordUser(body.email, await hashPassword(body.password), body.role);
    if (!user) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });

    const token = createVerificationToken();
    await createEmailVerification(user.id, createHash("sha256").update(token).digest("hex"));
    const baseUrl = optionalEnv("APP_URL") || new URL(request.url).origin;
    const verificationUrl = `${baseUrl.replace(/\/$/, "")}/auth/verify-email?token=${encodeURIComponent(token)}`;
    await sendEmailVerificationEmail({ to: user.email, verificationUrl });
    return NextResponse.json({ email: user.email });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message === "Passwords do not match" ? "Passwords do not match" : "Enter a valid email and a password with at least 8 characters" }, { status: 400 });
    console.error("Account verification email failed", error);
    return NextResponse.json({ error: "Unable to send the verification email" }, { status: 500 });
  }
}
