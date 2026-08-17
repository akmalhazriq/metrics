import { defineHandler, getRouterParam, readBody } from "nitro/h3";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { rlsFilterRoles, rlsFilterTables, rowLevelSecurityFilters } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id)) { event.node.res.statusCode = 400; return { error: "Invalid id" }; }
  const body = (await readBody(event)) as Record<string, unknown>;
  const patch: Record<string, unknown> = { modifiedAt: new Date() };
  if (body.name !== undefined) patch.name = String(body.name).trim() || null;
  if (body.filterType !== undefined) patch.filterType = String(body.filterType);
  if (body.clause !== undefined) patch.clause = String(body.clause);
  if (body.groupKey !== undefined) patch.groupKey = body.groupKey ? String(body.groupKey) : null;
  if (body.description !== undefined) patch.description = body.description ? String(body.description) : null;
  if (patch.name !== undefined && !String(patch.name).trim()) { event.node.res.statusCode = 400; return { error: "Name required" }; }
  if (patch.clause !== undefined && !String(patch.clause).trim()) { event.node.res.statusCode = 400; return { error: "Clause required" }; }
  const roleIds: number[] | undefined = Array.isArray(body.roleIds) ? (body.roleIds as number[]).map(Number).filter(Number.isFinite) : undefined;
  const tables: { tableName: string; schemaName: string; databaseId: string }[] | undefined = Array.isArray(body.tables) ? (body.tables as Record<string, string>[]).map((t) => ({ tableName: String(t.tableName ?? t.table ?? ""), schemaName: String(t.schemaName ?? t.schema ?? "public"), databaseId: String(t.databaseId ?? "") })).filter((t) => t.tableName && t.databaseId) : undefined;

  const [row] = await db.update(rowLevelSecurityFilters).set(patch as never).where(eq(rowLevelSecurityFilters.id, id)).returning();
  if (!row) { event.node.res.statusCode = 404; return { error: "Not found" }; }
  await db.transaction(async (tx) => {
    if (roleIds !== undefined) { await tx.delete(rlsFilterRoles).where(eq(rlsFilterRoles.filterId, id)); for (const rid of roleIds) await tx.insert(rlsFilterRoles).values({ filterId: id, roleId: rid }).onConflictDoNothing(); }
    if (tables !== undefined) { await tx.delete(rlsFilterTables).where(eq(rlsFilterTables.filterId, id)); for (const t of tables) await tx.insert(rlsFilterTables).values({ filterId: id, tableName: t.tableName, schemaName: t.schemaName, databaseId: t.databaseId }); }
  });
  return { data: row };
});