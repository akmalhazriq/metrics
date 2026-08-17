/**
 * GET /api/databases — Drizzle/Postgres
 *
 * Separate selects + TS join for schemas/tables/columns. Filtering
 * by q (name substring) and backend, sorted by name/backend/modified,
 * paginated. Returns DatabaseConnection shape.
 */
import { defineHandler, getQuery } from "nitro/h3";

import { db } from "../../../src/db";
import { databaseSchemas, databaseTableColumns, databaseTables, databases, users } from "../../../src/db/schema";
import type { DatabaseBackend } from "../../../src/types/database";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const query = getQuery(event) as Record<string, string | undefined>;
  const q = (query.q ?? "").toLowerCase().trim();
  const backend = query.backend as DatabaseBackend | "all" | undefined;
  const sortBy = (query.sortBy as "name" | "backend" | "modified" | undefined) ?? "modified";
  const sortDir = (query.sortDir as "asc" | "desc" | undefined) ?? "desc";
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize ?? 10) || 10));

  const [dbRows, allUsers, schemaRows, tableRows, colRows] = await Promise.all([
    db.select().from(databases),
    db.select().from(users),
    db.select().from(databaseSchemas),
    db.select().from(databaseTables),
    db.select().from(databaseTableColumns),
  ]);

  const userObj = new Map(allUsers.map((u) => [u.id, { id: u.id, name: `${u.firstName} ${u.lastName}`.trim() }]));

  // group columns by tableId
  const colsByTable = new Map<number, { name: string; type: string }[]>();
  for (const c of colRows) {
    const arr = colsByTable.get(c.tableId) ?? [];
    arr.push({ name: c.name, type: c.type });
    colsByTable.set(c.tableId, arr);
  }

  // tables by schemaId
  const tablesBySchema = new Map<number, (typeof tableRows)[number][]>();
  for (const t of tableRows) {
    const arr = tablesBySchema.get(t.schemaId) ?? [];
    arr.push(t);
    tablesBySchema.set(t.schemaId, arr);
  }

  // schemas by databaseId
  const schemasByDb = new Map<string, (typeof schemaRows)[number][]>();
  for (const s of schemaRows) {
    const arr = schemasByDb.get(s.databaseId) ?? [];
    arr.push(s);
    schemasByDb.set(s.databaseId, arr);
  }

  let data = dbRows.map((d) => {
    const schemas = (schemasByDb.get(d.id) ?? []).map((s) => ({
      name: s.name,
      tables: (tablesBySchema.get(s.id) ?? []).map((t) => ({
        name: t.name,
        rowCount: t.rowCount ?? undefined,
        columns: colsByTable.get(t.id) ?? [],
      })),
    }));

    const createdId = d.createdById ?? d.modifiedById; const created = createdId ? (userObj.get(createdId) ?? { id: createdId, name: "Sample" }) : { id: 0, name: "Sample" };
    const modifiedId = d.modifiedById ?? d.createdById; const modified = modifiedId ? (userObj.get(modifiedId) ?? { id: modifiedId, name: "Sample" }) : { id: 0, name: "Sample" };

    return {
      id: d.id,
      name: d.name,
      backend: d.backend as DatabaseBackend,
      sqlalchemyUri: d.sqlalchemyUri,
      serverCert: d.serverCert ?? undefined,
      extraParams: d.extra ?? undefined,
      impersonateUser: d.impersonateUser ?? false,
      exposedInSqlLab: d.exposeInSqlLab ?? true,
      allowDML: d.allowDml ?? false,
      allowCTA: d.allowCta ?? false,
      allowCsvUpload: d.allowCsvUpload ?? false,
      allowRunSync: d.allowRunSync ?? true,
      secureExtra: d.secureExtra ?? undefined,
      encryptedExtra: d.encryptedExtra ?? undefined,
      cacheEnabled: d.queryCache ?? false,
      cacheTimeout: d.cacheTimeout ?? null,
      asyncExecution: d.asyncExecution ?? false,
      concurrency: d.concurrency ?? null,
      forceSqlLab: d.forceSqlLab ?? false,
      templateParams: d.templateParams ? JSON.stringify(d.templateParams) : undefined,
      queryTimeout: d.queryTimeout ?? null,
      maxRows: d.maxRows ?? null,
      defaultSchema: d.defaultSchema ?? undefined,
      defaultLimit: d.defaultLimit ?? null,
      owners: [created],
      version: d.version ?? undefined,
      schemaCacheEnabled: d.schemaCache ?? false,
      sshTunnelEnabled: !!(d.sshTunnelHost || d.sshTunnelPort),
      sshTunnelHost: d.sshTunnelHost ?? undefined,
      sshTunnelPort: d.sshTunnelPort ?? null,
      modifiedBy: modified,
      modified: (d.modifiedAt ?? d.createdAt).toISOString(),
      schemas,
    };
  });

  if (q) data = data.filter((d) => d.name.toLowerCase().includes(q));
  if (backend && backend !== "all") data = data.filter((d) => d.backend === backend);

  data.sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortBy === "name") return dir * a.name.localeCompare(b.name);
    if (sortBy === "backend") return dir * a.backend.localeCompare(b.backend);
    return dir * a.modified.localeCompare(b.modified);
  });

  const total = data.length;
  const start = (page - 1) * pageSize;
  const sliced = data.slice(start, start + pageSize);
  return { data: sliced, total, page, pageSize };
});