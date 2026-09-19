import { NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/request-auth";
import { listConversations } from "@/lib/marketplace";

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ conversations: await listConversations(user) });
  } catch (error) {
    console.error("Unable to load conversations", error);
    return NextResponse.json({ error: "Unable to load conversations" }, { status: 500 });
  }
}
