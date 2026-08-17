import { defineHandler, readBody } from "nitro/h3";
import { db } from "../../../src/db";
import { rlsFilterRoles, rlsFilterTables, rowLevelSecurityFilters } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const body = (await readBody(event)) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  const clause = String(body.clause ?? "").trim();
  if (!name || !clause) { event.node.res.statusCode = 400; return { error: "name and clause required" }; }
  const filterType = String(body.filterType ?? "regular");
  const roleIds: number[] = Array.isArray(body.roleIds) ? (body.roleIds as number[]).map(Number).filter(Number.isFinite) : [];
  const tables: { tableName: string; schemaName: string; databaseId: string }[] = Array.isArray(body.tables) ? (body.tables as Record<string, string>[]).map((t) => ({ tableName: String(t.tableName ?? t.table ?? ""), schemaName: String(t.schemaName ?? t.schema ?? "public"), databaseId: String(t.databaseId ?? "") })).filter((t) => t.tableName && t.databaseId) : [];
  const [row] = await db.insert(rowLevelSecurityFilters).values({
    name, filterType, clause, groupKey: body.groupKey ? String(body.groupKey) : null, description: body.description ? String(body.description) : null,
  }).returning();
  await db.transaction(async (tx) => {
    for (const rid of roleIds) await tx.insert(rlsFilterRoles).values({ filterId: row.id, roleId: rid }).onConflictDoNothing();
    for (const t of tables) await tx.insert(rlsFilterTables).values({ filterId: row.id, tableName: t.tableName, schemaName: t.schemaName, databaseId: t.databaseId });
  });
  return { data: row };
});