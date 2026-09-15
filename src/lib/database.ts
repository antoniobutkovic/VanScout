import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import type { GoogleIdentity } from "./google";
import { requiredEnv } from "./config";

export type AccountRole = "requester" | "transporter";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: AccountRole;
  phoneNumber: string | null;
  phoneVerified: boolean;
};

function database() {
  return neon(requiredEnv("DATABASE_URL"));
}

export function sqlClient() {
  return database();
}

let schemaReady: Promise<void> | null = null;

async function ensureSchema() {
  if (!schemaReady) {
    const sql = database();
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS vanscout_users (
        id TEXT PRIMARY KEY,
        google_subject TEXT UNIQUE,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        avatar_url TEXT,
        password_hash TEXT,
        email_verified_at TIMESTAMPTZ,
        phone_number TEXT UNIQUE,
        phone_verified_at TIMESTAMPTZ,
        role TEXT NOT NULL DEFAULT 'requester' CHECK (role IN ('requester', 'transporter')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `.then(async () => {
      await sql`ALTER TABLE vanscout_users ALTER COLUMN google_subject DROP NOT NULL`;
      await sql`ALTER TABLE vanscout_users ADD COLUMN IF NOT EXISTS password_hash TEXT`;
      await sql`ALTER TABLE vanscout_users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ`;
      await sql`ALTER TABLE vanscout_users ADD COLUMN IF NOT EXISTS first_name TEXT`;
      await sql`ALTER TABLE vanscout_users ADD COLUMN IF NOT EXISTS last_name TEXT`;
      await sql`ALTER TABLE vanscout_users ADD COLUMN IF NOT EXISTS phone_number TEXT`;
      await sql`ALTER TABLE vanscout_users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS vanscout_users_phone_number_unique ON vanscout_users (phone_number) WHERE phone_number IS NOT NULL`;
      await sql`UPDATE vanscout_users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE google_subject IS NOT NULL`;
      await sql`
        CREATE TABLE IF NOT EXISTS vanscout_email_verifications (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES vanscout_users(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL,
          failed_attempts INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`ALTER TABLE vanscout_email_verifications ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0`;
      await sql`
        CREATE TABLE IF NOT EXISTS vanscout_password_resets (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES vanscout_users(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS vanscout_todos (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES vanscout_users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          done BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
    }).catch(error => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

export async function ensureDatabaseSchema() {
  await ensureSchema();
}

function toUser(row: Record<string, unknown>): AppUser {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    firstName: typeof row.first_name === "string" ? row.first_name : String(row.name).split(" ")[0] || "",
    lastName: typeof row.last_name === "string" ? row.last_name : String(row.name).split(" ").slice(1).join(" "),
    avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
    role: row.role === "transporter" ? "transporter" : "requester",
    phoneNumber: typeof row.phone_number === "string" ? row.phone_number : null,
    phoneVerified: row.phone_verified_at instanceof Date || typeof row.phone_verified_at === "string",
  };
}

export async function upsertGoogleUser(identity: GoogleIdentity, role?: AccountRole): Promise<AppUser> {
  await ensureSchema();
  const sql = database();
  const selectedRole = role || "requester";
  const [firstName = identity.name, ...lastNameParts] = identity.name.trim().split(/\s+/);
  const rows = await sql`
    INSERT INTO vanscout_users (id, google_subject, email, name, first_name, last_name, avatar_url, email_verified_at, role)
    VALUES (${randomUUID()}, ${identity.subject}, ${identity.email}, ${identity.name}, ${firstName}, ${lastNameParts.join(" ")}, ${identity.avatarUrl}, NOW(), ${selectedRole})
    ON CONFLICT (google_subject) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      avatar_url = EXCLUDED.avatar_url,
      email_verified_at = NOW(),
      role = CASE WHEN CAST(${role || null} AS TEXT) IS NULL THEN vanscout_users.role ELSE EXCLUDED.role END,
      updated_at = NOW()
    RETURNING id, email, name, first_name, last_name, avatar_url, role, phone_number, phone_verified_at
  `;
  return toUser(rows[0] as Record<string, unknown>);
}

export async function findUserById(id: string): Promise<AppUser | null> {
  await ensureSchema();
  const sql = database();
  const rows = await sql`
    SELECT id, email, name, first_name, last_name, avatar_url, role, phone_number, phone_verified_at
    FROM vanscout_users
    WHERE id = ${id}
      AND email_verified_at IS NOT NULL
    LIMIT 1
  `;
  return rows[0] ? toUser(rows[0] as Record<string, unknown>) : null;
}

export async function findUserByEmailWithPassword(email: string) {
  await ensureSchema();
  const sql = database();
  const rows = await sql`
    SELECT id, email, name, first_name, last_name, avatar_url, role, phone_number, phone_verified_at, password_hash, email_verified_at
    FROM vanscout_users
    WHERE LOWER(email) = LOWER(${email.trim()})
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return {
    user: toUser(rows[0] as Record<string, unknown>),
    passwordHash: typeof rows[0].password_hash === "string" ? rows[0].password_hash : null,
    emailVerified: rows[0].email_verified_at instanceof Date || typeof rows[0].email_verified_at === "string",
  };
}

export async function createPasswordUser(email: string, passwordHash: string, role: AccountRole, firstName: string, lastName: string) {
  await ensureSchema();
  const sql = database();
  const normalizedEmail = email.trim().toLowerCase();
  const rows = await sql`
    INSERT INTO vanscout_users (id, email, name, first_name, last_name, password_hash, role)
    VALUES (${randomUUID()}, ${normalizedEmail}, ${`${firstName.trim()} ${lastName.trim()}`}, ${firstName.trim()}, ${lastName.trim()}, ${passwordHash}, ${role})
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email, name, first_name, last_name, avatar_url, role, phone_number, phone_verified_at
  `;
  return rows[0] ? toUser(rows[0] as Record<string, unknown>) : null;
}

export async function createEmailVerification(userId: string, tokenHash: string) {
  await ensureSchema();
  const sql = database();
  await sql`DELETE FROM vanscout_email_verifications WHERE user_id = ${userId}`;
  await sql`
    INSERT INTO vanscout_email_verifications (token_hash, user_id, expires_at)
    VALUES (${tokenHash}, ${userId}, NOW() + INTERVAL '15 minutes')
  `;
}

export async function verifyEmail(tokenHash: string, email?: string) {
  await ensureSchema();
  const sql = database();
  const rows = email ? await sql`
      WITH consumed AS (
        DELETE FROM vanscout_email_verifications
        WHERE token_hash = ${tokenHash}
          AND expires_at > NOW()
          AND failed_attempts < 5
          AND user_id IN (SELECT id FROM vanscout_users WHERE LOWER(email) = LOWER(${email}))
        RETURNING user_id
      )
      UPDATE vanscout_users
      SET email_verified_at = NOW(), updated_at = NOW()
      WHERE id IN (SELECT user_id FROM consumed)
      RETURNING id, email, name, first_name, last_name, avatar_url, role, phone_number, phone_verified_at
    ` : await sql`
      WITH consumed AS (
        DELETE FROM vanscout_email_verifications
        WHERE token_hash = ${tokenHash}
          AND expires_at > NOW()
          AND failed_attempts < 5
        RETURNING user_id
      )
      UPDATE vanscout_users
      SET email_verified_at = NOW(), updated_at = NOW()
      WHERE id IN (SELECT user_id FROM consumed)
      RETURNING id, email, name, first_name, last_name, avatar_url, role, phone_number, phone_verified_at
    `;
  if (rows[0]) return toUser(rows[0] as Record<string, unknown>);
  if (email) {
    await sql`
      UPDATE vanscout_email_verifications
      SET failed_attempts = failed_attempts + 1
      WHERE user_id IN (SELECT id FROM vanscout_users WHERE LOWER(email) = LOWER(${email}))
        AND expires_at > NOW()
        AND failed_attempts < 5
    `;
  }
  return null;
}

export async function verifyUserPhone(userId: string, phoneNumber: string) {
  await ensureSchema();
  const sql = database();
  const rows = await sql`
    UPDATE vanscout_users
    SET phone_number = ${phoneNumber}, phone_verified_at = NOW(), updated_at = NOW()
    WHERE id = ${userId}
    RETURNING id, email, name, first_name, last_name, avatar_url, role, phone_number, phone_verified_at
  `;
  return rows[0] ? toUser(rows[0] as Record<string, unknown>) : null;
}

export async function createPasswordReset(email: string, tokenHash: string) {
  await ensureSchema();
  const sql = database();
  const rows = await sql`
    SELECT id, email
    FROM vanscout_users
    WHERE LOWER(email) = LOWER(${email.trim()})
    LIMIT 1
  `;
  if (!rows[0]) return null;

  await sql`DELETE FROM vanscout_password_resets WHERE user_id = ${rows[0].id}`;
  await sql`
    INSERT INTO vanscout_password_resets (token_hash, user_id, expires_at)
    VALUES (${tokenHash}, ${rows[0].id}, NOW() + INTERVAL '1 hour')
  `;
  return { id: String(rows[0].id), email: String(rows[0].email) };
}

export async function resetUserPassword(tokenHash: string, passwordHash: string) {
  await ensureSchema();
  const sql = database();
  const rows = await sql`
    SELECT user_id
    FROM vanscout_password_resets
    WHERE token_hash = ${tokenHash}
      AND expires_at > NOW()
    LIMIT 1
  `;
  if (!rows[0]) return false;

  await sql`
    UPDATE vanscout_users
    SET password_hash = ${passwordHash}, updated_at = NOW()
    WHERE id = ${rows[0].user_id}
  `;
  await sql`DELETE FROM vanscout_password_resets WHERE token_hash = ${tokenHash}`;
  return true;
}
