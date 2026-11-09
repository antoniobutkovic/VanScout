import { describe, expect, it } from "vitest";
import { firebasePhoneError, firebasePhoneErrorCode, isRecaptchaError, phoneVerificationApiError } from "./firebase-phone-error";

const croatian = (key: string) => ({
  "Security verification failed. Reload the page and try again.": "Sigurnosna provjera nije uspjela. Osvježite stranicu i pokušajte ponovno.",
  "Too many attempts. Please wait a few minutes before trying again.": "Previše pokušaja. Pričekajte nekoliko minuta prije ponovnog pokušaja.",
}[key] ?? key);

describe("phone verification errors", () => {
  it("translates Firebase reCAPTCHA errors through the active language", () => {
    expect(firebasePhoneError({ code: "auth/captcha-check-failed" }, croatian, "send"))
      .toBe("Sigurnosna provjera nije uspjela. Osvježite stranicu i pokušajte ponovno.");
    expect(firebasePhoneError({ code: "auth/missing-app-credential" }, croatian, "send"))
      .toBe("Sigurnosna provjera nije uspjela. Osvježite stranicu i pokušajte ponovno.");
    expect(firebasePhoneError({ code: "auth/invalid-recaptcha-token" }, croatian, "send"))
      .toBe("Sigurnosna provjera nije uspjela. Osvježite stranicu i pokušajte ponovno.");
  });

  it("normalizes Firebase error codes", () => {
    expect(firebasePhoneErrorCode({ code: "auth/missing-recaptcha-token" })).toBe("auth/missing-recaptcha-token");
    expect(firebasePhoneErrorCode({ code: "database connection details" })).toBe("unknown");
  });

  it("offers a visible challenge for recoverable reCAPTCHA failures", () => {
    expect(isRecaptchaError({ code: "auth/invalid-recaptcha-token" })).toBe(true);
    expect(isRecaptchaError({ code: "auth/quota-exceeded" })).toBe(false);
  });

  it("does not expose raw API errors and translates known rate limits", () => {
    expect(phoneVerificationApiError("Too many phone verification attempts. Try again later.", croatian, "send"))
      .toBe("Previše pokušaja. Pričekajte nekoliko minuta prije ponovnog pokušaja.");
    expect(phoneVerificationApiError("internal detail", croatian, "verify"))
      .toBe("We couldn't verify your phone number right now. Please try again in a moment.");
  });
});
