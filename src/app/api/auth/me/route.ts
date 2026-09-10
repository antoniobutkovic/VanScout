import { NextResponse } from "next/server";
import { findUserById } from "@/lib/database";
import { bearerToken, verifySessionToken } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { userId } = await verifySessionToken(token);
    const user = await findUserById(userId);
    return user ? NextResponse.json({ user }) : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
