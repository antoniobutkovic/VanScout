import { createHmac } from "node:crypto";

export function accountLogId(email: string | undefined) {
  const secret = process.env.JWT_SECRET;
  return email && email.length <= 320 && email.includes("@") && secret && secret.length >= 32
    ? createHmac("sha256", secret).update(`auth-log-email:v1:${email.trim().toLowerCase()}`).digest("hex")
    : undefined;
}

// Correlate attempts for the same email without putting addresses or secrets in logs.
export async function authLogContext(request: Request) {
  let account: string | undefined;
  try {
    const body: unknown = await request.clone().json();
    const email = body && typeof body === "object" && "email" in body ? body.email : undefined;
    if (typeof email === "string") account = accountLogId(email);
  } catch {
    // Invalid JSON is handled by the route; no request body is logged.
  }
  const rawRequestId = request.headers.get("x-vercel-id");
  const requestId = rawRequestId && /^[a-zA-Z0-9:._-]{1,128}$/.test(rawRequestId) ? rawRequestId : undefined;
  return { account, requestId };
}

export function logAuthEvent(context: { account?: string; requestId?: string }, event: string, outcome: string, details: { status: number; stage?: string; retryAfterSeconds?: number; errorName?: string; errorCode?: string; imageCount?: number; totalImageBytes?: number }) {
  const entry = { kind: "auth_event", event, outcome, ...context, ...details };
  if (details.status >= 500) console.error(JSON.stringify(entry));
  else if (details.status >= 400) console.warn(JSON.stringify(entry));
  else console.info(JSON.stringify(entry));
}

export function safeErrorName(error: unknown) {
  // Error messages and stacks may contain email addresses, tokens or provider responses.
  return error instanceof Error && /^[A-Za-z][A-Za-z0-9]{0,50}$/.test(error.name) ? error.name : "UnknownError";
}

export function safeErrorCode(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  return typeof code === "string" && /^[A-Za-z][A-Za-z0-9_/-]{0,60}$/.test(code) ? code : undefined;
}
