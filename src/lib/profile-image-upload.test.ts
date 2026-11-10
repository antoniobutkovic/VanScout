import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareProfileImage, PROFILE_IMAGE_UPLOAD_LIMIT } from "./profile-image-upload";
afterEach(() => vi.unstubAllGlobals());
describe("profile image upload", () => {
  it("keeps a small image unchanged", async () => {
    const file = new File([new Uint8Array(100)], "photo.png", { type: "image/png" });
    expect(await prepareProfileImage(file)).toBe(file);
  });
  it("compresses large images below the per-image upload budget", async () => {
    const original = new File([new Uint8Array(PROFILE_IMAGE_UPLOAD_LIMIT + 1)], "photo.png", { type: "image/png" });
    vi.stubGlobal("URL", { createObjectURL: () => "blob:test", revokeObjectURL: vi.fn() });
    vi.stubGlobal("Image", class { src = ""; naturalWidth = 2400; naturalHeight = 1200; async decode() {} });
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, drawImage() {} }), toBlob: (done: (value: Blob) => void) => done(new Blob([new Uint8Array(3000)], { type: "image/jpeg" })) }) });
    const result = await prepareProfileImage(original);
    expect(result.type).toBe("image/jpeg");
    expect(result.size).toBeLessThanOrEqual(PROFILE_IMAGE_UPLOAD_LIMIT);
  });
  it("rejects unsupported or oversized inputs", async () => {
    await expect(prepareProfileImage(new File(["x"], "note.txt", { type: "text/plain" }))).rejects.toThrow("invalid_image");
  });
});
