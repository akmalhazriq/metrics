import { createError, defineHandler, getRouterParam, setResponseStatus } from "nitro/h3";
import { eq } from "drizzle-orm";

import { db } from "../../../src/db";
import { datasets } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id)) throw createError({ statusCode: 400, statusMessage: "invalid id" });

  const [existing] = await db.select().from(datasets).where(eq(datasets.id, id));
  if (!existing) throw createError({ statusCode: 404, statusMessage: "dataset not found" });

  // cascade deletes columns/metrics/sample_rows via FK onDelete cascade
  await db.delete(datasets).where(eq(datasets.id, id));

  setResponseStatus(event, 204);
  return null;
});