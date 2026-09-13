import { createRemoteJWKSet, jwtVerify } from "jose";
import { requiredEnv } from "./config";

const FIREBASE_PUBLIC_KEYS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);
const MAX_PHONE_AUTH_AGE_SECONDS = 10 * 60;

type FirebaseClaims = {
  phone_number?: unknown;
  auth_time?: unknown;
  firebase?: unknown;
};

export async function verifiedFirebasePhoneNumber(idToken: string): Promise<string> {
  const projectId = requiredEnv("FIREBASE_PROJECT_ID");
  const { payload } = await jwtVerify<FirebaseClaims>(idToken, FIREBASE_PUBLIC_KEYS, {
    algorithms: ["RS256"],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
  });

  const phoneNumber = payload.phone_number;
  const authTime = payload.auth_time;
  const firebase = payload.firebase;
  const signInProvider = firebase && typeof firebase === "object" && "sign_in_provider" in firebase
    ? firebase.sign_in_provider
    : null;
  const now = Math.floor(Date.now() / 1000);

  if (
    typeof phoneNumber !== "string"
    || !/^\+[1-9]\d{7,14}$/.test(phoneNumber)
    || typeof authTime !== "number"
    || authTime > now + 60
    || now - authTime > MAX_PHONE_AUTH_AGE_SECONDS
    || signInProvider !== "phone"
  ) {
    throw new Error("Firebase phone verification is invalid or expired");
  }

  return phoneNumber;
}
