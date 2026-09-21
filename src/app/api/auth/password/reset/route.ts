import { NextResponse } from "next/server";
import { z } from "zod";
import { resetUserPassword } from "@/lib/database";
import { hashPassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(12).max(128),
  passwordConfirmation: z.string().min(12).max(128),
}).refine(body => body.password === body.passwordConfirmation, {
  message: "Passwords do not match",
  path: ["passwordConfirmation"],
});

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "password-reset", 10, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many reset attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  try {
    const body = bodySchema.parse(await request.json());
    const passwordHash = await hashPassword(body.password);
    const reset = await resetUserPassword(body.token, passwordHash);
    if (!reset) return NextResponse.json({ error: "This reset link is invalid or expired" }, { status: 400 });
    return NextResponse.json({ message: "Password reset successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Choose matching passwords with at least 12 characters" }, { status: 400 });
    return NextResponse.json({ error: "Unable to reset password" }, { status: 500 });
  }
}
