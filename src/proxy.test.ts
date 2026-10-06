import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

function request(headers: HeadersInit) {
  return new NextRequest("http://internal-vanscout:3100/api/auth/google", {
    method: "POST",
    headers,
  });
}

describe("API cross-site guard", () => {
  it("accepts the public origin supplied by a reverse proxy", () => {
    const response = proxy(request({
      origin: "https://www.van-scout.com",
      host: "internal-vanscout:3100",
      "x-forwarded-host": "www.van-scout.com",
      "x-forwarded-proto": "https",
    }));

    expect(response.status).toBe(200);
  });

  it("still rejects a different origin", async () => {
    const response = proxy(request({
      origin: "https://attacker.example",
      host: "internal-vanscout:3100",
      "x-forwarded-host": "www.van-scout.com",
      "x-forwarded-proto": "https",
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Cross-site request rejected" });
  });
});
