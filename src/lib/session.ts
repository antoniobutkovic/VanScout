import { jwtVerify, SignJWT } from "jose";
import { requiredEnv } from "./config";

const ISSUER = "vanscout-api";
const AUDIENCE = "vanscout-web";

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

export function bearerToken(request: Request) {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
}
