import { createError, defineHandler, readBody, setResponseStatus } from "nitro/h3";

import { db } from "../../../src/db";
import { databaseSchemas, databaseTableColumns, databaseTables, databases, users } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

function slugId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 24).replace(/^_+|_+$/g, "") || `db_${Date.now()}`;
}

export default defineHandler(async (event) => {
  await requireAuth(event);
  const body = (await readBody(event)) as {
    id?: string;
    name?: string;
    backend?: string;
    sqlalchemyUri?: string;
    serverCert?: string;
    extraParams?: string;
    extra?: string;
    impersonateUser?: boolean;
    exposedInSqlLab?: boolean;
    exposeInSqlLab?: boolean;
    allowDML?: boolean;
    allowDml?: boolean;
    allowCTA?: boolean;
    allowCta?: boolean;
    allowCsvUpload?: boolean;
    allowRunSync?: boolean;
    secureExtra?: string;
    encryptedExtra?: string;
    cacheEnabled?: boolean;
    queryCache?: boolean;
    cacheTimeout?: number | null;
    asyncExecution?: boolean;
    concurrency?: number | null;
    forceSqlLab?: boolean;
    templateParams?: unknown;
    queryTimeout?: number | null;
    maxRows?: number | null;
    defaultSchema?: string;
    defaultLimit?: number | null;
    version?: string;
    schemaCacheEnabled?: boolean;
    schemaCache?: boolean;
    sshTunnelEnabled?: boolean;
    sshTunnelHost?: string;
    sshTunnelPort?: number | null;
    schemas?: { name: string; tables?: { name: string; rowCount?: number; columns?: { name: string; type: string }[] }[] }[];
  };

  const name = (body?.name ?? "").trim();
  const sqlalchemyUri = (body?.sqlalchemyUri ?? "").trim();
  const backend = (body?.backend ?? "Postgres").trim() || "Postgres";

  if (!name) throw createError({ statusCode: 400, statusMessage: "name is required" });
  if (!sqlalchemyUri) throw createError({ statusCode: 400, statusMessage: "sqlalchemyUri is required" });

  let id = (body?.id ?? "").trim() || slugId(name);
  // Ensure unique id — suffix if collision
  const existingIds = new Set((await db.select({ id: databases.id }).from(databases)).map((r) => r.id));
  if (existingIds.has(id)) id = `${id}_${Date.now().toString(36).slice(-4)}`;

  const fallbackUser = (await db.select().from(users).limit(1))[0] ?? null;
  const userId = fallbackUser?.id ?? null;

  const templateParamsVal = (() => {
    if (body?.templateParams == null) return null;
    if (typeof body.templateParams === "string") {
      try { return JSON.parse(body.templateParams as string); } catch { return body.templateParams; }
    }
    return body.templateParams;
  })();

  const impersonateUser = body?.impersonateUser ?? false;
  const exposeInSqlLab = body?.exposedInSqlLab ?? body?.exposeInSqlLab ?? true;
  const allowDml = body?.allowDml ?? body?.allowDML ?? false;
  const allowCta = body?.allowCta ?? body?.allowCTA ?? false;
  const allowCsvUpload = body?.allowCsvUpload ?? false;
  const allowRunSync = body?.allowRunSync ?? true;
  const queryCache = body?.queryCache ?? body?.cacheEnabled ?? false;
  const schemaCache = body?.schemaCache ?? body?.schemaCacheEnabled ?? false;

  await db.transaction(async (tx) => {
    await tx.insert(databases).values({
      id,
      name,
      backend,
      sqlalchemyUri,
      exposeInSqlLab: !!exposeInSqlLab,
      allowRunSync: !!allowRunSync,
      allowDml: !!allowDml,
      allowCta: !!allowCta,
      allowCsvUpload: !!allowCsvUpload,
      secureExtra: body?.secureExtra?.trim() || null,
      encryptedExtra: body?.encryptedExtra?.trim() || null,
      serverCert: body?.serverCert?.trim() || null,
      extra: (body?.extraParams ?? body?.extra ?? "").trim() || null,
      impersonateUser: !!impersonateUser,
      queryCache: !!queryCache,
      cacheTimeout: body?.cacheTimeout ?? null,
      asyncExecution: !!body?.asyncExecution,
      concurrency: body?.concurrency ?? null,
      forceSqlLab: !!body?.forceSqlLab,
      templateParams: templateParamsVal as never,
      queryTimeout: body?.queryTimeout ?? null,
      maxRows: body?.maxRows ?? null,
      defaultSchema: body?.defaultSchema?.trim() || null,
      defaultLimit: body?.defaultLimit ?? null,
      version: body?.version?.trim() || null,
      schemaCache: !!schemaCache,
      sshTunnelHost: body?.sshTunnelHost?.trim() || null,
      sshTunnelPort: body?.sshTunnelPort ?? null,
      modifiedById: userId,
      createdById: userId,
    });

    const schemas = Array.isArray(body?.schemas) ? body.schemas : [];
    for (const s of schemas) {
      const sName = (s.name ?? "").trim();
      if (!sName) continue;
      const [insSchema] = await tx.insert(databaseSchemas).values({ databaseId: id, name: sName }).returning();
      const tables = Array.isArray(s.tables) ? s.tables : [];
      for (const t of tables) {
        const tName = (t.name ?? "").trim();
        if (!tName) continue;
        const [insTable] = await tx.insert(databaseTables).values({ schemaId: insSchema.id, name: tName, rowCount: t.rowCount ?? null }).returning();
        const cols = Array.isArray(t.columns) ? t.columns : [];
        if (cols.length) {
          await tx.insert(databaseTableColumns).values(
            cols.filter((c) => c.name?.trim()).map((c) => ({
              tableId: insTable.id,
              name: c.name.trim(),
              type: c.type?.trim() || "VARCHAR",
            })),
          );
        }
      }
    }
  });

  setResponseStatus(event, 201);
  return { id, name, backend };
});