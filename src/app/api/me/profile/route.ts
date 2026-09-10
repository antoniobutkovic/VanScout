import { NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/request-auth";

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  return NextResponse.json({ ok: true, data: { profile: { ...user, emailVerified: true } } });
}
