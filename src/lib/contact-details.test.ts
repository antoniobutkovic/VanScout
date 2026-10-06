import { describe, expect, it } from "vitest";
import { hasRestrictedContactDetails } from "./contact-details";

describe("contact detail restriction", () => {
  it.each([
    "Call me on +385 91 555 2400",
    "My number is 091 555 2400",
    "Reach me at 00385 (91) 555-2400",
    "Call 0912345678",
    "Call \u0660\u0669\u0661 \u0665\u0665\u0665 \u0662\u0664\u0660\u0660",
    "me@example.com",
    "https://example.com/contact",
    "www.example.com",
    "wa.me/385915552400",
  ])("blocks %s", value => {
    expect(hasRestrictedContactDetails(value)).toBe(true);
  });

  it.each([
    "I can collect this on 12.10.2026.",
    "Pickup works from 17:00 to 19:00.",
    "The wardrobe is 200 cm tall.",
    "I can bring two people to help.",
  ])("allows ordinary transport details: %s", value => {
    expect(hasRestrictedContactDetails(value)).toBe(false);
  });
});
