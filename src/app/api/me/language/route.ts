import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserLanguagePreference, updateUserLanguagePreference } from "@/lib/database";
import { authenticatedUser } from "@/lib/request-auth";

const languageSchema = z.object({ language: z.enum(["en", "hr"]) });

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ language: await getUserLanguagePreference(user.id) });
}

export async function PUT(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = languageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid language" }, { status: 400 });
  const language = await updateUserLanguagePreference(user.id, parsed.data.language);
  if (!language) return NextResponse.json({ error: "Unable to save language preference" }, { status: 500 });
  return NextResponse.json({ language });
}
