import { describe, expect, it } from "vitest";
import { isRequestPublishReturnPath } from "./request-draft";

describe("request publish return path", () => {
  it("allows only the completed request flow to resume after authentication", () => {
    expect(isRequestPublishReturnPath("/create-request?step=5&publish=1")).toBe(true);
    expect(isRequestPublishReturnPath("/create-request?publish=1&step=5")).toBe(true);
  });

  it("rejects other internal and external return destinations", () => {
    expect(isRequestPublishReturnPath("/create-request?step=4&publish=1")).toBe(false);
    expect(isRequestPublishReturnPath("https://example.com/create-request?step=5&publish=1")).toBe(false);
  });
});
