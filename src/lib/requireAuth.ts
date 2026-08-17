import { createError, getHeader } from "nitro/h3";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { sessions } from "../db/schema";

function extractToken(event: unknown): string | null {
  const auth = (getHeader(event as never, "authorization") as string) ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  const xt = (getHeader(event as never, "x-session-token") as string) ?? "";
  if (xt) return xt.trim();
  return null;
}

/**
 * Guard for protected API handlers.
 * Validates Bearer / x-session-token against the sessions table (expiry-aware).
 * Throws 401 if missing/invalid/expired. Returns the authenticated userId + session.
 */
export async function requireAuth(event: unknown): Promise<{ userId: number; token: string }> {
  const token = extractToken(event);
  if (!token) throw createError({ statusCode: 401, message: "Not authenticated" });
  const [sess] = await db.select().from(sessions).where(eq(sessions.token, token));
  if (!sess) throw createError({ statusCode: 401, message: "Invalid session" });
  if (new Date(sess.expiresAt).getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.token, token));
    throw createError({ statusCode: 401, message: "Session expired" });
  }
  return { userId: sess.userId, token };
}
