import { jwtVerify, SignJWT } from "jose";
import { requiredEnv } from "./config";
import type { GoogleIdentity } from "./google";

const ISSUER = "vanscout-api";
const AUDIENCE = "vanscout-web";
const GOOGLE_REGISTRATION_AUDIENCE = "vanscout-google-registration";

function secretKey() {
  const secret = requiredEnv("JWT_SECRET");
  if (secret.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: { id: string; email: string; role: string }) {
  return new SignJWT({ userId: user.id, email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER, audience: AUDIENCE });
  const userId = typeof payload.userId === "string" ? payload.userId : null;
  if (!userId) throw new Error("Session has no user id");
  return { userId };
}

export async function createGoogleRegistrationToken(identity: GoogleIdentity) {
  return new SignJWT({
    googleSubject: identity.subject,
    email: identity.email,
    name: identity.name,
    avatarUrl: identity.avatarUrl,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(GOOGLE_REGISTRATION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secretKey());
}

export async function verifyGoogleRegistrationToken(token: string): Promise<GoogleIdentity> {
  const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER, audience: GOOGLE_REGISTRATION_AUDIENCE });
  if (typeof payload.googleSubject !== "string" || typeof payload.email !== "string" || typeof payload.name !== "string") {
    throw new Error("Google registration is invalid or expired");
  }
  return {
    subject: payload.googleSubject,
    email: payload.email,
    name: payload.name,
    avatarUrl: typeof payload.avatarUrl === "string" ? payload.avatarUrl : null,
  };
}

export function bearerToken(request: Request) {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
}
