import { findUserById, type AppUser } from "./database";
import { sessionToken, verifySessionToken } from "./session";

export async function authenticatedUser(request: Request): Promise<AppUser | null> {
  const token = sessionToken(request);
  if (!token) return null;
  try {
    const { userId } = await verifySessionToken(token);
    return await findUserById(userId);
  } catch {
    return null;
  }
}
