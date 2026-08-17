/**
 * DELETE /api/dashboards/:id — Drizzle/Postgres
 *
 * Deletes dashboard and its related favorites.
 */
import { createError, defineHandler, getRouterParam } from "nitro/h3";
import { and, eq } from "drizzle-orm";

import { db } from "../../../src/db";
import { dashboards, favorites } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const raw = getRouterParam(event, "id");
  const id = Number(raw);
  if (!raw || Number.isNaN(id)) throw createError({ statusCode: 400, message: "Invalid dashboard id" });

  const existing = await db.select().from(dashboards).where(eq(dashboards.id, id));
  if (!existing.length) throw createError({ statusCode: 404, message: "Dashboard not found" });

  await db.delete(favorites).where(and(eq(favorites.entityType, "dashboard"), eq(favorites.entityId, id)));
  await db.delete(dashboards).where(eq(dashboards.id, id));

  return { ok: true };
});