import { describe, expect, it } from "vitest";
import { languageFromAcceptLanguage, languageFromBrowser, languageFromCountry } from "./language";

describe("language negotiation", () => {
  it("uses Croatian when it is the user's preferred browser language", () => {
    expect(languageFromBrowser(["hr-HR", "en-GB"])).toBe("hr");
    expect(languageFromAcceptLanguage("hr-HR,hr;q=0.9,en;q=0.8")).toBe("hr");
  });

  it("uses the first supported browser language", () => {
    expect(languageFromBrowser(["en-GB", "hr-HR"])).toBe("en");
    expect(languageFromAcceptLanguage("en-GB,hr-HR;q=0.9")).toBe("en");
  });

  it("falls back to the Croatian regional default when available", () => {
    expect(languageFromCountry("hr")).toBe("hr");
    expect(languageFromAcceptLanguage("de-HR,de;q=0.9")).toBe("hr");
  });
});
