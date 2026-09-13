import { NextResponse } from "next/server";
import { optionalEnv } from "@/lib/config";

export function GET() {
  const clientId = optionalEnv("GOOGLE_CLIENT_ID");
  const firebase = {
    apiKey: optionalEnv("FIREBASE_API_KEY"),
    authDomain: optionalEnv("FIREBASE_AUTH_DOMAIN"),
    projectId: optionalEnv("FIREBASE_PROJECT_ID"),
    appId: optionalEnv("FIREBASE_APP_ID"),
    messagingSenderId: optionalEnv("FIREBASE_MESSAGING_SENDER_ID"),
    storageBucket: optionalEnv("FIREBASE_STORAGE_BUCKET"),
  };
  const firebaseEnabled = Boolean(firebase.apiKey && firebase.authDomain && firebase.projectId && firebase.appId);

  return NextResponse.json({
    google: { enabled: Boolean(clientId), clientId: clientId ?? null },
    firebase: {
      enabled: firebaseEnabled,
      ...(firebaseEnabled ? firebase : {}),
      testMode: optionalEnv("FIREBASE_PHONE_TEST_MODE") === "true",
    },
  });
}
