type Translate = (key: string) => string;

type PhoneVerificationAction = "send" | "verify";

const firebaseErrorKeys: Record<string, string> = {
  "auth/invalid-phone-number": "Enter a valid mobile number for the selected country",
  "auth/missing-phone-number": "Enter a valid mobile number for the selected country",
  "auth/invalid-verification-code": "The verification code is incorrect",
  "auth/invalid-credential": "The verification code is invalid or expired. Request a new code and try again.",
  "auth/code-expired": "The verification code has expired. Send a new code.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes before trying again.",
  "auth/quota-exceeded": "We can't send another code to this number right now. Please try again later.",
  "auth/network-request-failed": "Check your internet connection and try again.",
  "auth/captcha-check-failed": "Security verification failed. Reload the page and try again.",
  "auth/invalid-app-credential": "Phone verification could not be started. Reload the page and try again.",
  // Firebase returns these variants when its invisible reCAPTCHA token is
  // missing, expired, or rejected. They are all recoverable by creating a
  // fresh verifier after the page is reloaded.
  "auth/missing-app-credential": "Security verification failed. Reload the page and try again.",
  "auth/missing-recaptcha-token": "Security verification failed. Reload the page and try again.",
  "auth/invalid-recaptcha-token": "Security verification failed. Reload the page and try again.",
  "auth/invalid-recaptcha-action": "Security verification failed. Reload the page and try again.",
  "auth/missing-recaptcha-version": "Security verification failed. Reload the page and try again.",
  "auth/invalid-recaptcha-version": "Security verification failed. Reload the page and try again.",
  "auth/missing-client-type": "Security verification failed. Reload the page and try again.",
  "auth/recaptcha-not-enabled": "Phone verification is not available. Please contact support.",
  "auth/web-storage-unsupported": "Security verification failed. Reload the page and try again.",
  "auth/operation-not-supported-in-this-environment": "Phone verification could not be started. Reload the page and try again.",
  "auth/operation-not-allowed": "Phone verification is not available. Please contact support.",
  "auth/app-not-authorized": "Phone verification is not available on this website yet.",
};

const apiErrorKeys: Record<string, string> = {
  "Too many phone verification attempts. Try again later.": "Too many attempts. Please wait a few minutes before trying again.",
  "Enter a valid international phone number": "Enter a valid mobile number for the selected country",
  Unauthorized: "Your session has expired. Please sign in again.",
  "Phone verification unavailable": "Phone verification is temporarily unavailable. Please try again later.",
  "Phone verification token is required": "We couldn't verify your phone number right now. Please try again in a moment.",
  "Name and account type are required": "Please enter your name and choose an account type.",
  "This phone number is already used by another account": "This phone number is already linked to an account.",
};

function fallbackKey(action: PhoneVerificationAction) {
  return action === "send"
    ? "We couldn't send a verification code right now. Please try again in a moment."
    : "We couldn't verify your phone number right now. Please try again in a moment.";
}

export function firebasePhoneError(error: unknown, translate: Translate, action: PhoneVerificationAction) {
  const code = firebasePhoneErrorCode(error);
  return translate(firebaseErrorKeys[code] ?? fallbackKey(action));
}

const recaptchaErrorCodes = new Set([
  "auth/captcha-check-failed",
  "auth/invalid-app-credential",
  "auth/missing-app-credential",
  "auth/missing-recaptcha-token",
  "auth/invalid-recaptcha-token",
  "auth/invalid-recaptcha-action",
  "auth/missing-recaptcha-version",
  "auth/invalid-recaptcha-version",
  "auth/missing-client-type",
]);

/**
 * Normalizes a Firebase Auth error to its stable short identifier. Provider
 * messages are intentionally ignored because they are not suitable for UI
 * matching and can change between SDK releases.
 */
export function firebasePhoneErrorCode(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  return /^auth\/[a-z0-9-]{1,80}$/.test(code) ? code : "unknown";
}

export function isRecaptchaError(error: unknown) {
  return recaptchaErrorCodes.has(firebasePhoneErrorCode(error));
}

export function phoneVerificationApiError(message: unknown, translate: Translate, action: PhoneVerificationAction) {
  return translate(typeof message === "string" ? apiErrorKeys[message] ?? fallbackKey(action) : fallbackKey(action));
}

export function isInvalidPhoneError(error: unknown) {
  const code = firebasePhoneErrorCode(error);
  return code === "auth/invalid-phone-number" || code === "auth/missing-phone-number";
}
