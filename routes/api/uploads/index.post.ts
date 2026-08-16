/**
 * POST /api/uploads — placeholder import.
 *
 * Mutates the canonical `seedDatabases` in-memory so an uploaded table
 * immediately appears in the Database Editor's schema list and in the
 * Dataset create flow's database/schema/table selectors (single source,
 * no forking). Resets on server restart — flagged as placeholder.
 */
import { createError, defineHandler, readBody } from "nitro/h3";

import { seedDatabases } from "../../../src/data/databases";

type Body = {
  databaseId: string;
  schema: string;
  tableName: string;
  columns: string[];
  rowCount?: number;
};

export default defineHandler(async (event) => {
  const body = (await readBody(event)) as Partial<Body> | null;
  if (!body?.databaseId || !body?.schema || !body?.tableName || !Array.isArray(body.columns)) {
    throw createError({
      statusCode: 400,
      message: "databaseId, schema, tableName, columns are required",
    });
  }
  const tableName = body.tableName
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .slice(0, 64);
  if (!tableName) throw createError({ statusCode: 400, message: "Invalid table name" });
  if (!body.columns.length) throw createError({ statusCode: 400, message: "No columns" });

  const db = seedDatabases.find((d) => d.id === body.databaseId);
  if (!db) throw createError({ statusCode: 404, message: "Database not found" });

  const schemaName = body.schema.trim() || db.defaultSchema || db.schemas[0]?.name || "public";
  let schema = db.schemas.find((s) => s.name === schemaName);
  if (!schema) {
    schema = { name: schemaName, tables: [] } as (typeof db.schemas)[number];
    db.schemas.push(schema);
  }

  if (schema.tables.some((t) => t.name === tableName)) {
    throw createError({
      statusCode: 409,
      message: `Table "${tableName}" already exists in ${db.name}.${schemaName}`,
    });
  }

  const columns = body.columns.map((name) => ({
    name:
      name
        .trim()
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .slice(0, 64) || "col",
    type: "varchar",
  }));

  schema.tables.push({
    name: tableName,
    rowCount: Math.max(0, Number(body.rowCount) || 0) || columns.length ? 0 : 0,
    columns,
  } as (typeof schema.tables)[number]);

  // keep updated timestamp so Databases list reflects it
  db.modified = new Date().toISOString();
  db.modifiedBy = { id: 1, name: "Akmal Hazriq" };

  // set rowCount from preview if provided
  const created = schema.tables[schema.tables.length - 1]!;
  if (body.rowCount != null)
    (created as { rowCount: number }).rowCount = Math.max(0, Number(body.rowCount) || 0);

  return { ok: true, databaseId: db.id, schema: schemaName, table: tableName, columns };
});
