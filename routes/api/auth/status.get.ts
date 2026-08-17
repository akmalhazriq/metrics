import { defineHandler, getHeader } from "nitro/h3";
import { db } from "../../../src/db";
import { sessions } from "../../../src/db/schema";
import { eq } from "drizzle-orm";

function extractToken(event: unknown): string | null {
  const h = (getHeader(event as never, "authorization") as string) ?? "";
  if (h.startsWith("Bearer ")) return h.slice(7).trim();
  const xt = (getHeader(event as never, "x-session-token") as string) ?? "";
  if (xt) return xt.trim();
  return null;
}

export default defineHandler(async (event) => {
  const { pool } = await import("../../../src/db/index");
  const hasRes = await pool.query("SELECT EXISTS (SELECT 1 FROM users) AS has_users");
  const hasUsersBool = Boolean(hasRes.rows[0]?.has_users);

  const token = extractToken(event);
  let isAuthenticated = false;
  if (token) {
    const [sess] = await db.select().from(sessions).where(eq(sessions.token, token));
    if (sess && new Date(sess.expiresAt).getTime() > Date.now()) {
      isAuthenticated = true;
    } else if (sess) {
      await db.delete(sessions).where(eq(sessions.token, token));
    }
  }

  return { hasUsers: hasUsersBool, isAuthenticated };
});
