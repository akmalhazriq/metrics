import { createError, defineHandler, getRouterParam, setResponseStatus } from "nitro/h3";
import { eq } from "drizzle-orm";

import { db } from "../../../src/db";
import { databases, datasets } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const id = String(getRouterParam(event, "id") ?? "").trim();
  if (!id) throw createError({ statusCode: 400, statusMessage: "invalid id" });

  const [existing] = await db.select().from(databases).where(eq(databases.id, id));
  if (!existing) throw createError({ statusCode: 404, statusMessage: "database not found" });

  const referencing = await db.select({ id: datasets.id }).from(datasets).where(eq(datasets.databaseId, id)).limit(1);
  if (referencing.length) {
    throw createError({ statusCode: 409, statusMessage: `Cannot delete database "${id}" — ${referencing.length} dataset(s) still reference it. Delete or move them first.` });
  }

  await db.delete(databases).where(eq(databases.id, id));
  // schemas/tables/columns cascade via FK

  setResponseStatus(event, 204);
  return null;
});