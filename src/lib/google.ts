import { OAuth2Client } from "google-auth-library";
import { requiredEnv } from "./config";

export type GoogleIdentity = {
  subject: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const clientId = requiredEnv("GOOGLE_CLIENT_ID");
  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({ idToken, audience: clientId });
  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new Error("Google account could not be verified");
  }

  return {
    subject: payload.sub,
    email: payload.email,
    name: payload.name || payload.email,
    avatarUrl: payload.picture || null,
  };
}
