import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByGoogleIdentity, upsertGoogleUser } from "@/lib/database";
import { createGoogleRegistrationToken, createSessionToken } from "@/lib/session";
import { verifyGoogleIdToken } from "@/lib/google";

const bodySchema = z.object({
  idToken: z.string().min(1),
  role: z.enum(["requester", "transporter"]).optional(),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const identity = await verifyGoogleIdToken(body.idToken);
    const existingUser = await findUserByGoogleIdentity(identity);
    if (!existingUser) {
      const [firstName = identity.name, ...lastNameParts] = identity.name.trim().split(/\s+/);
      return NextResponse.json({
        requiresRegistration: true,
        registrationToken: await createGoogleRegistrationToken(identity),
        profile: { email: identity.email, firstName, lastName: lastNameParts.join(" ") },
      });
    }
    const user = await upsertGoogleUser(identity, body.role);
    const token = await createSessionToken(user);
    return NextResponse.json({ token, user });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid Google sign-in request" }, { status: 400 });
    console.error("Google sign-in failed", error);
    const status = error instanceof Error && error.message.includes("not configured") ? 503 : 401;
    const message = status === 503 ? "Google sign-in is not configured" : "Google sign-in failed. Please try again.";
    return NextResponse.json({ error: message }, { status });
  }
}
