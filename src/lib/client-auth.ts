export type SessionRole = "requester" | "transporter";

export type SessionUser = {
  id: string;
  role: SessionRole;
  phoneVerified: boolean;
};

export function getAuthToken() {
  return window.localStorage.getItem("auth_token") || "";
}

export function clearAuthSession() {
  window.localStorage.removeItem("auth_token");
}

export async function fetchSessionUser(signal?: AbortSignal): Promise<SessionUser | null> {
  const token = getAuthToken();
  if (!token) return null;

  const response = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });

  if (response.status === 401) {
    clearAuthSession();
    return null;
  }
  if (!response.ok) throw new Error("Unable to restore session");

  const payload = await response.json() as { user?: SessionUser };
  return payload.user && typeof payload.user.id === "string" && (payload.user.role === "transporter" || payload.user.role === "requester") ? payload.user : null;
}

export function dashboardPath(role: SessionRole) {
  return role === "transporter" ? "/carrier" : "/customer";
}
