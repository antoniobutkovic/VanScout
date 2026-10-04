export type SessionRole = "requester" | "transporter";

export type SessionUser = {
  id: string;
  role: SessionRole;
  phoneVerified: boolean;
};

let redirectingForExpiredSession = false;
let sessionExpiryHandlerInstalled = false;

function isSameOriginApiRequest(input: RequestInfo | URL) {
  const rawUrl = input instanceof Request ? input.url : input.toString();
  const url = new URL(rawUrl, window.location.origin);
  return url.origin === window.location.origin && url.pathname.startsWith("/api/") && url.pathname !== "/api/auth/logout";
}

/**
 * Watches API responses in one place so every authenticated screen handles an
 * expired or invalid session the same way.
 */
export function installSessionExpiryHandler() {
  if (typeof window === "undefined" || redirectingForExpiredSession || sessionExpiryHandlerInstalled) return;

  const browserFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await browserFetch(input, init);
    if (response.status === 401 && isSameOriginApiRequest(input)) expireAuthSession();
    return response;
  };
  sessionExpiryHandlerInstalled = true;
}

export function expireAuthSession() {
  if (typeof window === "undefined" || redirectingForExpiredSession) return;

  redirectingForExpiredSession = true;
  window.localStorage.removeItem("auth_token");
  // Keep this request alive while navigating away so the HttpOnly session
  // cookie is cleared too.
  void fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", cache: "no-store", keepalive: true });
  window.location.replace("/auth");
}

export function getAuthToken() {
  // "cookie" is a non-secret compatibility marker for older call sites that
  // still add an Authorization header. The real session is HttpOnly.
  return window.localStorage.getItem("auth_token") || "cookie";
}

export async function clearAuthSession() {
  window.localStorage.removeItem("auth_token");
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", cache: "no-store" });
  } catch {
    // A failed request cannot clear an HttpOnly cookie. The next authenticated
    // request will still reject an expired or invalid session server-side.
  }
}

export async function fetchSessionUser(signal?: AbortSignal): Promise<SessionUser | null> {
  const token = getAuthToken();
  const response = await fetch("/api/auth/me", {
    headers: token !== "cookie" ? { Authorization: `Bearer ${token}` } : undefined,
    signal,
  });

  if (response.status === 401) {
    expireAuthSession();
    return null;
  }
  if (!response.ok) throw new Error("Unable to restore session");
  window.localStorage.removeItem("auth_token");

  const payload = await response.json() as { user?: SessionUser };
  return payload.user && typeof payload.user.id === "string" && (payload.user.role === "transporter" || payload.user.role === "requester") ? payload.user : null;
}

export function dashboardPath(role: SessionRole) {
  return role === "transporter" ? "/carrier" : "/customer";
}
