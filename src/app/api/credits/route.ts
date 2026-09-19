import { NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/request-auth";
import { getCreditAccount } from "@/lib/credits";

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "transporter") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ account: await getCreditAccount(user.id) });
  } catch (error) {
    console.error("Unable to load credits", error);
    return NextResponse.json({ error: "Unable to load credits" }, { status: 500 });
  }
}

