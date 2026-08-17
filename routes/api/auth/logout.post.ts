import { defineHandler, getHeader } from "nitro/h3";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { sessions } from "../../../src/db/schema";

function extractToken(event: unknown): string | null {
  const h = (getHeader(event as never, "authorization") as string) ?? "";
  if (h.startsWith("Bearer ")) return h.slice(7).trim();
  const xt = (getHeader(event as never, "x-session-token") as string) ?? "";
  if (xt) return xt.trim();
  return null;
}

export default defineHandler(async (event) => {
  const token = extractToken(event);
  if (!token) {
    return { ok: true };
  }
  await db.delete(sessions).where(eq(sessions.token, token));
  return { ok: true };
});
