import { describe, expect, it } from "vitest";
import { googleMapsUrl } from "./google-maps-sharing";

describe("googleMapsUrl", () => {
  it("accepts the Google Maps links a transporter can paste into a conversation", () => {
    expect(googleMapsUrl("https://maps.app.goo.gl/abc123")).toBe("https://maps.app.goo.gl/abc123");
    expect(googleMapsUrl("https://www.google.com/maps?foo=bar")).toBe("https://www.google.com/maps?foo=bar");
  });

  it("rejects non-HTTPS and non-Google Maps links", () => {
    expect(googleMapsUrl("http://maps.google.com/location")).toBeNull();
    expect(googleMapsUrl("https://example.com/maps")).toBeNull();
  });
});
