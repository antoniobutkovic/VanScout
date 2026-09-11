import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyEmail } from "@/lib/database";

const bodySchema = z.object({ token: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const verified = await verifyEmail(createHash("sha256").update(body.token).digest("hex"));
    if (!verified) return NextResponse.json({ error: "This verification link is invalid or expired" }, { status: 400 });
    return NextResponse.json({ message: "Email verified" });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "This verification link is invalid or expired" }, { status: 400 });
    return NextResponse.json({ error: "Unable to verify your email" }, { status: 500 });
  }
}
