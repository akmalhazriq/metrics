import { createError, defineHandler, readBody, setResponseStatus } from "nitro/h3";
import { eq } from "drizzle-orm";

import { db } from "../../../src/db";
import { databases, datasetColumns, datasetMetrics, datasets, users } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
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
    columns?: { name: string; type: string; groupable?: boolean; filterable?: boolean; description?: string; expression?: string }[];
    metrics?: { name: string; sqlExpression: string; d3Format?: string; warningText?: string; description?: string }[];
    owners?: number[];
    tags?: string[];
  };

  const name = (body?.name ?? "").trim();
  const databaseId = (body?.databaseId ?? "").trim();
  const schemaName = (body?.schema ?? "").trim() || "public";
  const tableNameRaw = (body?.tableName ?? body?.table ?? "").trim();
  const type = (body?.type ?? "physical").trim() as "physical" | "virtual";
  const sql = body?.sql != null ? String(body.sql).trim() : null;
  const mainDatetimeColumn = body?.mainDatetimeColumn ? String(body.mainDatetimeColumn).trim() || null : null;

  if (!name) throw createError({ statusCode: 400, statusMessage: "name is required" });
  if (!databaseId) throw createError({ statusCode: 400, statusMessage: "databaseId is required" });
  if (type !== "physical" && type !== "virtual") throw createError({ statusCode: 400, statusMessage: "type must be physical or virtual" });
  if (type === "virtual" && !sql) throw createError({ statusCode: 400, statusMessage: "sql is required for virtual datasets" });
  if (type === "physical" && !tableNameRaw) throw createError({ statusCode: 400, statusMessage: "tableName is required for physical datasets" });

  const [dbRow] = await db.select().from(databases).where(eq(databases.id, databaseId));
  if (!dbRow) throw createError({ statusCode: 400, statusMessage: `database "${databaseId}" not found` });

  const tableName = type === "virtual" ? null : tableNameRaw || null;

  let templateParamsVal: unknown = null;
  if (body?.templateParams != null) {
    if (typeof body.templateParams === "string") {
      try { templateParamsVal = JSON.parse(body.templateParams as string); } catch { templateParamsVal = body.templateParams; }
    } else templateParamsVal = body.templateParams;
  }

  const fallbackUser = (await db.select().from(users).limit(1))[0] ?? null;
  const userId = fallbackUser?.id ?? null;

  const inserted = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(datasets)
      .values({
        name,
        databaseId,
        schema: schemaName,
        tableName,
        type,
        mainDatetimeColumn,
        description: body?.description?.trim() || null,
        sql: type === "virtual" ? sql : null,
        defaultEndpoint: body?.defaultEndpoint?.trim() || null,
        timeGrain: body?.timeGrain?.trim() || null,
        cacheTimeout: body?.cacheTimeout ?? null,
        offset: body?.offset ?? null,
        fetchValuesPredicate: body?.fetchValuesPredicate?.trim() || null,
        templateParams: templateParamsVal as never,
        modifiedById: userId,
        createdById: userId,
      })
      .returning();

    const cols = Array.isArray(body?.columns) ? body.columns : [];
    if (cols.length) {
      await tx.insert(datasetColumns).values(
        cols
          .filter((c) => c.name?.trim())
          .map((c) => ({
            datasetId: row.id,
            name: c.name.trim(),
            type: c.type?.trim() || "VARCHAR",
            groupable: !!c.groupable,
            filterable: !!c.filterable,
            description: c.description?.trim() || null,
            expression: c.expression?.trim() || null,
          })),
      );
    }
    const metrics = Array.isArray(body?.metrics) ? body.metrics : [];
    if (metrics.length) {
      await tx.insert(datasetMetrics).values(
        metrics
          .filter((m) => m.name?.trim() && m.sqlExpression?.trim())
          .map((m) => ({
            datasetId: row.id,
            name: m.name.trim(),
            sqlExpression: m.sqlExpression.trim(),
            d3Format: m.d3Format?.trim() || null,
            warningText: m.warningText?.trim() || null,
            description: m.description?.trim() || null,
          })),
      );
    }
    return row;
  });

  setResponseStatus(event, 201);
  return {
    id: inserted.id,
    name: inserted.name,
    type: inserted.type,
    databaseId: inserted.databaseId,
    schema: inserted.schema,
    table: inserted.tableName,
  };
});