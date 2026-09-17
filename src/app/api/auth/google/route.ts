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
    const message = error instanceof z.ZodError ? "Invalid Google sign-in request" : error instanceof Error ? error.message : "Google sign-in failed";
    const status = message.includes("not configured") ? 503 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}
