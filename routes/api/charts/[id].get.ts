/**
 * GET /api/charts/:id — single chart (Drizzle/Postgres)
 *
 * Returns enriched Chart shape matching index.get.ts (dataset/database/schema/table
 * via joins). Used by Explore ?chartId hydration.
 */
import { createError, defineHandler, getRouterParam } from "nitro/h3";

import { db } from "../../../src/db";
import { chartOwners, chartTags, charts, databases, datasets, favorites, tags, users } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id)) throw createError({ statusCode: 400, message: "invalid id" });

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

  const row = chartRows.find((r) => r.id === id);
  if (!row) throw createError({ statusCode: 404, message: "Chart not found" });

  const userName = new Map(allUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
  const tagById = new Map(allTags.map((t) => [t.id, t.name]));
  const datasetById = new Map(datasetRows.map((d) => [d.id, d]));
  const dbById = new Map(dbRows.map((d) => [d.id, d]));

  const owners = ownerRows.filter((r) => r.chartId === id).map((r) => ({ id: r.userId, name: userName.get(r.userId) ?? String(r.userId) }));
  const chartTagsList = tagRows.filter((r) => r.chartId === id).map((r) => tagById.get(r.tagId)!).filter(Boolean);
  const favSet = new Set<number>();
  for (const f of favRows) if (f.entityType === "chart") favSet.add(f.entityId);

  const ds = row.datasetId != null ? datasetById.get(row.datasetId) : null;
  const dbRec = ds ? dbById.get(ds.databaseId) : null;

  const chart = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    vizType: row.vizType,
    dataset: ds?.name ?? "",
    datasetId: row.datasetId ?? null,
    database: dbRec?.name ?? ds?.databaseId ?? "",
    schema: ds?.schema ?? "",
    table: ds?.tableName ?? ds?.name ?? "",
    modified: (row.modifiedAt ?? row.createdAt).toISOString(),
    modifiedBy: { id: (row.modifiedById ?? row.createdById) ?? 0, name: (row.modifiedById ?? row.createdById) ? (userName.get((row.modifiedById ?? row.createdById)!) ?? "Sample") : "Sample" },
    createdBy: { id: (row.createdById ?? row.modifiedById) ?? 0, name: (row.createdById ?? row.modifiedById) ? (userName.get((row.createdById ?? row.modifiedById)!) ?? "Sample") : "Sample" },
    owners,
    tags: chartTagsList,
    favorite: favSet.has(row.id),
    certified: row.certified ?? false,
    description: row.description ?? undefined,
  };

  return { data: chart };
});