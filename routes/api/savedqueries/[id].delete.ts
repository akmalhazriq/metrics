import { createError, defineHandler, getRouterParam, setResponseStatus } from "nitro/h3";
import { eq } from "drizzle-orm";

import { db } from "../../../src/db";
import { savedQueries } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id)) throw createError({ statusCode: 400, statusMessage: "invalid id" });

  const [existing] = await db.select().from(savedQueries).where(eq(savedQueries.id, id));
  if (!existing) throw createError({ statusCode: 404, statusMessage: "saved query not found" });

  await db.delete(savedQueries).where(eq(savedQueries.id, id));
  setResponseStatus(event, 204);
  return null;
});