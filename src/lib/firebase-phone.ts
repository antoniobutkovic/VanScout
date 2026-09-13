import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const APP_NAME = "vanscout-phone-auth";

export type FirebasePhoneConfig = FirebaseOptions & {
  testMode: boolean;
};

export function getFirebasePhoneAuth(config: FirebasePhoneConfig): Auth {
  const app = getApps().some(candidate => candidate.name === APP_NAME)
    ? getApp(APP_NAME)
    : initializeApp(config, APP_NAME);
  const auth = getAuth(app);

  // Firebase's test mode accepts only fictional numbers configured in the
  // Firebase console. It never sends an SMS and should never be enabled in
  // staging or production.
  auth.settings.appVerificationDisabledForTesting = config.testMode;
  return auth;
}
