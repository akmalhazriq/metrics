/**
 * GET /api/charts — Drizzle/Postgres
 *
 * Separate selects + TS join: charts → datasets/databases for
 * dataset/database/schema/table, + chart_owners/users, chart_tags/tags,
 * favorites. Preserves q/vizType/dataset/owner/tag/favorite/sort/pagination.
 */
import { defineHandler, getQuery } from "nitro/h3";

import { db } from "../../../src/db";
import { chartOwners, chartTags, charts, databases, datasets, favorites, tags, users } from "../../../src/db/schema";
import type { Chart } from "../../../src/types/chart";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const query = getQuery(event) as Record<string, string | undefined>;

  const q = (query.q ?? "").toLowerCase().trim();
  const vizType = query.vizType as string | undefined;
  const datasetFilter = (query.dataset ?? "").toLowerCase().trim();
  const owner = (query.owner ?? "").toLowerCase().trim();
  const tag = (query.tag ?? "").toLowerCase().trim();
  const favoriteParam = query.favorite;
  const sortBy = (query.sortBy as keyof Chart | undefined) ?? "modified";
  const sortDir = (query.sortDir as "asc" | "desc" | undefined) ?? "desc";
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize ?? 10) || 10));

  const [chartRows, allUsers, ownerRows, tagRows, allTags, favRows, datasetRows, dbRows] = await Promise.all([
    db.select().from(charts),
    db.select().from(users),
    db.select().from(chartOwners),
    db.select().from(chartTags),
    db.select().from(tags),
    db.select().from(favorites),
    db.select().from(datasets),
    db.select().from(databases),
  ]);

  const userName = new Map(allUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
  const tagById = new Map(allTags.map((t) => [t.id, t.name]));
  const datasetById = new Map(datasetRows.map((d) => [d.id, d]));
  const dbById = new Map(dbRows.map((d) => [d.id, d]));

  const ownersByChart = new Map<number, { id: number; name: string }[]>();
  for (const r of ownerRows) {
    const arr = ownersByChart.get(r.chartId) ?? [];
    arr.push({ id: r.userId, name: userName.get(r.userId) ?? String(r.userId) });
    ownersByChart.set(r.chartId, arr);
  }

  const tagsByChart = new Map<number, string[]>();
  for (const r of tagRows) {
    const name = tagById.get(r.tagId);
    if (!name) continue;
    const arr = tagsByChart.get(r.chartId) ?? [];
    arr.push(name);
    tagsByChart.set(r.chartId, arr);
  }

  const favSet = new Set<number>();
  for (const f of favRows) if (f.entityType === "chart") favSet.add(f.entityId);

  let data: Chart[] = chartRows.map((r) => {
    const ds = r.datasetId != null ? datasetById.get(r.datasetId) : null;
    const dbRec = ds ? dbById.get(ds.databaseId) : null;
    const mId = r.modifiedById ?? r.createdById;
    const cId = r.createdById ?? r.modifiedById;
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      vizType: r.vizType as Chart["vizType"],
      dataset: ds?.name ?? "",
      database: dbRec?.name ?? ds?.databaseId ?? "",
      schema: ds?.schema ?? "",
      table: ds?.tableName ?? ds?.name ?? "",
      modified: (r.modifiedAt ?? r.createdAt).toISOString(),
      modifiedBy: { id: mId ?? 0, name: mId ? (userName.get(mId) ?? "Sample") : "Sample" },
      createdBy: { id: cId ?? 0, name: cId ? (userName.get(cId) ?? "Sample") : "Sample" },
      owners: ownersByChart.get(r.id) ?? [],
      tags: tagsByChart.get(r.id) ?? [],
      favorite: favSet.has(r.id),
      certified: r.certified ?? false,
      description: r.description ?? undefined,
    };
  });

  if (q) data = data.filter((c) => c.name.toLowerCase().includes(q));
  if (vizType && vizType !== "all") data = data.filter((c) => c.vizType === vizType);
  if (datasetFilter) data = data.filter((c) => c.dataset.toLowerCase().includes(datasetFilter));
  if (owner) data = data.filter((c) => c.owners.some((o) => o.name.toLowerCase().includes(owner)));
  if (tag) data = data.filter((c) => c.tags.some((t) => t.toLowerCase() === tag));
  if (favoriteParam === "true" || favoriteParam === "false") {
    const want = favoriteParam === "true";
    data = data.filter((c) => c.favorite === want);
  }

  const allowedSort = new Set(["name", "modified", "vizType"]);
  const sortKey = allowedSort.has(sortBy as string) ? (sortBy as keyof Chart) : "modified";
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