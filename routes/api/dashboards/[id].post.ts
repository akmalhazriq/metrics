/**
 * POST /api/dashboards/:id — Drizzle/Postgres favorite toggle
 *
 * Body: { favorite: boolean } or empty to toggle. Upserts/deletes
 * entry in favorites (user 1, entityType dashboard). Returns { favorite }.
 */
import { createError, defineHandler, getRouterParam, readBody } from "nitro/h3";
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

  const body = (await readBody(event)) as { favorite?: boolean } | null;
  let want: boolean | null = body?.favorite ?? null;

  const currentRows = await db
    .select()
    .from(favorites)
    .where(and(eq(favorites.entityType, "dashboard"), eq(favorites.entityId, id), eq(favorites.userId, 1)));
  const isFav = currentRows.length > 0;
  if (want == null) want = !isFav;

  if (want && !isFav) {
    await db.insert(favorites).values({ userId: 1, entityType: "dashboard", entityId: id }).onConflictDoNothing();
  } else if (!want && isFav) {
    await db
      .delete(favorites)
      .where(and(eq(favorites.entityType, "dashboard"), eq(favorites.entityId, id), eq(favorites.userId, 1)));
  }

  return { ok: true, favorite: want };
});