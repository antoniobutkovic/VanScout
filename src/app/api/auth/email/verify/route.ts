import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyEmail } from "@/lib/database";
import { createSessionToken } from "@/lib/session";

const bodySchema = z.union([
  z.object({ token: z.string().min(1) }),
  z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/) }),
]);

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const email = "email" in body ? body.email.trim().toLowerCase() : undefined;
    const secret = "token" in body ? body.token : `${email}:${body.code}`;
    const user = await verifyEmail(createHash("sha256").update(secret).digest("hex"), email);
    if (!user) return NextResponse.json({ error: "This verification code is invalid or expired" }, { status: 400 });
    const token = await createSessionToken(user);
    return NextResponse.json({ message: "Email verified", token, user });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Enter a valid six-digit verification code" }, { status: 400 });
    return NextResponse.json({ error: "Unable to verify your email" }, { status: 500 });
  }
}
