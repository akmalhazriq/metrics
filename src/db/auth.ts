import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { sessions, users } from "./schema";

export function hashPassword(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

export function verifyPassword(plain: string, hash: string): boolean {
  return hashPassword(plain) === hash;
}

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function getTokenFromEvent(event: { node: { req: { headers: Record<string, unknown> } } } | { headers: unknown }): string | null {
  // H3 event — try Authorization Bearer first, then x-session-token
  const e = event as unknown as { node?: { req?: { headers?: Record<string, string | string[]> } }; headers?: { get?: (k: string) => string | null } };
  const h = e.node?.req?.headers ?? {};
  const auth = (h["authorization"] as string) ?? (h["Authorization"] as string) ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  const xt = (h["x-session-token"] as string) ?? (h["X-Session-Token"] as string) ?? "";
  if (xt) return xt.trim();
  // Also try event.headers.get if available (H3 getHeader helper will call this path)
  return null;
}

// Resolve token via H3 getHeader — caller passes event, we read both places
export async function resolveUserByToken(token: string | null) {
  if (!token) return null;
  const [sess] = await db.select().from(sessions).where(eq(sessions.token, token));
  if (!sess) return null;
  if (new Date(sess.expiresAt).getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.token, token));
    return null;
  }
  const [user] = await db.select().from(users).where(eq(users.id, sess.userId));
  if (!user) return null;
  return { session: sess, user };
}

export async function getUserWithRoles(userId: number) {
  const { userRoles, roles, rolePermissions, permissions } = await import("./schema");
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return null;
  const urs = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  const roleIds = urs.map((r) => r.roleId);
  let roleRows: typeof roles.$inferSelect[] = [];
  let perms: string[] = [];
  if (roleIds.length) {
    const { inArray } = await import("drizzle-orm");
    roleRows = await db.select().from(roles).where(inArray(roles.id, roleIds));
    const rps = await db.select().from(rolePermissions).where(inArray(rolePermissions.roleId, roleIds));
    const permIds = rps.map((r) => r.permissionId);
    if (permIds.length) {
      const prow = await db.select().from(permissions).where(inArray(permissions.id, permIds));
      perms = prow.map((p) => p.name);
    }
  }
  return { user: u, roles: roleRows, permissions: perms };
}
