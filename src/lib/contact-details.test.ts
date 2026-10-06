import { describe, expect, it } from "vitest";
import { hasDistributedPhoneNumber, hasRestrictedContactDetails } from "./contact-details";

describe("contact detail restriction", () => {
  it.each([
    "Call me on +385 91 555 2400",
    "My number is 091 555 2400",
    "097 655109 7",
    "Reach me at 00385 (91) 555-2400",
    "Call 0912345678",
    "Call \u0660\u0669\u0661 \u0665\u0665\u0665 \u0662\u0664\u0660\u0660",
    "zero nine sevent six five five one zero nine",
    "nula devet sedam šest pet pet jedan nula devet",
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

  it("blocks a phone number split between consecutive messages", () => {
    expect(hasDistributedPhoneNumber(["097", "655109", "7"])).toBe(true);
  });

  it("blocks a number spelled across consecutive messages", () => {
    expect(hasDistributedPhoneNumber(["zero nine seven", "six five five", "one zero nine"])).toBe(true);
  });

  it("allows date fragments split between consecutive messages", () => {
    expect(hasDistributedPhoneNumber(["12", "10", "2026"])).toBe(false);
  });

  it("does not combine ordinary prose from separate messages", () => {
    expect(hasDistributedPhoneNumber(["I can arrive at 17", "and leave at 00"])).toBe(false);
  });
});
