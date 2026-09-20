import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

export type FirebasePhoneConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  testMode: boolean;
};

export function getFirebasePhoneAuth(config: FirebasePhoneConfig): Auth {
  // Include the Firebase project in the app name. This prevents a stale app
  // instance from a previous environment (for example staging after local
  // development) from reusing the wrong project's auth settings.
  const appName = `vanscout-phone-auth-${config.projectId}`;
  const app = getApps().some(candidate => candidate.name === appName)
    ? getApp(appName)
    : initializeApp(config, appName);
  const auth = getAuth(app);

  // Firebase's test mode accepts only fictional numbers configured in the
  // Firebase console. It never sends an SMS and must be disabled before real
  // users are allowed to verify their numbers.
  auth.settings.appVerificationDisabledForTesting = config.testMode;
  return auth;
}
