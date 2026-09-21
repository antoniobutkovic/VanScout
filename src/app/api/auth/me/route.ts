import { NextResponse } from "next/server";
import { findUserById } from "@/lib/database";
import { sessionToken, setSessionCookie, verifySessionToken } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const token = sessionToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { userId } = await verifySessionToken(token);
    const user = await findUserById(userId);
    return user ? setSessionCookie(NextResponse.json({ user }), token) : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
