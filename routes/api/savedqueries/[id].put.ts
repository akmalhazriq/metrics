import { createError, defineHandler, getRouterParam, readBody } from "nitro/h3";
import { eq } from "drizzle-orm";

import { db } from "../../../src/db";
import { databases, savedQueries } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id)) throw createError({ statusCode: 400, statusMessage: "invalid id" });

  const body = (await readBody(event)) as {
    name?: string;
    label?: string;
    sql?: string;
    databaseId?: string;
    database?: string;
    schema?: string;
    description?: string | null;
  };

  const [existing] = await db.select().from(savedQueries).where(eq(savedQueries.id, id));
  if (!existing) throw createError({ statusCode: 404, statusMessage: "saved query not found" });

  const patch: Record<string, unknown> = { modifiedAt: new Date() };
  if (body?.label !== undefined || body?.name !== undefined) {
    const v = String(body.label ?? body.name ?? "").trim();
    if (!v) throw createError({ statusCode: 400, statusMessage: "name cannot be empty" });
    patch.label = v;
  }
  if (body?.sql !== undefined) {
    const v = String(body.sql).trim();
    if (!v) throw createError({ statusCode: 400, statusMessage: "sql cannot be empty" });
    patch.sql = v;
  }
  if (body?.databaseId !== undefined || body?.database !== undefined) {
    const v = String(body.databaseId ?? body.database ?? "").trim();
    if (!v) throw createError({ statusCode: 400, statusMessage: "database cannot be empty" });
    const [dbRow] = await db.select().from(databases).where(eq(databases.id, v));
    if (!dbRow) throw createError({ statusCode: 400, statusMessage: `database "${v}" not found` });
    patch.databaseId = v;
  }
  if (body?.schema !== undefined) patch.schema = body.schema ? String(body.schema).trim() || null : null;
  if (body?.description !== undefined) patch.description = body.description ? String(body.description).trim() || null : null;

  await db.update(savedQueries).set(patch as never).where(eq(savedQueries.id, id));
  const [updated] = await db.select().from(savedQueries).where(eq(savedQueries.id, id));
  return { id: updated.id, name: updated.label, sql: updated.sql };
});