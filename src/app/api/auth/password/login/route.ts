import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByEmailWithPassword } from "@/lib/database";
import { verifyPassword } from "@/lib/password";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "password-login", 10, 15 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many sign-in attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  try {
    const body = bodySchema.parse(await request.json());
    const account = await findUserByEmailWithPassword(body.email);
    if (!account?.passwordHash || !(await verifyPassword(body.password, account.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    if (!account.emailVerified) {
      return NextResponse.json({ code: "EMAIL_NOT_VERIFIED", error: "Please verify your email before signing in" }, { status: 403 });
    }

    const token = await createSessionToken(account.user);
    return setSessionCookie(NextResponse.json({ user: account.user }), token);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
    return NextResponse.json({ error: "Unable to sign in" }, { status: 500 });
  }
}
