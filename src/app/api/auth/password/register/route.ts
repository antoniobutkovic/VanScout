import { NextResponse } from "next/server";
import { z } from "zod";
import { createPasswordUser } from "@/lib/database";
import { hashPassword } from "@/lib/password";
import { createSessionToken } from "@/lib/session";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["requester", "transporter"]).default("requester"),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const user = await createPasswordUser(body.email, await hashPassword(body.password), body.role);
    if (!user) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });

    const token = await createSessionToken(user);
    return NextResponse.json({ token, user });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Enter a valid email and a password with at least 8 characters" }, { status: 400 });
    return NextResponse.json({ error: "Unable to create account" }, { status: 500 });
  }
}
