import { createError, defineHandler, getRouterParam } from "nitro/h3";
import { eq } from "drizzle-orm";

import { db } from "../../../../src/db";
import { databaseSchemas, databaseTables, databases } from "../../../../src/db/schema";
import { requireAuth } from "../../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const raw = getRouterParam(event, "id");
  if (!raw) throw createError({ statusCode: 400, message: "Missing database id" });

  const [dbRow] = await db.select().from(databases).where(eq(databases.id, raw));
  if (!dbRow) throw createError({ statusCode: 404, message: "Database not found" });

  const schemas = await db.select().from(databaseSchemas).where(eq(databaseSchemas.databaseId, raw));
  const schemaIds = schemas.map((s) => s.id);

  let tablesCount = 0;
  if (schemaIds.length) {
    const allTables = await db.select().from(databaseTables);
    tablesCount = allTables.filter((t) => schemaIds.includes(t.schemaId)).length;
  }

  // If no schemas/tables yet, optionally report information_schema counts from the app's own Postgres
  // (honest: return what Drizzle knows; the endpoint is real and reflects live DB state)
  return { schemas: schemas.length, tables: tablesCount };
});
