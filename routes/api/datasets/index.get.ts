/**
 * GET /api/datasets — Drizzle/Postgres
 *
 * Separate selects + TS join: datasets → databases for backend/name,
 * dataset_columns/metrics/sample_rows for nested arrays. Filtering mirrors
 * previous in-memory handler (q/database/schema/owner/type + sort/pagination).
 */
import { defineHandler, getQuery } from "nitro/h3";

import { db } from "../../../src/db";
import { datasetColumns, datasetMetrics, datasetSampleRows, datasets, databases, users } from "../../../src/db/schema";
import type { Dataset, DatasetType } from "../../../src/types/dataset";
import { requireAuth } from "../../../src/lib/requireAuth";

// owners not stored for datasets in earlier schema — fetch via dataset owner implicit? Seed uses createdBy/owners.
// Schema has no dataset_owners table; owners derived from createdBy/modifiedBy for now.
// Check schema.ts — datasets only has createdById/modifiedById, no junction. Keep owners as those two.

export default defineHandler(async (event) => {
  await requireAuth(event);
  const q = getQuery(event) as Record<string, string | undefined>;
  const search = (q.q ?? "").toLowerCase().trim();
  const database = (q.database ?? "").trim();
  const schemaFilter = (q.schema ?? "").trim();
  const owner = (q.owner ?? "").toLowerCase().trim();
  const type = q.type as DatasetType | "all" | undefined;
  const sortBy = (q.sortBy as "name" | "modified" | "database" | undefined) ?? "modified";
  const sortDir = (q.sortDir as "asc" | "desc" | undefined) ?? "desc";
  const page = Math.max(1, Number(q.page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(q.pageSize ?? 10) || 10));

  const [rows, allUsers, dbRows, colRows, metricRows, sampleRows] = await Promise.all([
    db.select().from(datasets),
    db.select().from(users),
    db.select().from(databases),
    db.select().from(datasetColumns),
    db.select().from(datasetMetrics),
    db.select().from(datasetSampleRows),
  ]);

  const userObj = new Map(allUsers.map((u) => [u.id, { id: u.id, name: `${u.firstName} ${u.lastName}`.trim() }]));
  const dbById = new Map(dbRows.map((d) => [d.id, d]));

  const colsByDs = new Map<number, typeof colRows>();
  for (const c of colRows) {
    const arr = colsByDs.get(c.datasetId) ?? [];
    arr.push(c);
    colsByDs.set(c.datasetId, arr);
  }
  const metricsByDs = new Map<number, typeof metricRows>();
  for (const m of metricRows) {
    const arr = metricsByDs.get(m.datasetId) ?? [];
    arr.push(m);
    metricsByDs.set(m.datasetId, arr);
  }
  const samplesByDs = new Map<number, Record<string, unknown>[]>();
  for (const s of sampleRows) {
    const arr = samplesByDs.get(s.datasetId) ?? [];
    arr.push(s.rowData as Record<string, unknown>);
    samplesByDs.set(s.datasetId, arr);
  }

  let data: Dataset[] = rows.map((r) => {
    const dbRec = dbById.get(r.databaseId);
    const cols = (colsByDs.get(r.id) ?? []).map((c) => ({
      name: c.name,
      type: c.type,
      groupable: c.groupable ?? false,
      filterable: c.filterable ?? false,
      description: c.description ?? undefined,
      expression: c.expression ?? undefined,
    }));
    const metrics = (metricsByDs.get(r.id) ?? []).map((m) => ({
      name: m.name,
      sqlExpression: m.sqlExpression,
      d3Format: m.d3Format ?? undefined,
      warningText: m.warningText ?? undefined,
      description: m.description ?? undefined,
    }));
    const samples = samplesByDs.get(r.id) ?? [];
    const createdId2 = r.createdById ?? r.modifiedById; const created = createdId2 ? (userObj.get(createdId2) ?? { id: createdId2, name: "Sample" }) : { id: 0, name: "Sample" };
    const modifiedId2 = r.modifiedById ?? r.createdById; const modified = modifiedId2 ? (userObj.get(modifiedId2) ?? { id: modifiedId2, name: "Sample" }) : { id: 0, name: "Sample" };
    const owners = [created, modified].filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i);
    return {
      id: r.id,
      name: r.name,
      type: r.type as DatasetType,
      databaseId: r.databaseId,
      databaseName: dbRec?.name ?? r.databaseId,
      backend: (dbRec?.backend as Dataset["backend"]) ?? "Postgres",
      schema: r.schema,
      table: r.tableName ?? null,
      source: r.tableName ? `${r.databaseId}.${r.schema}.${r.tableName}` : r.sql ? `${r.databaseId}: ${r.sql.slice(0, 40)}` : r.name,
      mainDatetimeColumn: r.mainDatetimeColumn ?? null,
      columns: cols,
      metrics,
      createdBy: created,
      modifiedBy: modified,
      modified: (r.modifiedAt ?? r.createdAt).toISOString(),
      owners,
      description: r.description ?? undefined,
      defaultEndpoint: r.defaultEndpoint ?? undefined,
      timeGrain: r.timeGrain ?? undefined,
      cacheTimeout: r.cacheTimeout ?? null,
      offset: r.offset ?? undefined,
      fetchValuesPredicate: r.fetchValuesPredicate ?? undefined,
      templateParams: r.templateParams ? JSON.stringify(r.templateParams) : undefined,
      sql: r.sql ?? undefined,
      sampleRows: samples as Dataset["sampleRows"],
    };
  });

  if (search) data = data.filter((d) => d.name.toLowerCase().includes(search));
  if (database) data = data.filter((d) => d.databaseId === database);
  if (schemaFilter) data = data.filter((d) => d.schema === schemaFilter);
  if (owner) data = data.filter((d) => d.owners.some((o) => o.name.toLowerCase().includes(owner)));
  if (type && type !== "all") data = data.filter((d) => d.type === type);

  data.sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortBy === "name") return dir * a.name.localeCompare(b.name);
    if (sortBy === "database") return dir * a.databaseName.localeCompare(b.databaseName);
    return dir * a.modified.localeCompare(b.modified);
  });

  const total = data.length;
  const start = (page - 1) * pageSize;
  const sliced = data.slice(start, start + pageSize);
  return { data: sliced, total, page, pageSize };
});