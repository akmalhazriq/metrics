import { defineHandler, getHeader } from "nitro/h3";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { sessions, users, userRoles, roles, rolePermissions, permissions } from "../../../src/db/schema";

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
    event.node.res.statusCode = 401;
    return { error: "Not authenticated" };
  }
  const [sess] = await db.select().from(sessions).where(eq(sessions.token, token));
  if (!sess) {
    event.node.res.statusCode = 401;
    return { error: "Invalid session" };
  }
  if (new Date(sess.expiresAt).getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.token, token));
    event.node.res.statusCode = 401;
    return { error: "Session expired" };
  }
  const [user] = await db.select().from(users).where(eq(users.id, sess.userId));
  if (!user) {
    event.node.res.statusCode = 401;
    return { error: "User not found" };
  }
  const urs = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));
  const roleIds = urs.map((r) => r.roleId);
  let roleRows: typeof roles.$inferSelect[] = [];
  let permNames: string[] = [];
  if (roleIds.length) {
    const { inArray } = await import("drizzle-orm");
    roleRows = await db.select().from(roles).where(inArray(roles.id, roleIds));
    const rps = await db.select().from(rolePermissions).where(inArray(rolePermissions.roleId, roleIds));
    const permIds = rps.map((r) => r.permissionId);
    if (permIds.length) {
      const prow = await db.select().from(permissions).where(inArray(permissions.id, permIds));
      permNames = prow.map((p) => p.name);
    }
  }
  return {
    user: { id: user.id, username: user.username, firstName: user.firstName, lastName: user.lastName, email: user.email, active: user.active },
    roles: roleRows.map((r) => ({ id: r.id, name: r.name })),
    permissions: permNames,
  };
});
