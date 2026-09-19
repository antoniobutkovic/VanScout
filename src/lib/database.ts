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
      await sql`
        CREATE TABLE IF NOT EXISTS vanscout_email_verifications (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES vanscout_users(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL,
          failed_attempts INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
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
      await sql`
        CREATE TABLE IF NOT EXISTS vanscout_transport_requests (
          id TEXT PRIMARY KEY,
          requester_id TEXT NOT NULL REFERENCES vanscout_users(id) ON DELETE CASCADE,
          category TEXT NOT NULL,
          item_name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          length_cm DOUBLE PRECISION NOT NULL CHECK (length_cm > 0),
          width_cm DOUBLE PRECISION NOT NULL CHECK (width_cm > 0),
          weight_kg DOUBLE PRECISION NOT NULL CHECK (weight_kg > 0),
          pickup_formatted TEXT NOT NULL,
          pickup_latitude DOUBLE PRECISION NOT NULL,
          pickup_longitude DOUBLE PRECISION NOT NULL,
          delivery_formatted TEXT NOT NULL,
          delivery_latitude DOUBLE PRECISION NOT NULL,
          delivery_longitude DOUBLE PRECISION NOT NULL,
          timing TEXT NOT NULL,
          preferred_date DATE,
          preferred_date_to DATE,
          status TEXT NOT NULL DEFAULT 'looking_for_carriers' CHECK (status IN ('looking_for_carriers', 'carrier_booked', 'completed')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS vanscout_transport_requests_requester_created_idx ON vanscout_transport_requests (requester_id, created_at DESC)`;
      await sql`
        CREATE TABLE IF NOT EXISTS vanscout_request_draft_images (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES vanscout_users(id) ON DELETE CASCADE,
          transport_request_id TEXT REFERENCES vanscout_transport_requests(id) ON DELETE CASCADE,
          filename TEXT NOT NULL,
          content_type TEXT NOT NULL,
          image_data BYTEA NOT NULL,
          position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 2),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS vanscout_request_draft_images_draft_position_idx ON vanscout_request_draft_images (user_id, position) WHERE transport_request_id IS NULL`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS vanscout_request_images_transport_position_idx ON vanscout_request_draft_images (transport_request_id, position) WHERE transport_request_id IS NOT NULL`;
      await sql`
        CREATE TABLE IF NOT EXISTS vanscout_carrier_profiles (
          carrier_id TEXT PRIMARY KEY REFERENCES vanscout_users(id) ON DELETE CASCADE,
          company_name TEXT NOT NULL DEFAULT '',
          bio TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS vanscout_carrier_profile_images (
          id TEXT PRIMARY KEY,
          carrier_id TEXT NOT NULL REFERENCES vanscout_users(id) ON DELETE CASCADE,
          filename TEXT NOT NULL,
          content_type TEXT NOT NULL,
          image_data BYTEA NOT NULL,
          position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 2),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (carrier_id, position)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS vanscout_transport_offers (
          id TEXT PRIMARY KEY,
          transport_request_id TEXT NOT NULL REFERENCES vanscout_transport_requests(id) ON DELETE CASCADE,
          carrier_id TEXT NOT NULL REFERENCES vanscout_users(id) ON DELETE CASCADE,
          price_cents INTEGER NOT NULL CHECK (price_cents > 0),
          available_date DATE NOT NULL,
          message TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
          carrier_agreed_at TIMESTAMPTZ,
          confirmed_at TIMESTAMPTZ,
          commission_cents INTEGER NOT NULL DEFAULT 0 CHECK (commission_cents >= 0),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (transport_request_id, carrier_id)
        )
      `;
      // Keep databases created by earlier marketplace versions compatible with
      // the agreement and credits flows. `CREATE TABLE IF NOT EXISTS` does not
      // add columns to an existing table, so apply these additive changes
      // idempotently before any marketplace query runs.
      await sql`ALTER TABLE vanscout_transport_offers ADD COLUMN IF NOT EXISTS carrier_agreed_at TIMESTAMPTZ`;
      await sql`ALTER TABLE vanscout_transport_offers ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ`;
      await sql`ALTER TABLE vanscout_transport_offers ADD COLUMN IF NOT EXISTS commission_cents INTEGER NOT NULL DEFAULT 0 CHECK (commission_cents >= 0)`;
      await sql`CREATE INDEX IF NOT EXISTS vanscout_transport_offers_transport_idx ON vanscout_transport_offers (transport_request_id, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS vanscout_transport_offers_carrier_idx ON vanscout_transport_offers (carrier_id, created_at DESC)`;
      // Older databases may have been created before the composite foreign key
      // was introduced. `CREATE TABLE IF NOT EXISTS` does not update an
      // existing table, so make the referenced key available before creating
      // the selections table. `id` is already unique, making this index safe
      // to add to both old and fresh databases.
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS vanscout_transport_offers_id_transport_idx ON vanscout_transport_offers (id, transport_request_id)`;
      await sql`
        CREATE TABLE IF NOT EXISTS vanscout_transport_selections (
          transport_request_id TEXT PRIMARY KEY REFERENCES vanscout_transport_requests(id) ON DELETE CASCADE,
          offer_id TEXT NOT NULL UNIQUE,
          selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          FOREIGN KEY (offer_id, transport_request_id)
            REFERENCES vanscout_transport_offers(id, transport_request_id) ON DELETE CASCADE
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS vanscout_carrier_credit_accounts (
          carrier_id TEXT PRIMARY KEY REFERENCES vanscout_users(id) ON DELETE CASCADE,
          balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS vanscout_credit_purchases (
          id TEXT PRIMARY KEY,
          carrier_id TEXT NOT NULL REFERENCES vanscout_users(id) ON DELETE CASCADE,
          amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
          currency TEXT NOT NULL DEFAULT 'eur' CHECK (currency = 'eur'),
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired')),
          stripe_checkout_session_id TEXT UNIQUE,
          stripe_payment_intent_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          paid_at TIMESTAMPTZ
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS vanscout_credit_transactions (
          id TEXT PRIMARY KEY,
          carrier_id TEXT NOT NULL REFERENCES vanscout_users(id) ON DELETE CASCADE,
          amount_cents INTEGER NOT NULL CHECK (amount_cents <> 0),
          kind TEXT NOT NULL CHECK (kind IN ('purchase', 'commission', 'refund', 'adjustment')),
          description TEXT NOT NULL,
          offer_id TEXT UNIQUE REFERENCES vanscout_transport_offers(id) ON DELETE SET NULL,
          credit_purchase_id TEXT UNIQUE REFERENCES vanscout_credit_purchases(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS vanscout_credit_transactions_carrier_created_idx ON vanscout_credit_transactions (carrier_id, created_at DESC)`;
      await sql`
        CREATE TABLE IF NOT EXISTS vanscout_messages (
          id TEXT PRIMARY KEY,
          offer_id TEXT NOT NULL REFERENCES vanscout_transport_offers(id) ON DELETE CASCADE,
          sender_id TEXT NOT NULL REFERENCES vanscout_users(id) ON DELETE CASCADE,
          body TEXT NOT NULL CHECK (LENGTH(body) BETWEEN 1 AND 2000),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS vanscout_messages_offer_created_idx ON vanscout_messages (offer_id, created_at ASC)`;
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

export async function findUserByGoogleIdentity(identity: GoogleIdentity): Promise<AppUser | null> {
  await ensureSchema();
  const sql = database();
  const rows = await sql`
    SELECT id, email, name, first_name, last_name, avatar_url, role, phone_number, phone_verified_at
    FROM vanscout_users
    WHERE google_subject = ${identity.subject}
       OR LOWER(email) = LOWER(${identity.email})
    ORDER BY CASE WHEN google_subject = ${identity.subject} THEN 0 ELSE 1 END
    LIMIT 1
  `;
  return rows[0] ? toUser(rows[0] as Record<string, unknown>) : null;
}

export async function upsertGoogleUser(identity: GoogleIdentity, role?: AccountRole): Promise<AppUser> {
  await ensureSchema();
  const sql = database();
  const selectedRole = role || "requester";
  const [firstName = identity.name, ...lastNameParts] = identity.name.trim().split(/\s+/);
  const existingRows = await sql`
    SELECT id
    FROM vanscout_users
    WHERE google_subject = ${identity.subject}
       OR LOWER(email) = LOWER(${identity.email})
    ORDER BY CASE WHEN google_subject = ${identity.subject} THEN 0 ELSE 1 END
    LIMIT 1
  `;
  const existingId = existingRows[0] ? String(existingRows[0].id) : null;
  const rows = existingId
    ? await sql`
        UPDATE vanscout_users
        SET google_subject = ${identity.subject},
            email = ${identity.email},
            name = ${identity.name},
            first_name = ${firstName},
            last_name = ${lastNameParts.join(" ")},
            avatar_url = ${identity.avatarUrl},
            email_verified_at = NOW(),
            role = CASE WHEN CAST(${role || null} AS TEXT) IS NULL THEN role ELSE ${selectedRole} END,
            updated_at = NOW()
        WHERE id = ${existingId}
        RETURNING id, email, name, first_name, last_name, avatar_url, role, phone_number, phone_verified_at
      `
    : await sql`
        INSERT INTO vanscout_users (id, google_subject, email, name, first_name, last_name, avatar_url, email_verified_at, role)
        VALUES (${randomUUID()}, ${identity.subject}, ${identity.email}, ${identity.name}, ${firstName}, ${lastNameParts.join(" ")}, ${identity.avatarUrl}, NOW(), ${selectedRole})
        ON CONFLICT (email) DO UPDATE SET
          google_subject = EXCLUDED.google_subject,
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

export async function createGoogleUserWithPhone(identity: GoogleIdentity, role: AccountRole, firstName: string, lastName: string, phoneNumber: string): Promise<AppUser> {
  await ensureSchema();
  const sql = database();
  const normalizedFirstName = firstName.trim();
  const normalizedLastName = lastName.trim();
  const rows = await sql`
    INSERT INTO vanscout_users (id, google_subject, email, name, first_name, last_name, avatar_url, email_verified_at, phone_number, phone_verified_at, role)
    VALUES (${randomUUID()}, ${identity.subject}, ${identity.email}, ${`${normalizedFirstName} ${normalizedLastName}`}, ${normalizedFirstName}, ${normalizedLastName}, ${identity.avatarUrl}, NOW(), ${phoneNumber}, NOW(), ${role})
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

export async function replaceRequestDraftImages(userId: string, images: Array<{ name: string; type: string; bytes: Uint8Array }>, transportRequestId?: string) {
  await ensureSchema();
  const sql = database();
  if (transportRequestId) {
    const owned = await sql`SELECT id FROM vanscout_transport_requests WHERE id = ${transportRequestId} AND requester_id = ${userId} LIMIT 1`;
    if (!owned[0]) throw new Error("Transport request not found");
    await sql`DELETE FROM vanscout_request_draft_images WHERE transport_request_id = ${transportRequestId}`;
  } else {
    await sql`DELETE FROM vanscout_request_draft_images WHERE user_id = ${userId} AND transport_request_id IS NULL`;
  }
  for (const [position, image] of images.slice(0, 3).entries()) {
    const encoded = Buffer.from(image.bytes).toString("base64");
    await sql`
      INSERT INTO vanscout_request_draft_images (id, user_id, transport_request_id, filename, content_type, image_data, position)
      VALUES (${randomUUID()}, ${userId}, ${transportRequestId || null}, ${image.name}, ${image.type}, decode(${encoded}, 'base64'), ${position})
    `;
  }
}

export async function getTransportRequestImage(transportRequestId: string, imageId: string) {
  await ensureSchema();
  const sql = database();
  const rows = await sql`
    SELECT content_type, image_data FROM vanscout_request_draft_images
    WHERE id = ${imageId} AND transport_request_id = ${transportRequestId}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  const data = rows[0].image_data;
  return { contentType: String(rows[0].content_type), data: Buffer.isBuffer(data) ? data : Buffer.from(data as Uint8Array) };
}
