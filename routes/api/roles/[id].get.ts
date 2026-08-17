import { defineHandler, getRouterParam } from "nitro/h3";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { permissions, rolePermissions, roles, userRoles, users } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id)) { event.node.res.statusCode = 400; return { error: "Invalid id" }; }
  const [row] = await db.select().from(roles).where(eq(roles.id, id));
  if (!row) { event.node.res.statusCode = 404; return { error: "Not found" }; }
  const [rpRows, urRows, allPerms, permRows] = await Promise.all([
    db.select().from(rolePermissions).where(eq(rolePermissions.roleId, id)),
    db.select().from(userRoles).where(eq(userRoles.roleId, id)),
    db.select().from(permissions),
    db.select().from(rolePermissions),
  ]);
  void permRows;
  const permIds = rpRows.map((r) => r.permissionId);
  const permNames = allPerms.filter((p) => permIds.includes(p.id)).map((p) => p.name);
  const userIds = urRows.map((r) => r.userId);
  const usersOnRole = userIds.length ? await db.select().from(users).then((all) => all.filter((u) => userIds.includes(u.id)).map((u) => ({ id: u.id, username: u.username, name: `${u.firstName} ${u.lastName}`.trim() }))) : [];
  return { data: { id: row.id, name: row.name, description: row.description, permissionIds: permIds, permissions: permNames, userCount: userIds.length, users: usersOnRole, createdAt: row.createdAt.toISOString(), modifiedAt: row.modifiedAt.toISOString() } };
});