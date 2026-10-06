import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedUser } from "@/lib/request-auth";
import { submitCarrierReview } from "@/lib/marketplace";

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().trim().max(2000).default(""),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticatedUser(request);
  if (!user || user.role !== "requester") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a rating from 1 to 5" }, { status: 400 });
  const { id } = await context.params;
  try {
    const saved = await submitCarrierReview(user.id, id, parsed.data.rating, parsed.data.feedback);
    if (!saved) return NextResponse.json({ error: "This transport cannot be reviewed, or has already been reviewed" }, { status: 409 });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Unable to save carrier review", error);
    return NextResponse.json({ error: "Unable to save review" }, { status: 500 });
  }
}
