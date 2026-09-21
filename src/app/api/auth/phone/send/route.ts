import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedUser } from "@/lib/request-auth";
import { bearerToken, verifyGoogleRegistrationToken } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({ phoneNumber: z.string().regex(/^\+[1-9]\d{7,14}$/) });

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "phone-send", 5, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many phone verification attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const user = await authenticatedUser(request);
  if (!user) {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      await verifyGoogleRegistrationToken(token);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    bodySchema.parse(await request.json());
    return NextResponse.json({ message: "Phone number accepted" });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Enter a valid international phone number" }, { status: 400 });
    return NextResponse.json({ error: "We couldn't send a verification code right now. Please try again in a moment." }, { status: 500 });
  }
}
