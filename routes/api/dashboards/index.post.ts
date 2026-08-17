/**
 * POST /api/dashboards — Drizzle/Postgres
 *
 * Creates a new dashboard. Minimal body: { title?, status?, description?, layout? }
 * Inserts into dashboards + dashboard_owners (user 1). Returns created row.
 */
import { createError, defineHandler, readBody } from "nitro/h3";

import { db } from "../../../src/db";
import { dashboardOwners, dashboards } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
}

export default defineHandler(async (event) => {
  await requireAuth(event);
  const body = (await readBody(event)) as Partial<{ title: string; status: string; description: string; layout: unknown }>;
  const title = (body?.title?.trim() || "Untitled dashboard").slice(0, 120);
  const slugBase = slugify(title) || `dashboard-${Date.now()}`;
  const status = body?.status && ["published", "draft", "archived"].includes(body.status) ? body.status : "draft";

  // ensure slug unique: append timestamp if exists
  const existing = await db.select({ slug: dashboards.slug }).from(dashboards);
  const slugSet = new Set(existing.map((r) => r.slug));
  let slug = slugBase;
  if (slugSet.has(slug)) slug = `${slugBase}-${Date.now()}`;

  const [row] = await db
    .insert(dashboards)
    .values({
      title,
      slug,
      status,
      description: body?.description?.trim() || null,
      certified: false,
      layout: (body?.layout ?? []) as unknown as Record<string, unknown>,
      modifiedById: 1,
      createdById: 1,
    })
    .returning();

  if (!row) throw createError({ statusCode: 500, message: "Failed to create dashboard" });

  await db.insert(dashboardOwners).values({ dashboardId: row.id, userId: 1 }).onConflictDoNothing();

  return { ok: true, data: row };
});