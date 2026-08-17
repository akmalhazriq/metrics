/**
 * GET /api/sqllab/databases — Drizzle/Postgres projection
 *
 * Same canonical source as /api/databases (databases + schemas + tables + columns)
 * projected to SqlDatabase shape for SQL Lab selector.
 */
import { defineHandler } from "nitro/h3";

import { db } from "../../../../src/db";
import { databaseSchemas, databaseTableColumns, databaseTables, databases } from "../../../../src/db/schema";
import { requireAuth } from "../../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const [dbRows, schemaRows, tableRows, colRows] = await Promise.all([
    db.select().from(databases),
    db.select().from(databaseSchemas),
    db.select().from(databaseTables),
    db.select().from(databaseTableColumns),
  ]);

  const colsByTable = new Map<number, { name: string; type: string }[]>();
  for (const c of colRows) {
    const arr = colsByTable.get(c.tableId) ?? [];
    arr.push({ name: c.name, type: c.type });
    colsByTable.set(c.tableId, arr);
  }

  const tablesMap = new Map<number, (typeof tableRows)[number][]>();
  for (const t of tableRows) {
    const arr = tablesMap.get(t.schemaId) ?? [];
    arr.push(t);
    tablesMap.set(t.schemaId, arr);
  }

  const schemasByDb = new Map<string, (typeof schemaRows)[number][]>();
  for (const s of schemaRows) {
    const arr = schemasByDb.get(s.databaseId) ?? [];
    arr.push(s);
    schemasByDb.set(s.databaseId, arr);
  }

  const data = dbRows.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.backend,
    schemas: (schemasByDb.get(d.id) ?? []).map((s) => ({
      name: s.name,
      tables: (tablesMap.get(s.id) ?? []).map((t) => ({
        name: t.name,
        columns: colsByTable.get(t.id) ?? [],
        rowCount: t.rowCount ?? undefined,
      })),
    })),
  }));

  return { databases: data };
});