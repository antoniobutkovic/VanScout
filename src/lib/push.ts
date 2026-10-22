import * as webPush from "web-push";
import { randomUUID } from "node:crypto";
import { optionalEnv } from "./config";
import { ensureDatabaseSchema, sqlClient } from "./database";

export type PushSubscriptionInput = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type PushNotification = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

type WebPushConfiguration = {
  subject: string;
  publicKey: string;
  privateKey: string;
};

let configuredWith = "";

function webPushConfiguration(): WebPushConfiguration | null {
  const subject = optionalEnv("VAPID_SUBJECT");
  const publicKey = optionalEnv("VAPID_PUBLIC_KEY");
  const privateKey = optionalEnv("VAPID_PRIVATE_KEY");
  if (!subject || !publicKey || !privateKey) return null;
  return { subject, publicKey, privateKey };
}

function configureWebPush(configuration: WebPushConfiguration) {
  const fingerprint = `${configuration.subject}:${configuration.publicKey}:${configuration.privateKey}`;
  if (configuredWith === fingerprint) return;
  webPush.setVapidDetails(configuration.subject, configuration.publicKey, configuration.privateKey);
  configuredWith = fingerprint;
}

export function webPushPublicKey() {
  return webPushConfiguration()?.publicKey || null;
}

export async function savePushSubscription(userId: string, subscription: PushSubscriptionInput) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  await sql`
    INSERT INTO vanscout_push_subscriptions (
      id, user_id, endpoint, p256dh, auth, expiration_time
    ) VALUES (
      ${randomUUID()}, ${userId}, ${subscription.endpoint}, ${subscription.keys.p256dh}, ${subscription.keys.auth},
      ${subscription.expirationTime ?? null}
    )
    ON CONFLICT (endpoint) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      expiration_time = EXCLUDED.expiration_time,
      updated_at = NOW()
  `;
}

export async function removePushSubscription(userId: string, endpoint: string) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  await sql`DELETE FROM vanscout_push_subscriptions WHERE user_id = ${userId} AND endpoint = ${endpoint}`;
}

export async function sendPushNotification(userId: string, notification: PushNotification) {
  const configuration = webPushConfiguration();
  if (!configuration) return false;
  configureWebPush(configuration);
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const subscriptions = await sql`
    SELECT endpoint, p256dh, auth, expiration_time
    FROM vanscout_push_subscriptions
    WHERE user_id = ${userId}
  `;
  if (!subscriptions.length) return false;

  const payload = JSON.stringify(notification);
  const results = await Promise.allSettled(subscriptions.map(async subscription => {
    const endpoint = String(subscription.endpoint);
    try {
      await webPush.sendNotification({
        endpoint,
        expirationTime: subscription.expiration_time === null ? null : Number(subscription.expiration_time),
        keys: { p256dh: String(subscription.p256dh), auth: String(subscription.auth) },
      }, payload, { TTL: 60 * 60 * 12, urgency: "high" });
      return true;
    } catch (error) {
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : 0;
      if (statusCode === 404 || statusCode === 410) {
        await sql`DELETE FROM vanscout_push_subscriptions WHERE endpoint = ${endpoint}`;
        return false;
      }
      console.warn("Unable to send web push notification", { statusCode, endpoint });
      return false;
    }
  }));
  return results.some(result => result.status === "fulfilled" && result.value);
}
