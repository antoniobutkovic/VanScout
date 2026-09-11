import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByEmailWithPassword } from "@/lib/database";
import { verifyPassword } from "@/lib/password";
import { createSessionToken } from "@/lib/session";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
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
    return NextResponse.json({ token, user: account.user });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
    return NextResponse.json({ error: "Unable to sign in" }, { status: 500 });
  }
}
