import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

export function POST() {
  return clearSessionCookie(NextResponse.json({ ok: true }));
}
