import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL?.trim();
const encodedKeys = process.env.MESSAGE_ENCRYPTION_KEY?.split(",").map(value => value.trim()).filter(Boolean) || [];
if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!encodedKeys.length) throw new Error("MESSAGE_ENCRYPTION_KEY is required");

const key = Buffer.from(encodedKeys[0], "base64");
if (key.length !== 32) throw new Error("The active MESSAGE_ENCRYPTION_KEY entry must decode to 32 bytes");
const keyId = createHash("sha256").update(key).digest("hex").slice(0, 16);
const prefix = "vanscout:v1";
const sql = neon(databaseUrl);

await sql.query("ALTER TABLE vanscout_messages DROP CONSTRAINT IF EXISTS vanscout_messages_body_check");
await sql.query(`
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vanscout_messages_encrypted_body_check') THEN
      ALTER TABLE vanscout_messages
        ADD CONSTRAINT vanscout_messages_encrypted_body_check CHECK (LENGTH(body) BETWEEN 1 AND 10000);
    END IF;
  END $$
`);

function encrypt(plaintext) {
  if (!plaintext || plaintext.startsWith(`${prefix}:`)) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(`${prefix}:${keyId}`, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [prefix, keyId, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(":");
}

async function migrateTable({ table, column }) {
  let migrated = 0;
  for (;;) {
    const rows = await sql.query(
      `SELECT id, ${column} AS plaintext FROM ${table} WHERE ${column} <> '' AND ${column} NOT LIKE $1 ORDER BY id LIMIT 250`,
      [`${prefix}:%`],
    );
    if (!rows.length) break;
    for (const row of rows) {
      await sql.query(`UPDATE ${table} SET ${column} = $1 WHERE id = $2 AND ${column} NOT LIKE $3`, [encrypt(String(row.plaintext)), row.id, `${prefix}:%`]);
      migrated += 1;
    }
    process.stdout.write(`Encrypted ${migrated} rows in ${table}\n`);
  }
  return migrated;
}

const chatMessages = await migrateTable({ table: "vanscout_messages", column: "body" });
const offerMessages = await migrateTable({ table: "vanscout_transport_offers", column: "message" });
process.stdout.write(`Encryption migration complete: ${chatMessages} chat messages and ${offerMessages} offer messages.\n`);
