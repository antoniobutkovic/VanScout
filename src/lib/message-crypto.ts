import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { requiredEnv } from "./config";

const PREFIX = "vanscout:v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

type EncryptionKey = { id: string; value: Buffer };

let cachedSource: string | null = null;
let cachedKeys: EncryptionKey[] = [];

function encryptionKeys(): EncryptionKey[] {
  const source = requiredEnv("MESSAGE_ENCRYPTION_KEY");
  if (source === cachedSource) return cachedKeys;

  const keys = source.split(",").map(encoded => encoded.trim()).filter(Boolean).map(encoded => {
    const value = Buffer.from(encoded, "base64");
    if (value.length !== 32) throw new Error("Each MESSAGE_ENCRYPTION_KEY entry must be a base64-encoded 32-byte key");
    return { id: createHash("sha256").update(value).digest("hex").slice(0, 16), value };
  });
  if (!keys.length) throw new Error("MESSAGE_ENCRYPTION_KEY must contain at least one key");
  if (new Set(keys.map(key => key.id)).size !== keys.length) throw new Error("MESSAGE_ENCRYPTION_KEY contains duplicate keys");

  cachedSource = source;
  cachedKeys = keys;
  return keys;
}

export function isEncryptedMessage(value: string) {
  return value.startsWith(`${PREFIX}:`);
}

export function encryptMessage(plaintext: string): string {
  if (!plaintext || isEncryptedMessage(plaintext)) return plaintext;
  const [activeKey] = encryptionKeys();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", activeKey.value, iv);
  cipher.setAAD(Buffer.from(`${PREFIX}:${activeKey.id}`, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, activeKey.id, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function decryptMessage(value: string): string {
  if (!value) return value;
  if (!isEncryptedMessage(value)) {
    throw new Error("Plaintext messages are not supported");
  }
  const parts = value.split(":");
  if (parts.length !== 6 || `${parts[0]}:${parts[1]}` !== PREFIX) throw new Error("Invalid encrypted message format");
  const [, , keyId, encodedIv, encodedTag, ...encodedCiphertextParts] = parts;
  const key = encryptionKeys().find(candidate => candidate.id === keyId);
  if (!key) throw new Error(`Message encryption key ${keyId} is not configured`);

  const iv = Buffer.from(encodedIv, "base64url");
  const tag = Buffer.from(encodedTag, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new Error("Invalid encrypted message parameters");
  const ciphertext = Buffer.from(encodedCiphertextParts.join(":"), "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key.value, iv);
  decipher.setAAD(Buffer.from(`${PREFIX}:${key.id}`, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
