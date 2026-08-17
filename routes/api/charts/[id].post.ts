/**
 * POST /api/charts/:id — Drizzle/Postgres favorite toggle
 *
 * Body: { favorite: boolean } or empty to toggle.
 */
import { createError, defineHandler, getRouterParam, readBody } from "nitro/h3";
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

  const body = (await readBody(event)) as { favorite?: boolean } | null;
  let want: boolean | null = body?.favorite ?? null;

  const currentRows = await db
    .select()
    .from(favorites)
    .where(and(eq(favorites.entityType, "chart"), eq(favorites.entityId, id), eq(favorites.userId, 1)));
  const isFav = currentRows.length > 0;
  if (want == null) want = !isFav;

  if (want && !isFav) {
    await db.insert(favorites).values({ userId: 1, entityType: "chart", entityId: id }).onConflictDoNothing();
  } else if (!want && isFav) {
    await db
      .delete(favorites)
      .where(and(eq(favorites.entityType, "chart"), eq(favorites.entityId, id), eq(favorites.userId, 1)));
  }

  return { ok: true, favorite: want };
});