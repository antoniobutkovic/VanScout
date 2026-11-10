import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ checkRateLimit: vi.fn(), findUserByEmailWithPassword: vi.fn(), createEmailVerification: vi.fn(), sendEmailVerificationEmail: vi.fn() }));
vi.mock("@/lib/password", () => ({ createVerificationCode: () => "123456" }));
vi.mock("@/lib/auth-log", () => ({ authLogContext: async () => ({}), logAuthEvent: vi.fn(), safeErrorName: () => "Error" }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/database", () => ({ findUserByEmailWithPassword: mocks.findUserByEmailWithPassword, createEmailVerification: mocks.createEmailVerification }));
vi.mock("@/lib/mailer", () => ({ sendEmailVerificationEmail: mocks.sendEmailVerificationEmail }));
import { POST } from "./route";

beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, "warn").mockImplementation(() => {}); });
describe("verification resend", () => {
  it("reports rate limiting to the user without looking up the account", async () => {
    mocks.checkRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 42 });
    const response = await POST(new Request("https://example.test/api/auth/email/resend", { method: "POST", body: JSON.stringify({ email: "a@example.com" }) }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(mocks.findUserByEmailWithPassword).not.toHaveBeenCalled();
  });
  it("returns a validation error for malformed JSON", async () => {
    mocks.checkRateLimit.mockReturnValue({ allowed: true });
    const response = await POST(new Request("https://example.test/api/auth/email/resend", { method: "POST", body: "{" }));
    expect(response.status).toBe(400);
  });
});
