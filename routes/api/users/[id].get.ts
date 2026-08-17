import { defineHandler, getRouterParam } from "nitro/h3";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { databaseAccess, datasourceAccess, roles, userRoles, users } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id)) { event.node.res.statusCode = 400; return { error: "Invalid id" }; }
  const [row] = await db.select().from(users).where(eq(users.id, id));
  if (!row) { event.node.res.statusCode = 404; return { error: "Not found" }; }
  const [urRows, dbAcc, dsAcc, allRoles] = await Promise.all([
    db.select().from(userRoles).where(eq(userRoles.userId, id)),
    db.select().from(databaseAccess).where(eq(databaseAccess.userId, id)),
    db.select().from(datasourceAccess).where(eq(datasourceAccess.userId, id)),
    db.select().from(roles),
  ]);
  const roleIds = urRows.map((r) => r.roleId);
  const roleNames = allRoles.filter((r) => roleIds.includes(r.id)).map((r) => r.name);
  return {
    data: {
      id: row.id, username: row.username, firstName: row.firstName, lastName: row.lastName, email: row.email, active: row.active ?? true,
      roleIds, roles: roleNames,
      databaseIds: dbAcc.map((r) => r.databaseId),
      datasetIds: dsAcc.map((r) => r.datasetId),
      createdAt: row.createdAt.toISOString(), modifiedAt: row.modifiedAt.toISOString(),
    },
  };
});