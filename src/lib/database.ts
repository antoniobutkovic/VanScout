import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import type { GoogleIdentity } from "./google";
import { requiredEnv } from "./config";

export type AccountRole = "requester" | "transporter";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: AccountRole;
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
        avatar_url TEXT,
        password_hash TEXT,
        role TEXT NOT NULL DEFAULT 'requester' CHECK (role IN ('requester', 'transporter')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `.then(async () => {
      await sql`ALTER TABLE vanscout_users ALTER COLUMN google_subject DROP NOT NULL`;
      await sql`ALTER TABLE vanscout_users ADD COLUMN IF NOT EXISTS password_hash TEXT`;
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
    avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
    role: row.role === "transporter" ? "transporter" : "requester",
  };
}

export async function upsertGoogleUser(identity: GoogleIdentity, role: AccountRole): Promise<AppUser> {
  await ensureSchema();
  const sql = database();
  const rows = await sql`
    INSERT INTO vanscout_users (id, google_subject, email, name, avatar_url, role)
    VALUES (${randomUUID()}, ${identity.subject}, ${identity.email}, ${identity.name}, ${identity.avatarUrl}, ${role})
    ON CONFLICT (google_subject) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      avatar_url = EXCLUDED.avatar_url,
      role = EXCLUDED.role,
      updated_at = NOW()
    RETURNING id, email, name, avatar_url, role
  `;
  return toUser(rows[0] as Record<string, unknown>);
}

export async function findUserById(id: string): Promise<AppUser | null> {
  await ensureSchema();
  const sql = database();
  const rows = await sql`
    SELECT id, email, name, avatar_url, role
    FROM vanscout_users
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] ? toUser(rows[0] as Record<string, unknown>) : null;
}

export async function findUserByEmailWithPassword(email: string) {
  await ensureSchema();
  const sql = database();
  const rows = await sql`
    SELECT id, email, name, avatar_url, role, password_hash
    FROM vanscout_users
    WHERE LOWER(email) = LOWER(${email.trim()})
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return {
    user: toUser(rows[0] as Record<string, unknown>),
    passwordHash: typeof rows[0].password_hash === "string" ? rows[0].password_hash : null,
  };
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
