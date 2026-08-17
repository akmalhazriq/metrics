import { defineHandler, getHeader, readBody } from "nitro/h3";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { sessions, users } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

function extractToken(event: unknown): string | null {
  const h = (getHeader(event as never, "authorization") as string) ?? "";
  if (h.startsWith("Bearer ")) return h.slice(7).trim();
  const xt = (getHeader(event as never, "x-session-token") as string) ?? "";
  if (xt) return xt.trim();
  return null;
}

export default defineHandler(async (event) => {
  await requireAuth(event);
  const token = extractToken(event);
  if (!token) {
    event.node.res.statusCode = 401;
    return { error: "Not authenticated" };
  }
  const [sess] = await db.select().from(sessions).where(eq(sessions.token, token));
  if (!sess || new Date(sess.expiresAt).getTime() < Date.now()) {
    event.node.res.statusCode = 401;
    return { error: "Invalid session" };
  }
  const body = (await readBody(event)) as { firstName?: string; lastName?: string; email?: string };
  const firstName = body.firstName !== undefined ? String(body.firstName).trim() : undefined;
  const lastName = body.lastName !== undefined ? String(body.lastName).trim() : undefined;
  const email = body.email !== undefined ? String(body.email).trim() : undefined;

  if (firstName !== undefined && !firstName) {
    event.node.res.statusCode = 400;
    return { error: "firstName cannot be empty" };
  }
  if (lastName !== undefined && !lastName) {
    event.node.res.statusCode = 400;
    return { error: "lastName cannot be empty" };
  }
  if (email !== undefined && !email.includes("@")) {
    event.node.res.statusCode = 400;
    return { error: "invalid email" };
  }

  const patch: Record<string, unknown> = {};
  if (firstName !== undefined) patch.firstName = firstName;
  if (lastName !== undefined) patch.lastName = lastName;
  if (email !== undefined) patch.email = email;
  if (Object.keys(patch).length === 0) {
    event.node.res.statusCode = 400;
    return { error: "nothing to update (allowed: firstName, lastName, email)" };
  }
  const [updated] = await db
    .update(users)
    .set({ ...(patch as never), modifiedAt: new Date() })
    .where(eq(users.id, sess.userId))
    .returning();
  return { user: { id: updated.id, username: updated.username, firstName: updated.firstName, lastName: updated.lastName, email: updated.email } };
});