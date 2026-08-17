/**
 * GET /api/dashboards/:id — Drizzle/Postgres
 *
 * Single dashboard with its layout. Separate selects + TS join for
 * owners/tags/favorite, mirroring the list handler.
 */
import { createError, defineHandler, getRouterParam } from "nitro/h3";

import { db } from "../../../src/db";
import { dashboardOwners, dashboardTags, dashboards, favorites, tags, users } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const raw = getRouterParam(event, "id");
  const id = Number(raw);
  if (!raw || Number.isNaN(id)) throw createError({ statusCode: 400, message: "Invalid dashboard id" });

  const [rows, allUsers, ownerRows, tagRows, allTags, favRows] = await Promise.all([
    db.select().from(dashboards),
    db.select().from(users),
    db.select().from(dashboardOwners),
    db.select().from(dashboardTags),
    db.select().from(tags),
    db.select().from(favorites),
  ]);

  const row = rows.find((r) => r.id === id);
  if (!row) throw createError({ statusCode: 404, message: "Dashboard not found" });

  const userName = new Map(allUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
  const tagById = new Map(allTags.map((t) => [t.id, t.name]));

  const owners = ownerRows
    .filter((r) => r.dashboardId === id)
    .map((r) => ({ id: r.userId, name: userName.get(r.userId) ?? String(r.userId) }));

  const dashboardTagsList = tagRows
    .filter((r) => r.dashboardId === id)
    .map((r) => tagById.get(r.tagId)!)
    .filter(Boolean) as string[];

  const favorite = favRows.some((f) => f.entityType === "dashboard" && f.entityId === id);

  const data = {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    description: row.description ?? undefined,
    certified: row.certified ?? false,
    layout: (row.layout as unknown) ?? [],
    modifiedBy: { id: (row.modifiedById ?? row.createdById) ?? 0, name: (row.modifiedById ?? row.createdById) ? (userName.get((row.modifiedById ?? row.createdById)!) ?? "Sample") : "Sample" },
    modified: (row.modifiedAt ?? row.createdAt).toISOString(),
    createdBy: { id: (row.createdById ?? row.modifiedById) ?? 0, name: (row.createdById ?? row.modifiedById) ? (userName.get((row.createdById ?? row.modifiedById)!) ?? "Sample") : "Sample" },
    owners,
    tags: dashboardTagsList,
    favorite,
  };

  return { data };
});