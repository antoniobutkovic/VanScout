import { describe, expect, it } from "vitest";

process.env.JWT_SECRET = "vanscout-test-secret-with-at-least-32-characters";

import { createGoogleRegistrationToken, createSessionToken, verifyGoogleRegistrationToken, verifySessionToken } from "./session";

describe("session tokens", () => {
  it("round-trips the authenticated user id", async () => {
    const token = await createSessionToken({ id: "user-1", email: "ana@example.com", role: "requester" });
    await expect(verifySessionToken(token)).resolves.toEqual({ userId: "user-1" });
  });

  it("round-trips a pending Google registration without making it a session", async () => {
    const identity = { subject: "google-1", email: "ana@example.com", name: "Ana Novak", avatarUrl: "https://example.com/ana.jpg" };
    const token = await createGoogleRegistrationToken(identity);

    await expect(verifyGoogleRegistrationToken(token)).resolves.toEqual(identity);
    await expect(verifySessionToken(token)).rejects.toThrow();
  });
});
