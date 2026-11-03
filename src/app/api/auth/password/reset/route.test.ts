import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  hashPassword: vi.fn(),
  resetUserPassword: vi.fn(),
}));

vi.mock("@/lib/database", () => ({ resetUserPassword: mocks.resetUserPassword }));
vi.mock("@/lib/password", () => ({ hashPassword: mocks.hashPassword }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit }));

import { POST } from "./route";

beforeEach(() => {
  mocks.checkRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
  mocks.hashPassword.mockResolvedValue("stored-password-hash");
  mocks.resetUserPassword.mockResolvedValue(true);
});

describe("password reset", () => {
  it("hashes the URL token before matching it against the stored reset token", async () => {
    const token = "reset-token-from-email";
    const response = await POST(new Request("https://vanscout.test/api/auth/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: "a-password-with-12-characters", passwordConfirmation: "a-password-with-12-characters" }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.resetUserPassword).toHaveBeenCalledWith(
      createHash("sha256").update(token).digest("hex"),
      "stored-password-hash",
    );
  });
});
