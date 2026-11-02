import { describe, expect, it } from "vitest";
import { firebasePhoneError, phoneVerificationApiError } from "./firebase-phone-error";

const croatian = (key: string) => ({
  "Security verification failed. Reload the page and try again.": "Sigurnosna provjera nije uspjela. Osvježite stranicu i pokušajte ponovno.",
  "Too many attempts. Please wait a few minutes before trying again.": "Previše pokušaja. Pričekajte nekoliko minuta prije ponovnog pokušaja.",
}[key] ?? key);

describe("phone verification errors", () => {
  it("translates Firebase reCAPTCHA errors through the active language", () => {
    expect(firebasePhoneError({ code: "auth/captcha-check-failed" }, croatian, "send"))
      .toBe("Sigurnosna provjera nije uspjela. Osvježite stranicu i pokušajte ponovno.");
  });

  it("does not expose raw API errors and translates known rate limits", () => {
    expect(phoneVerificationApiError("Too many phone verification attempts. Try again later.", croatian, "send"))
      .toBe("Previše pokušaja. Pričekajte nekoliko minuta prije ponovnog pokušaja.");
    expect(phoneVerificationApiError("internal detail", croatian, "verify"))
      .toBe("We couldn't verify your phone number right now. Please try again in a moment.");
  });
});
