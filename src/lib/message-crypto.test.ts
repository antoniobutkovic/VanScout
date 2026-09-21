import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptMessage, encryptMessage, isEncryptedMessage } from "./message-crypto";

const previousKeys = process.env.MESSAGE_ENCRYPTION_KEY;
const keyOne = Buffer.alloc(32, 1).toString("base64");
const keyTwo = Buffer.alloc(32, 2).toString("base64");

describe("message encryption", () => {
  beforeEach(() => { process.env.MESSAGE_ENCRYPTION_KEY = `${keyOne},${keyTwo}`; });
  afterEach(() => {
    if (previousKeys === undefined) delete process.env.MESSAGE_ENCRYPTION_KEY;
    else process.env.MESSAGE_ENCRYPTION_KEY = previousKeys;
  });

  it("round-trips unicode content without exposing plaintext", () => {
    const encrypted = encryptMessage("Pozdrav 👋 — pickup at 17:00");
    expect(isEncryptedMessage(encrypted)).toBe(true);
    expect(encrypted).not.toContain("Pozdrav");
    expect(decryptMessage(encrypted)).toBe("Pozdrav 👋 — pickup at 17:00");
  });

  it("rejects plaintext messages", () => {
    expect(() => decryptMessage("legacy message")).toThrow("Plaintext messages are not supported");
  });

  it("detects ciphertext tampering", () => {
    const encrypted = encryptMessage("private");
    const parts = encrypted.split(":");
    parts[5] = `${parts[5][0] === "A" ? "B" : "A"}${parts[5].slice(1)}`;
    expect(() => decryptMessage(parts.join(":"))).toThrow();
  });
});
