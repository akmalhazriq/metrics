/**
 * POST /api/uploads — Drizzle/Postgres
 *
 * Persists uploaded table into database_schemas / database_tables / columns.
 * Wrapped in transaction: find/create schema, check duplicate table, insert
 * table + columns, bump databases.modifiedAt.
 */
import { createError, defineHandler, readBody } from "nitro/h3";
import { and, eq } from "drizzle-orm";

import { db } from "../../../src/db";
import { databaseSchemas, databaseTableColumns, databaseTables, databases } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

type Body = {
  databaseId: string;
  schema: string;
  tableName: string;
  columns: string[];
  rowCount?: number;
};

export default defineHandler(async (event) => {
  await requireAuth(event);
  const body = (await readBody(event)) as Partial<Body> | null;
  if (!body?.databaseId || !body?.schema || !body?.tableName || !Array.isArray(body.columns)) {
    throw createError({ statusCode: 400, message: "databaseId, schema, tableName, columns are required" });
  }
  const tableName = body.tableName.trim().replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 64);
  if (!tableName) throw createError({ statusCode: 400, message: "Invalid table name" });
  if (!body.columns.length) throw createError({ statusCode: 400, message: "No columns" });

  const dbId = body.databaseId;
  const schemaName = body.schema.trim() || "public";

  const columns = body.columns.map((name) => ({
    name: name.trim().replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 64) || "col",
    type: "varchar",
  }));

  const rowCount = Math.max(0, Number(body.rowCount) || 0);

  await db.transaction(async (tx) => {
    const dbRows = await tx.select().from(databases).where(eq(databases.id, dbId));
    const dbRec = dbRows[0];
    if (!dbRec) throw createError({ statusCode: 404, message: "Database not found" });

    const schemaRows = await tx
      .select()
      .from(databaseSchemas)
      .where(and(eq(databaseSchemas.databaseId, dbId), eq(databaseSchemas.name, schemaName)));
    let schemaRow = schemaRows[0];
    if (!schemaRow) {
      const [inserted] = await tx.insert(databaseSchemas).values({ databaseId: dbId, name: schemaName }).returning();
      schemaRow = inserted;
    }
    if (!schemaRow) throw createError({ statusCode: 500, message: "Failed to create schema" });

    const existingTables = await tx
      .select()
      .from(databaseTables)
      .where(and(eq(databaseTables.schemaId, schemaRow.id), eq(databaseTables.name, tableName)));
    if (existingTables.length) {
      throw createError({ statusCode: 409, message: `Table "${tableName}" already exists in ${dbRec.name}.${schemaName}` });
    }

    const [tableRow] = await tx
      .insert(databaseTables)
      .values({ schemaId: schemaRow.id, name: tableName, rowCount })
      .returning();
    if (!tableRow) throw createError({ statusCode: 500, message: "Failed to create table" });

    for (const c of columns) {
      await tx.insert(databaseTableColumns).values({ tableId: tableRow.id, name: c.name, type: c.type });
    }

    await tx.update(databases).set({ modifiedAt: new Date(), modifiedById: 1 }).where(eq(databases.id, dbId));
  });

  return { ok: true, databaseId: dbId, schema: schemaName, table: tableName, columns };
});