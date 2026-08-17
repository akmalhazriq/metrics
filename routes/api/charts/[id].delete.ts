/**
 * DELETE /api/charts/:id — Drizzle/Postgres
 */
import { createError, defineHandler, getRouterParam } from "nitro/h3";
import { and, eq } from "drizzle-orm";

import { db } from "../../../src/db";
import { charts, favorites } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const raw = getRouterParam(event, "id");
  const id = Number(raw);
  if (!raw || Number.isNaN(id)) throw createError({ statusCode: 400, message: "Invalid chart id" });

  const existing = await db.select().from(charts).where(eq(charts.id, id));
  if (!existing.length) throw createError({ statusCode: 404, message: "Chart not found" });

  await db.delete(favorites).where(and(eq(favorites.entityType, "chart"), eq(favorites.entityId, id)));
  await db.delete(charts).where(eq(charts.id, id));

  return { ok: true };
});