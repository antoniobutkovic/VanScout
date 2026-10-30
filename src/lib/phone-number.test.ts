import { describe, expect, it } from "vitest";
import { normalizePhoneNumber } from "./phone-number";

describe("normalizePhoneNumber", () => {
  it("accepts a possible Croatian mobile number even when its prefix is not allocated in bundled metadata", () => {
    expect(normalizePhoneNumber("HR", "97 455 4556", false)).toBe("+385974554556");
  });

  it("accepts a standard Croatian national number", () => {
    expect(normalizePhoneNumber("HR", "91 234 5678", false)).toBe("+385912345678");
  });

  it("rejects an implausibly short number outside test mode", () => {
    expect(normalizePhoneNumber("HR", "123", false)).toBeNull();
  });
});
