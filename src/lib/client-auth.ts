export type SessionRole = "requester" | "transporter";

export type SessionUser = {
  id: string;
  role: SessionRole;
  phoneVerified: boolean;
};

export function getAuthToken() {
  // "cookie" is a non-secret compatibility marker for older call sites that
  // still add an Authorization header. The real session is HttpOnly.
  return window.localStorage.getItem("auth_token") || "cookie";
}

export function clearAuthSession() {
  window.localStorage.removeItem("auth_token");
  void fetch("/api/auth/logout", { method: "POST", keepalive: true });
}

export async function fetchSessionUser(signal?: AbortSignal): Promise<SessionUser | null> {
  const token = getAuthToken();
  const response = await fetch("/api/auth/me", {
    headers: token !== "cookie" ? { Authorization: `Bearer ${token}` } : undefined,
    signal,
  });

  if (response.status === 401) {
    clearAuthSession();
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
