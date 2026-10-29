import { randomUUID } from "node:crypto";
import { ensureDatabaseSchema, sqlClient } from "./database";
import { decryptMessage, encryptMessage } from "./message-crypto";
import { hasDistributedPhoneNumber, hasRestrictedContactDetails, RestrictedContactDetailsError } from "./contact-details";

export type CarrierRide = {
  id: string;
  carrierId: string;
  carrierName: string;
  companyName: string;
  pickup: string;
  delivery: string;
  departureDate: string;
  departureTime: string;
  capacity: string;
  myInquiryId: string | null;
  createdAt: string;
};

export type CarrierRideInquiry = {
  id: string;
  requesterName: string;
  message: string;
  status: "pending" | "confirmed" | "closed";
  createdAt: string;
  updatedAt: string;
};

export type CreateCarrierRide = Omit<CarrierRide, "id" | "carrierId" | "carrierName" | "companyName" | "myInquiryId" | "createdAt">;

function dateOnly(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text;
}

function toRide(row: Record<string, unknown>): CarrierRide {
  return {
    id: String(row.id),
    carrierId: String(row.carrier_id),
    carrierName: String(row.carrier_name),
    companyName: typeof row.company_name === "string" ? row.company_name : "",
    pickup: String(row.pickup_formatted),
    delivery: String(row.delivery_formatted),
    departureDate: dateOnly(row.departure_date),
    departureTime: String(row.departure_time),
    capacity: String(row.capacity),
    myInquiryId: typeof row.my_inquiry_id === "string" ? row.my_inquiry_id : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

const rideColumns = `
  ride.id, ride.carrier_id, carrier.name AS carrier_name, profile.company_name,
  ride.pickup_formatted, ride.delivery_formatted, ride.departure_date, ride.departure_time,
  ride.capacity, ride.created_at
`;

export async function listCarrierRides(carrierId?: string, requesterId?: string) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const where = carrierId ? "WHERE ride.carrier_id = $1" : "WHERE ride.active = TRUE";
  const inquiryJoin = requesterId ? "LEFT JOIN vanscout_carrier_ride_inquiries mine ON mine.carrier_ride_id = ride.id AND mine.requester_id = $1" : "";
  const values = carrierId ? [carrierId] : requesterId ? [requesterId] : [];
  const rows = await sql.query(`
    SELECT ${rideColumns}${requesterId ? ", mine.id AS my_inquiry_id" : ""}
    FROM vanscout_carrier_rides ride
    JOIN vanscout_users carrier ON carrier.id = ride.carrier_id
    LEFT JOIN vanscout_carrier_profiles profile ON profile.carrier_id = ride.carrier_id
    ${inquiryJoin}
    ${where}
    ORDER BY ride.departure_date ASC, ride.departure_time ASC, ride.created_at DESC
  `, values);
  return rows.map(row => toRide(row as Record<string, unknown>));
}

export async function createCarrierRide(carrierId: string, input: CreateCarrierRide) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql`
    INSERT INTO vanscout_carrier_rides (
      id, carrier_id, pickup_formatted, delivery_formatted, departure_date, departure_time,
      capacity
    ) VALUES (
      ${randomUUID()}, ${carrierId}, ${input.pickup}, ${input.delivery}, ${input.departureDate}, ${input.departureTime},
      ${input.capacity}
    )
    RETURNING id, carrier_id, pickup_formatted, delivery_formatted, departure_date, departure_time,
      capacity, created_at
  `;
  const carrierRows = await sql`
    SELECT carrier.name AS carrier_name, profile.company_name
    FROM vanscout_users carrier
    LEFT JOIN vanscout_carrier_profiles profile ON profile.carrier_id = carrier.id
    WHERE carrier.id = ${carrierId}
  `;
  return toRide({ ...rows[0], ...carrierRows[0] } as Record<string, unknown>);
}

export async function createRideInquiry(rideId: string, requesterId: string, message: string) {
  if (hasRestrictedContactDetails(message)) throw new RestrictedContactDetailsError();
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql`
    INSERT INTO vanscout_carrier_ride_inquiries (id, carrier_ride_id, requester_id, message)
    SELECT ${`ride_${randomUUID()}`}, ride.id, ${requesterId}, ${encryptMessage(message)}
    FROM vanscout_carrier_rides ride
    WHERE ride.id = ${rideId} AND ride.active = TRUE AND ride.carrier_id <> ${requesterId}
    ON CONFLICT (carrier_ride_id, requester_id) DO UPDATE SET
      message = EXCLUDED.message,
      status = 'pending',
      carrier_agreed_at = NULL,
      requester_agreed_at = NULL,
      confirmed_at = NULL,
      updated_at = NOW()
    WHERE vanscout_carrier_ride_inquiries.status IN ('pending', 'closed')
    RETURNING id, carrier_ride_id, requester_id
  `;
  if (!rows[0]) return null;
  const recipient = await sql`
    SELECT ride.carrier_id FROM vanscout_carrier_rides ride WHERE ride.id = ${rideId} LIMIT 1
  `;
  return { inquiryId: String(rows[0].id), carrierId: recipient[0] ? String(recipient[0].carrier_id) : "" };
}

export async function listCarrierRideInquiries(rideId: string, carrierId: string): Promise<CarrierRideInquiry[] | null> {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql`
    SELECT inquiry.id, requester.name AS requester_name, inquiry.message, inquiry.status,
      inquiry.carrier_agreed_at, inquiry.requester_agreed_at, inquiry.created_at, inquiry.updated_at
    FROM vanscout_carrier_ride_inquiries inquiry
    JOIN vanscout_carrier_rides ride ON ride.id = inquiry.carrier_ride_id
    JOIN vanscout_users requester ON requester.id = inquiry.requester_id
    WHERE inquiry.carrier_ride_id = ${rideId} AND ride.carrier_id = ${carrierId}
    ORDER BY inquiry.updated_at DESC, inquiry.created_at DESC
  `;
  return rows.map(row => ({
    id: String(row.id),
    requesterName: String(row.requester_name),
    message: decryptMessage(String(row.message)),
    status: (row.carrier_agreed_at && row.requester_agreed_at) || String(row.status) === "confirmed" ? "confirmed" : String(row.status) === "closed" ? "closed" : "pending",
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  }));
}

export type RideInquiryDeal = {
  inquiryId: string;
  carrierId: string;
  requesterId: string;
  carrierAgreed: boolean;
  requesterAgreed: boolean;
  confirmed: boolean;
};

export async function agreeToRideInquiry(inquiryId: string, userId: string, role: "requester" | "transporter"): Promise<RideInquiryDeal | null> {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const agreed = role === "transporter"
    ? await sql`
      UPDATE vanscout_carrier_ride_inquiries inquiry
      SET carrier_agreed_at = COALESCE(inquiry.carrier_agreed_at, NOW()), updated_at = NOW()
      FROM vanscout_carrier_rides ride
      WHERE inquiry.id = ${inquiryId} AND inquiry.carrier_ride_id = ride.id
        AND ride.carrier_id = ${userId} AND inquiry.status = 'pending'
      RETURNING inquiry.id
    `
    : await sql`
      UPDATE vanscout_carrier_ride_inquiries inquiry
      SET requester_agreed_at = COALESCE(inquiry.requester_agreed_at, NOW()), updated_at = NOW()
      WHERE inquiry.id = ${inquiryId} AND inquiry.requester_id = ${userId} AND inquiry.status = 'pending'
      RETURNING inquiry.id
    `;
  if (!agreed[0]) return null;
  await sql`
    UPDATE vanscout_carrier_ride_inquiries
    SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW()
    WHERE id = ${inquiryId} AND status = 'pending'
      AND carrier_agreed_at IS NOT NULL AND requester_agreed_at IS NOT NULL
  `;
  const rows = await sql`
    SELECT inquiry.id, inquiry.requester_id, ride.carrier_id,
      (inquiry.carrier_agreed_at IS NOT NULL) AS carrier_agreed,
      (inquiry.requester_agreed_at IS NOT NULL) AS requester_agreed,
      (inquiry.status = 'confirmed') AS confirmed
    FROM vanscout_carrier_ride_inquiries inquiry
    JOIN vanscout_carrier_rides ride ON ride.id = inquiry.carrier_ride_id
    WHERE inquiry.id = ${inquiryId}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  const row = rows[0] as Record<string, unknown>;
  return {
    inquiryId: String(row.id),
    requesterId: String(row.requester_id),
    carrierId: String(row.carrier_id),
    carrierAgreed: Boolean(row.carrier_agreed),
    requesterAgreed: Boolean(row.requester_agreed),
    confirmed: Boolean(row.carrier_agreed) && Boolean(row.requester_agreed),
  };
}

async function rideInquiryAccess(inquiryId: string, userId: string) {
  const sql = sqlClient();
  const rows = await sql`
    SELECT inquiry.id, inquiry.carrier_ride_id, inquiry.requester_id, inquiry.status,
      inquiry.carrier_agreed_at, inquiry.requester_agreed_at, ride.carrier_id
    FROM vanscout_carrier_ride_inquiries inquiry
    JOIN vanscout_carrier_rides ride ON ride.id = inquiry.carrier_ride_id
    WHERE inquiry.id = ${inquiryId} AND (${userId} = inquiry.requester_id OR ${userId} = ride.carrier_id)
    LIMIT 1
  `;
  return rows?.[0] as Record<string, unknown> | undefined;
}

export async function listRideInquiryMessages(inquiryId: string, userId: string, markRead = false) {
  await ensureDatabaseSchema();
  const access = await rideInquiryAccess(inquiryId, userId);
  if (!access) return null;
  const sql = sqlClient();
  const rows = await sql`
    SELECT message.id, message.sender_id, sender.name AS sender_name, message.body, message.created_at, message.created_at::text AS read_through
    FROM vanscout_carrier_ride_messages message
    JOIN vanscout_users sender ON sender.id = message.sender_id
    WHERE message.inquiry_id = ${inquiryId}
    ORDER BY message.created_at ASC
    LIMIT 500
  `;
  if (markRead && rows.length) {
    await sql`
      INSERT INTO vanscout_carrier_ride_conversation_reads (inquiry_id, user_id, read_at)
      VALUES (${inquiryId}, ${userId}, ${rows[rows.length - 1].read_through})
      ON CONFLICT (inquiry_id, user_id) DO UPDATE SET read_at = GREATEST(vanscout_carrier_ride_conversation_reads.read_at, EXCLUDED.read_at)
    `;
  }
  return rows.map(row => ({
    id: String(row.id), senderId: String(row.sender_id), senderName: String(row.sender_name),
    body: decryptMessage(String(row.body)), createdAt: new Date(String(row.created_at)).toISOString(),
  }));
}

export async function sendRideInquiryMessage(inquiryId: string, senderId: string, body: string) {
  await ensureDatabaseSchema();
  const access = await rideInquiryAccess(inquiryId, senderId);
  const status = String(access?.status || "");
  const confirmed = Boolean(access?.carrier_agreed_at) && Boolean(access?.requester_agreed_at);
  if (!access || (status !== "pending" && status !== "confirmed")) return null;
  if (!confirmed && hasRestrictedContactDetails(body)) throw new RestrictedContactDetailsError();
  const sql = sqlClient();
  const recent = await sql`
    SELECT sender_id, body FROM vanscout_carrier_ride_messages
    WHERE inquiry_id = ${inquiryId} ORDER BY created_at DESC LIMIT 2
  `;
  if (!confirmed && recent.length && recent.every(row => String(row.sender_id) === senderId)) {
    if (hasDistributedPhoneNumber([...recent.reverse().map(row => decryptMessage(String(row.body))), body])) throw new RestrictedContactDetailsError();
  }
  const rows = await sql`
    INSERT INTO vanscout_carrier_ride_messages (id, inquiry_id, sender_id, body)
    VALUES (${randomUUID()}, ${inquiryId}, ${senderId}, ${encryptMessage(body)})
    RETURNING id, sender_id, created_at
  `;
  const recipientId = String(access.requester_id) === senderId ? String(access.carrier_id) : String(access.requester_id);
  return { id: String(rows[0].id), senderId, recipientId, body, createdAt: new Date(String(rows[0].created_at)).toISOString() };
}
