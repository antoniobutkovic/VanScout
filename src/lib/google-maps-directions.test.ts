import { describe, expect, it } from "vitest";
import { googleMapsDirectionsUrl } from "./google-maps-directions";

describe("googleMapsDirectionsUrl", () => {
  it("creates driving directions from pickup to delivery coordinates", () => {
    expect(googleMapsDirectionsUrl(
      { latitude: 45.8131, longitude: 15.9775 },
      { latitude: 45.7982, longitude: 15.9523 },
    )).toBe("https://www.google.com/maps/dir/?api=1&origin=45.8131%2C15.9775&destination=45.7982%2C15.9523&travelmode=driving");
  });
});
