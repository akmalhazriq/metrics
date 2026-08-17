import { createError, defineHandler, getRouterParam, readBody } from "nitro/h3";
import { eq } from "drizzle-orm";

import { db } from "../../../src/db";
import { databaseSchemas, databaseTableColumns, databaseTables, databases } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const id = String(getRouterParam(event, "id") ?? "").trim();
  if (!id) throw createError({ statusCode: 400, statusMessage: "invalid id" });

  const body = (await readBody(event)) as {
    name?: string;
    backend?: string;
    sqlalchemyUri?: string;
    serverCert?: string | null;
    extraParams?: string | null;
    extra?: string | null;
    impersonateUser?: boolean;
    exposedInSqlLab?: boolean;
    exposeInSqlLab?: boolean;
    allowDML?: boolean;
    allowDml?: boolean;
    allowCTA?: boolean;
    allowCta?: boolean;
    allowCsvUpload?: boolean;
    allowRunSync?: boolean;
    secureExtra?: string | null;
    encryptedExtra?: string | null;
    cacheEnabled?: boolean;
    queryCache?: boolean;
    cacheTimeout?: number | null;
    asyncExecution?: boolean;
    concurrency?: number | null;
    forceSqlLab?: boolean;
    templateParams?: unknown;
    queryTimeout?: number | null;
    maxRows?: number | null;
    defaultSchema?: string | null;
    defaultLimit?: number | null;
    version?: string | null;
    schemaCacheEnabled?: boolean;
    schemaCache?: boolean;
    sshTunnelHost?: string | null;
    sshTunnelPort?: number | null;
    schemas?: { name: string; tables?: { name: string; rowCount?: number; columns?: { name: string; type: string }[] }[] }[] | null;
  };

  const [existing] = await db.select().from(databases).where(eq(databases.id, id));
  if (!existing) throw createError({ statusCode: 404, statusMessage: "database not found" });

  const patch: Record<string, unknown> = { modifiedAt: new Date() };
  if (body?.name !== undefined) {
    const v = String(body.name).trim();
    if (!v) throw createError({ statusCode: 400, statusMessage: "name cannot be empty" });
    patch.name = v;
  }
  if (body?.backend !== undefined) patch.backend = String(body.backend).trim() || existing.backend;
  if (body?.sqlalchemyUri !== undefined) {
    const v = String(body.sqlalchemyUri).trim();
    if (!v) throw createError({ statusCode: 400, statusMessage: "sqlalchemyUri cannot be empty" });
    patch.sqlalchemyUri = v;
  }
  if (body?.serverCert !== undefined) patch.serverCert = body.serverCert ? String(body.serverCert).trim() || null : null;
  if (body?.extraParams !== undefined || body?.extra !== undefined) {
    const v = String(body.extraParams ?? body.extra ?? "").trim();
    patch.extra = v || null;
  }
  if (body?.impersonateUser !== undefined) patch.impersonateUser = !!body.impersonateUser;
  if (body?.exposedInSqlLab !== undefined || body?.exposeInSqlLab !== undefined) patch.exposeInSqlLab = !!(body.exposedInSqlLab ?? body.exposeInSqlLab);
  if (body?.allowDml !== undefined || body?.allowDML !== undefined) patch.allowDml = !!(body.allowDml ?? body.allowDML);
  if (body?.allowCta !== undefined || body?.allowCTA !== undefined) patch.allowCta = !!(body.allowCta ?? body.allowCTA);
  if (body?.allowCsvUpload !== undefined) patch.allowCsvUpload = !!body.allowCsvUpload;
  if (body?.allowRunSync !== undefined) patch.allowRunSync = !!body.allowRunSync;
  if (body?.secureExtra !== undefined) patch.secureExtra = body.secureExtra ? String(body.secureExtra).trim() || null : null;
  if (body?.encryptedExtra !== undefined) patch.encryptedExtra = body.encryptedExtra ? String(body.encryptedExtra).trim() || null : null;
  if (body?.queryCache !== undefined || body?.cacheEnabled !== undefined) patch.queryCache = !!(body.queryCache ?? body.cacheEnabled);
  if (body?.cacheTimeout !== undefined) patch.cacheTimeout = body.cacheTimeout;
  if (body?.asyncExecution !== undefined) patch.asyncExecution = !!body.asyncExecution;
  if (body?.concurrency !== undefined) patch.concurrency = body.concurrency;
  if (body?.forceSqlLab !== undefined) patch.forceSqlLab = !!body.forceSqlLab;
  if (body?.templateParams !== undefined) {
    if (body.templateParams == null) patch.templateParams = null;
    else if (typeof body.templateParams === "string") { try { patch.templateParams = JSON.parse(body.templateParams); } catch { patch.templateParams = body.templateParams; } }
    else patch.templateParams = body.templateParams;
  }
  if (body?.queryTimeout !== undefined) patch.queryTimeout = body.queryTimeout;
  if (body?.maxRows !== undefined) patch.maxRows = body.maxRows;
  if (body?.defaultSchema !== undefined) patch.defaultSchema = body.defaultSchema ? String(body.defaultSchema).trim() || null : null;
  if (body?.defaultLimit !== undefined) patch.defaultLimit = body.defaultLimit;
  if (body?.version !== undefined) patch.version = body.version ? String(body.version).trim() || null : null;
  if (body?.schemaCache !== undefined || body?.schemaCacheEnabled !== undefined) patch.schemaCache = !!(body.schemaCache ?? body.schemaCacheEnabled);
  if (body?.sshTunnelHost !== undefined) patch.sshTunnelHost = body.sshTunnelHost ? String(body.sshTunnelHost).trim() || null : null;
  if (body?.sshTunnelPort !== undefined) patch.sshTunnelPort = body.sshTunnelPort;

  await db.transaction(async (tx) => {
    if (Object.keys(patch).length) await tx.update(databases).set(patch as never).where(eq(databases.id, id));
    if (body?.schemas !== undefined) {
      // Replace schemas wholesale when provided (null/[] clears)
      await tx.delete(databaseSchemas).where(eq(databaseSchemas.databaseId, id));
      const schemas = Array.isArray(body.schemas) ? body.schemas : [];
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
              cols.filter((c) => c.name?.trim()).map((c) => ({ tableId: insTable.id, name: c.name.trim(), type: c.type?.trim() || "VARCHAR" })),
            );
          }
        }
      }
    }
  });

  const [updated] = await db.select().from(databases).where(eq(databases.id, id));
  return { id: updated.id, name: updated.name, backend: updated.backend };
});