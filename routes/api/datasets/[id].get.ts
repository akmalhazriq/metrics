import { createError, defineHandler, getRouterParam } from "nitro/h3";
import { eq } from "drizzle-orm";

import { db } from "../../../src/db";
import { databases, datasetColumns, datasetMetrics, datasets, users } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const raw = getRouterParam(event, "id");
  const id = Number(raw);
  if (!raw || Number.isNaN(id)) throw createError({ statusCode: 400, message: "Invalid dataset id" });

  const [row] = await db.select().from(datasets).where(eq(datasets.id, id));
  if (!row) throw createError({ statusCode: 404, message: "Dataset not found" });

  const [allUsers, dbRows, cols, mets] = await Promise.all([
    db.select().from(users),
    db.select().from(databases),
    db.select().from(datasetColumns).where(eq(datasetColumns.datasetId, id)),
    db.select().from(datasetMetrics).where(eq(datasetMetrics.datasetId, id)),
  ]);

  const userName = new Map(allUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
  const dbRow = dbRows.find((d) => d.id === row.databaseId);

  const created = row.createdById ? { id: row.createdById, name: userName.get(row.createdById) ?? String(row.createdById) } : { id: 0, name: "Sample" };
  const modified = row.modifiedById ? { id: row.modifiedById, name: userName.get(row.modifiedById) ?? String(row.modifiedById) } : created;

  return {
    data: {
      id: row.id,
      name: row.name,
      type: row.type,
      databaseId: row.databaseId,
      databaseName: dbRow?.name ?? row.databaseId,
      backend: dbRow?.backend ?? "Postgres",
      schema: row.schema ?? "public",
      table: row.tableName,
      source: row.type === "virtual" ? (row.sql ?? "") : `${row.databaseId}.${row.schema ?? "public"}.${row.tableName ?? ""}`,
      mainDatetimeColumn: row.mainDatetimeColumn ?? null,
      columns: cols.map((c) => ({ name: c.name, type: c.type, groupable: c.groupable ?? true, filterable: c.filterable ?? true })),
      metrics: mets.map((m) => ({ name: m.name, sqlExpression: m.sqlExpression, d3Format: m.d3Format ?? undefined, warningText: m.warningText ?? undefined })),
      createdBy: created,
      modifiedBy: modified,
      modified: (row.modifiedAt ?? row.createdAt).toISOString(),
      owners: [created],
      description: row.description ?? "",
      defaultEndpoint: row.defaultEndpoint ?? "",
      timeGrain: row.timeGrain ?? "P1D",
      cacheTimeout: row.cacheTimeout ?? null,
      offset: row.offset ?? 0,
      fetchValuesPredicate: row.fetchValuesPredicate ?? "",
      templateParams: row.templateParams ? JSON.stringify(row.templateParams) : "",
      sql: row.sql ?? null,
    },
  };
});
