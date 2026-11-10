import { createHmac } from "node:crypto";

// Correlate attempts for the same email without putting addresses or secrets in logs.
export async function authLogContext(request: Request) {
  let account: string | undefined;
  try {
    const body: unknown = await request.clone().json();
    const email = body && typeof body === "object" && "email" in body ? body.email : undefined;
    const secret = process.env.JWT_SECRET;
    if (typeof email === "string" && email.length <= 320 && email.includes("@") && secret && secret.length >= 32) {
      account = createHmac("sha256", secret).update(`auth-log-email:v1:${email.trim().toLowerCase()}`).digest("hex");
    }
  } catch {
    // Invalid JSON is handled by the route; no request body is logged.
  }
  const rawRequestId = request.headers.get("x-vercel-id");
  const requestId = rawRequestId && /^[a-zA-Z0-9:._-]{1,128}$/.test(rawRequestId) ? rawRequestId : undefined;
  return { account, requestId };
}

export function logAuthEvent(context: Awaited<ReturnType<typeof authLogContext>>, event: string, outcome: string, details: { status: number; stage?: string; retryAfterSeconds?: number; errorName?: string }) {
  const entry = { kind: "auth_event", event, outcome, ...context, ...details };
  if (details.status >= 500) console.error(JSON.stringify(entry));
  else if (details.status >= 400) console.warn(JSON.stringify(entry));
  else console.info(JSON.stringify(entry));
}

export function safeErrorName(error: unknown) {
  // Error messages and stacks may contain email addresses, tokens or provider responses.
  return error instanceof Error && /^[A-Za-z][A-Za-z0-9]{0,50}$/.test(error.name) ? error.name : "UnknownError";
}
