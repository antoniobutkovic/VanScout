import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const APP_NAME = "vanscout-phone-auth";

export type FirebasePhoneConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  testMode: boolean;
};

export function getFirebasePhoneAuth(config: FirebasePhoneConfig): Auth {
  const app = getApps().some(candidate => candidate.name === APP_NAME)
    ? getApp(APP_NAME)
    : initializeApp(config, APP_NAME);
  const auth = getAuth(app);

  // Firebase's test mode accepts only fictional numbers configured in the
  // Firebase console. It never sends an SMS and must be disabled before real
  // users are allowed to verify their numbers.
  auth.settings.appVerificationDisabledForTesting = config.testMode;
  return auth;
}
