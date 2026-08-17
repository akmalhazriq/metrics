import { defineHandler, getRouterParam } from "nitro/h3";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { rlsFilterRoles, rlsFilterTables, roles, rowLevelSecurityFilters } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id)) { event.node.res.statusCode = 400; return { error: "Invalid id" }; }
  const [row] = await db.select().from(rowLevelSecurityFilters).where(eq(rowLevelSecurityFilters.id, id));
  if (!row) { event.node.res.statusCode = 404; return { error: "Not found" }; }
  const [rr, rt, allRoles] = await Promise.all([
    db.select().from(rlsFilterRoles).where(eq(rlsFilterRoles.filterId, id)),
    db.select().from(rlsFilterTables).where(eq(rlsFilterTables.filterId, id)),
    db.select().from(roles),
  ]);
  const roleIds = rr.map((r) => r.roleId);
  const roleNames = allRoles.filter((r) => roleIds.includes(r.id)).map((r) => r.name);
  return {
    data: {
      id: row.id, name: row.name, filterType: row.filterType, clause: row.clause, groupKey: row.groupKey, description: row.description,
      roleIds, roles: roleNames,
      tables: rt.map((t) => ({ tableName: t.tableName, schemaName: t.schemaName, databaseId: t.databaseId })),
      createdAt: row.createdAt.toISOString(), modifiedAt: row.modifiedAt.toISOString(),
    },
  };
});