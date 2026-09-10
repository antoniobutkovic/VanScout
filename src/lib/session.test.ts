import { describe, expect, it } from "vitest";

process.env.JWT_SECRET = "vanscout-test-secret-with-at-least-32-characters";

import { createSessionToken, verifySessionToken } from "./session";

describe("session tokens", () => {
  it("round-trips the authenticated user id", async () => {
    const token = await createSessionToken({ id: "user-1", email: "ana@example.com", role: "requester" });
    await expect(verifySessionToken(token)).resolves.toEqual({ userId: "user-1" });
  });
});
