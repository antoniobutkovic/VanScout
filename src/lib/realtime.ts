import { Rest, type TokenRequest } from "ably";
import { optionalEnv } from "./config";
import type { AppUser } from "./database";
import { listConversations } from "./marketplace";

let restClient: Rest | null = null;

function ablyClient() {
  const key = optionalEnv("ABLY_API_KEY");
  if (!key) return null;
  restClient ??= new Rest({ key });
  return restClient;
}

export function isRealtimeConfigured() {
  return Boolean(optionalEnv("ABLY_API_KEY"));
}

export async function createRealtimeTokenRequest(user: AppUser): Promise<TokenRequest | null> {
  const client = ablyClient();
  if (!client) return null;
  const conversations = await listConversations(user);
  const capability: Record<string, string[]> = { [`user:${user.id}`]: ["subscribe"] };
  for (const conversation of conversations) capability[`chat:${conversation.offerId}`] = ["subscribe"];
  return client.auth.createTokenRequest({
    clientId: user.id,
    capability: JSON.stringify(capability),
    ttl: 60 * 60 * 1000,
  });
}

export async function publishRealtimeEvent(channelName: string, eventName: string, data: Record<string, string>) {
  const client = ablyClient();
  if (!client) return false;
  try {
    await client.channels.get(channelName).publish(eventName, data);
    return true;
  } catch (error) {
    console.warn("Ably publish failed; clients will use polling fallback", error);
    return false;
  }
}
