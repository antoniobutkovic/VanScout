import { afterEach, describe, expect, it, vi } from "vitest";
import { authLogContext, logAuthEvent } from "./auth-log";

const originalSecret = process.env.JWT_SECRET;
afterEach(() => { process.env.JWT_SECRET = originalSecret; vi.restoreAllMocks(); });

function request(email: string, password = "private-password") {
  return new Request("https://example.test/api/auth", { method: "POST", headers: { "x-vercel-id": "fra1::abc-123" }, body: JSON.stringify({ email, password, code: "123456" }) });
}

describe("auth diagnostics", () => {
  it("correlates normalized email without emitting credentials or the email", async () => {
    process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";
    const first = await authLogContext(request("  Person@Example.com "));
    const second = await authLogContext(request("person@example.com"));
    const other = await authLogContext(request("other@example.com"));
    expect(first.account).toBe(second.account);
    expect(first.account).toBeTruthy();
    expect(first.account).not.toBe(other.account);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logAuthEvent(first, "email_verification", "invalid_input", { status: 400 });
    const output = JSON.stringify(warn.mock.calls);
    expect(output).not.toContain("Person@Example.com");
    expect(output).not.toContain("private-password");
    expect(output).not.toContain("123456");
  });

  it("does not create a reversible or unkeyed identifier without a strong secret", async () => {
    delete process.env.JWT_SECRET;
    expect((await authLogContext(request("person@example.com"))).account).toBeUndefined();
  });
});
