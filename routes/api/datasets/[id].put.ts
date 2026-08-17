import { createError, defineHandler, getRouterParam, readBody } from "nitro/h3";
import { eq } from "drizzle-orm";

import { db } from "../../../src/db";
import { databases, datasetColumns, datasetMetrics, datasets } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const idParam = getRouterParam(event, "id");
  const id = Number(idParam);
  if (!Number.isFinite(id)) throw createError({ statusCode: 400, statusMessage: "invalid id" });

  const body = (await readBody(event)) as {
    name?: string;
    databaseId?: string;
    schema?: string;
    tableName?: string;
    table?: string | null;
    type?: string;
    mainDatetimeColumn?: string | null;
    description?: string;
    sql?: string | null;
    defaultEndpoint?: string;
    timeGrain?: string;
    cacheTimeout?: number | null;
    offset?: number;
    fetchValuesPredicate?: string;
    templateParams?: unknown;
    columns?: { name: string; type: string; groupable?: boolean; filterable?: boolean; description?: string; expression?: string }[] | null;
    metrics?: { name: string; sqlExpression: string; d3Format?: string; warningText?: string; description?: string }[] | null;
  };

  const [existing] = await db.select().from(datasets).where(eq(datasets.id, id));
  if (!existing) throw createError({ statusCode: 404, statusMessage: "dataset not found" });

  if (body?.databaseId) {
    const [dbRow] = await db.select().from(databases).where(eq(databases.id, body.databaseId.trim()));
    if (!dbRow) throw createError({ statusCode: 400, statusMessage: `database "${body.databaseId}" not found` });
  }

  const patch: Record<string, unknown> = { modifiedAt: new Date() };
  if (body?.name != null) {
    const v = String(body.name).trim();
    if (!v) throw createError({ statusCode: 400, statusMessage: "name cannot be empty" });
    patch.name = v;
  }
  if (body?.databaseId != null) patch.databaseId = String(body.databaseId).trim();
  if (body?.schema != null) patch.schema = String(body.schema).trim() || "public";
  if (body?.tableName != null || body?.table !== undefined) {
    const v = String(body.tableName ?? body.table ?? "").trim();
    patch.tableName = v || null;
  }
  if (body?.type != null) {
    const t = String(body.type).trim();
    if (t !== "physical" && t !== "virtual") throw createError({ statusCode: 400, statusMessage: "type must be physical or virtual" });
    patch.type = t;
  }
  if (body?.mainDatetimeColumn !== undefined) patch.mainDatetimeColumn = body.mainDatetimeColumn ? String(body.mainDatetimeColumn).trim() || null : null;
  if (body?.description !== undefined) patch.description = body.description ? String(body.description).trim() || null : null;
  if (body?.sql !== undefined) patch.sql = body.sql ? String(body.sql).trim() || null : null;
  if (body?.defaultEndpoint !== undefined) patch.defaultEndpoint = body.defaultEndpoint ? String(body.defaultEndpoint).trim() || null : null;
  if (body?.timeGrain !== undefined) patch.timeGrain = body.timeGrain ? String(body.timeGrain).trim() || null : null;
  if (body?.cacheTimeout !== undefined) patch.cacheTimeout = body.cacheTimeout;
  if (body?.offset !== undefined) patch.offset = body.offset;
  if (body?.fetchValuesPredicate !== undefined) patch.fetchValuesPredicate = body.fetchValuesPredicate ? String(body.fetchValuesPredicate).trim() || null : null;
  if (body?.templateParams !== undefined) {
    if (body.templateParams == null) patch.templateParams = null;
    else if (typeof body.templateParams === "string") {
      try { patch.templateParams = JSON.parse(body.templateParams); } catch { patch.templateParams = body.templateParams; }
    } else patch.templateParams = body.templateParams;
  }

  // Validate virtual vs physical after patch
  const finalType = (patch.type as string) ?? existing.type;
  const finalSql = (patch.sql as string | null) ?? existing.sql;
  const finalTable = (patch.tableName as string | null) ?? existing.tableName;
  if (finalType === "virtual" && !finalSql) throw createError({ statusCode: 400, statusMessage: "sql is required for virtual datasets" });
  if (finalType === "physical" && !finalTable) throw createError({ statusCode: 400, statusMessage: "tableName is required for physical datasets" });

  await db.transaction(async (tx) => {
    await tx.update(datasets).set(patch as never).where(eq(datasets.id, id));
    if (body?.columns !== undefined) {
      await tx.delete(datasetColumns).where(eq(datasetColumns.datasetId, id));
      const cols = Array.isArray(body.columns) ? body.columns : [];
      if (cols.length) {
        await tx.insert(datasetColumns).values(
          cols.filter((c) => c.name?.trim()).map((c) => ({
            datasetId: id,
            name: c.name.trim(),
            type: c.type?.trim() || "VARCHAR",
            groupable: !!c.groupable,
            filterable: !!c.filterable,
            description: c.description?.trim() || null,
            expression: c.expression?.trim() || null,
          })),
        );
      }
    }
    if (body?.metrics !== undefined) {
      await tx.delete(datasetMetrics).where(eq(datasetMetrics.datasetId, id));
      const metrics = Array.isArray(body.metrics) ? body.metrics : [];
      if (metrics.length) {
        await tx.insert(datasetMetrics).values(
          metrics.filter((m) => m.name?.trim() && m.sqlExpression?.trim()).map((m) => ({
            datasetId: id,
            name: m.name.trim(),
            sqlExpression: m.sqlExpression.trim(),
            d3Format: m.d3Format?.trim() || null,
            warningText: m.warningText?.trim() || null,
            description: m.description?.trim() || null,
          })),
        );
      }
    }
    // sampleRows not patched via this handler — left as-is
  });

  const [updated] = await db.select().from(datasets).where(eq(datasets.id, id));
  return { id: updated.id, name: updated.name, type: updated.type };
});