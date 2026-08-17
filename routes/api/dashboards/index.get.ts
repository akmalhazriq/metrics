/**
 * GET /api/dashboards — Drizzle/Postgres
 *
 * Replaces in-memory `seedDashboards`. Joins via separate selects + TS join
 * (no db.query relations): dashboards → dashboard_owners/users,
 * dashboard_tags/tags, favorites. Filtering/sorting/pagination after stitch
 * to preserve exact previous query semantics (q/status/owner/tag/favorite).
 */
import { defineHandler, getQuery } from "nitro/h3";

import { db } from "../../../src/db";
import { dashboardOwners, dashboardTags, dashboards, favorites, tags, users } from "../../../src/db/schema";
import type { Dashboard } from "../../../src/types/dashboard";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const query = getQuery(event) as Record<string, string | undefined>;

  const q = (query.q ?? "").toLowerCase().trim();
  const status = query.status as string | undefined;
  const owner = (query.owner ?? "").toLowerCase().trim();
  const tag = (query.tag ?? "").toLowerCase().trim();
  const favoriteParam = query.favorite;
  const sortBy = (query.sortBy as keyof Dashboard | undefined) ?? "modified";
  const sortDir = (query.sortDir as "asc" | "desc" | undefined) ?? "desc";
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize ?? 10) || 10));

  const [rows, allUsers, ownerRows, tagRows, allTags, favRows] = await Promise.all([
    db.select().from(dashboards),
    db.select().from(users),
    db.select().from(dashboardOwners),
    db.select().from(dashboardTags),
    db.select().from(tags),
    db.select().from(favorites),
  ]);

  const userName = new Map(allUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
  const tagById = new Map(allTags.map((t) => [t.id, t.name]));

  const ownersByDashboard = new Map<number, { id: number; name: string }[]>();
  for (const r of ownerRows) {
    const arr = ownersByDashboard.get(r.dashboardId) ?? [];
    arr.push({ id: r.userId, name: userName.get(r.userId) ?? String(r.userId) });
    ownersByDashboard.set(r.dashboardId, arr);
  }

  const tagsByDashboard = new Map<number, string[]>();
  for (const r of tagRows) {
    const name = tagById.get(r.tagId);
    if (!name) continue;
    const arr = tagsByDashboard.get(r.dashboardId) ?? [];
    arr.push(name);
    tagsByDashboard.set(r.dashboardId, arr);
  }

  const favSet = new Set<number>();
  for (const f of favRows) if (f.entityType === "dashboard") favSet.add(f.entityId);

  let data: Dashboard[] = rows.map((r) => {
    const mId = r.modifiedById ?? r.createdById;
    const cId = r.createdById ?? r.modifiedById;
    return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    status: r.status as Dashboard["status"],
    modifiedBy: { id: mId ?? 0, name: mId ? (userName.get(mId) ?? "Sample") : "Sample" },
    modified: (r.modifiedAt ?? r.createdAt).toISOString(),
    createdBy: { id: cId ?? 0, name: cId ? (userName.get(cId) ?? "Sample") : "Sample" },
    owners: ownersByDashboard.get(r.id) ?? [],
    tags: tagsByDashboard.get(r.id) ?? [],
    favorite: favSet.has(r.id),
    certified: r.certified ?? false,
    description: r.description ?? undefined,
    layout: (r.layout as Dashboard["layout"]) ?? [],
  };});

  if (q) data = data.filter((d) => d.title.toLowerCase().includes(q));
  if (status && status !== "all") data = data.filter((d) => d.status === status);
  if (owner) data = data.filter((d) => d.owners.some((o) => o.name.toLowerCase().includes(owner)));
  if (tag) data = data.filter((d) => d.tags.some((t) => t.toLowerCase() === tag));
  if (favoriteParam === "true" || favoriteParam === "false") {
    const want = favoriteParam === "true";
    data = data.filter((d) => d.favorite === want);
  }

  const allowedSort = new Set(["title", "modified", "status"]);
  const sortKey = allowedSort.has(sortBy as string) ? (sortBy as keyof Dashboard) : "modified";
  data.sort((a, b) => {
    const av = a[sortKey] as string;
    const bv = b[sortKey] as string;
    const cmp = String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const total = data.length;
  const start = (page - 1) * pageSize;
  const sliced = data.slice(start, start + pageSize);

  return { data: sliced, total, page, pageSize };
});