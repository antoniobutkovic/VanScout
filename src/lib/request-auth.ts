import { findUserById, type AppUser } from "./database";
import { bearerToken, verifySessionToken } from "./session";

export async function authenticatedUser(request: Request): Promise<AppUser | null> {
  const token = bearerToken(request);
  if (!token) return null;
  try {
    const { userId } = await verifySessionToken(token);
    return await findUserById(userId);
  } catch {
    return null;
  }
}
