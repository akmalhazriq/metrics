import { createError, defineHandler, readBody, setResponseStatus } from "nitro/h3";
import { eq } from "drizzle-orm";

import { db } from "../../../src/db";
import { databases, savedQueries, users } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const body = (await readBody(event)) as {
    name?: string;
    label?: string;
    sql?: string;
    databaseId?: string;
    database?: string;
    schema?: string;
    description?: string;
  };

  const label = (body?.label ?? body?.name ?? "").trim();
  const sql = (body?.sql ?? "").trim();
  const databaseId = (body?.databaseId ?? body?.database ?? "").trim();
  const schemaVal = (body?.schema ?? "").trim() || null;
  const description = (body?.description ?? "").trim() || null;

  if (!label) throw createError({ statusCode: 400, statusMessage: "name/label is required" });
  if (!sql) throw createError({ statusCode: 400, statusMessage: "sql is required" });
  if (!databaseId) throw createError({ statusCode: 400, statusMessage: "databaseId is required" });

  const [dbRow] = await db.select().from(databases).where(eq(databases.id, databaseId));
  if (!dbRow) throw createError({ statusCode: 400, statusMessage: `database "${databaseId}" not found` });

  const fallbackUser = (await db.select().from(users).limit(1))[0] ?? null;
  const userId = fallbackUser?.id ?? null;

  const [inserted] = await db
    .insert(savedQueries)
    .values({
      label,
      sql,
      databaseId,
      schema: schemaVal,
      description,
      createdById: userId,
    })
    .returning();

  setResponseStatus(event, 201);
  return { id: inserted.id, name: inserted.label, database: inserted.databaseId, schema: inserted.schema, sql: inserted.sql };
});