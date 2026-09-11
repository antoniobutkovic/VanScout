import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, PASSWORD_KEY_LENGTH) as Buffer;
  return `scrypt:${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, encodedKey] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !encodedKey) return false;

  const storedKey = Buffer.from(encodedKey, "hex");
  const key = await scrypt(password, salt, storedKey.length) as Buffer;
  return storedKey.length === key.length && timingSafeEqual(storedKey, key);
}

export function createResetToken() {
  return randomBytes(32).toString("hex");
}

export function createVerificationToken() {
  return randomBytes(32).toString("hex");
}
