import { createError, defineHandler, getRouterParam } from "nitro/h3";
import { eq } from "drizzle-orm";

import { db } from "../../../src/db";
import { databaseSchemas, databaseTableColumns, databaseTables, databases, users } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const raw = getRouterParam(event, "id");
  const id = String(raw ?? "").trim();
  if (!id) throw createError({ statusCode: 400, message: "Invalid database id" });

  const [dbRow] = await db.select().from(databases).where(eq(databases.id, id));
  if (!dbRow) throw createError({ statusCode: 404, message: "Database not found" });

  const [allUsers, schemaRows, tableRows, colRows] = await Promise.all([
    db.select().from(users),
    db.select().from(databaseSchemas).where(eq(databaseSchemas.databaseId, id)),
    db.select().from(databaseTables),
    db.select().from(databaseTableColumns),
  ]);

  const userName = new Map(allUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
  // group columns by table
  const colsByTable = new Map<number, { name: string; type: string }[]>();
  for (const c of colRows) {
    const arr = colsByTable.get(c.tableId) ?? [];
    arr.push({ name: c.name, type: c.type });
    colsByTable.set(c.tableId, arr);
  }
  // tables by schemaId
  const tablesGrouped = new Map<number, typeof tableRows>();
  for (const t of tableRows) {
    const arr = tablesGrouped.get(t.schemaId) ?? [];
    arr.push(t);
    tablesGrouped.set(t.schemaId, arr);
  }

  const schemas = schemaRows.map((s) => ({
    name: s.name,
    tables: (tablesGrouped.get(s.id) ?? []).map((t) => ({
      name: t.name,
      rowCount: t.rowCount ?? undefined,
      columns: colsByTable.get(t.id) ?? [],
    })),
  }));

  const createdId = dbRow.createdById ?? dbRow.modifiedById;
  const created = createdId ? { id: createdId, name: userName.get(createdId) ?? String(createdId) } : { id: 0, name: "Sample" };
  const modifiedId = dbRow.modifiedById ?? dbRow.createdById;
  const modified = modifiedId ? { id: modifiedId, name: userName.get(modifiedId) ?? String(modifiedId) } : created;

  return {
    data: {
      id: dbRow.id,
      name: dbRow.name,
      backend: dbRow.backend,
      sqlalchemyUri: dbRow.sqlalchemyUri,
      serverCert: dbRow.serverCert ?? undefined,
      extraParams: dbRow.extra ?? undefined,
      impersonateUser: dbRow.impersonateUser ?? false,
      exposedInSqlLab: dbRow.exposeInSqlLab ?? true,
      allowDML: dbRow.allowDml ?? false,
      allowCTA: dbRow.allowCta ?? false,
      allowCsvUpload: dbRow.allowCsvUpload ?? false,
      allowRunSync: dbRow.allowRunSync ?? true,
      secureExtra: dbRow.secureExtra ?? undefined,
      encryptedExtra: dbRow.encryptedExtra ?? undefined,
      cacheEnabled: dbRow.queryCache ?? false,
      cacheTimeout: dbRow.cacheTimeout ?? null,
      asyncExecution: dbRow.asyncExecution ?? false,
      concurrency: dbRow.concurrency ?? null,
      forceSqlLab: dbRow.forceSqlLab ?? false,
      templateParams: dbRow.templateParams ? JSON.stringify(dbRow.templateParams) : undefined,
      queryTimeout: dbRow.queryTimeout ?? null,
      maxRows: dbRow.maxRows ?? null,
      defaultSchema: dbRow.defaultSchema ?? undefined,
      defaultLimit: dbRow.defaultLimit ?? null,
      owners: [created],
      version: dbRow.version ?? undefined,
      schemaCacheEnabled: dbRow.schemaCache ?? false,
      sshTunnelEnabled: !!(dbRow.sshTunnelHost || dbRow.sshTunnelPort),
      sshTunnelHost: dbRow.sshTunnelHost ?? undefined,
      sshTunnelPort: dbRow.sshTunnelPort ?? null,
      modifiedBy: modified,
      modified: (dbRow.modifiedAt ?? dbRow.createdAt).toISOString(),
      schemas,
    },
  };
});
