import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedUser } from "@/lib/request-auth";
import { eraseUserAccount } from "@/lib/privacy";
import { clearSessionCookie } from "@/lib/session";

const bodySchema = z.object({ confirmation: z.literal("DELETE MY ACCOUNT") });

export async function DELETE(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Type DELETE MY ACCOUNT to confirm" }, { status: 400 });
  await eraseUserAccount(user.id);
  return clearSessionCookie(NextResponse.json({ ok: true }));
}
