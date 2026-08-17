/**
 * POST /api/charts — Drizzle/Postgres
 *
 * Inserts into charts + chart_owners. Validates datasetId via DB lookup.
 * Keeps same ALLOWED_VIZ and slug handling as before.
 */
import { createError, defineHandler, readBody } from "nitro/h3";
import { eq } from "drizzle-orm";

import { db } from "../../../src/db";
import { chartOwners, charts, datasets } from "../../../src/db/schema";
import type { ChartVizType } from "../../../src/types/chart";
import { requireAuth } from "../../../src/lib/requireAuth";

const ALLOWED_VIZ: ChartVizType[] = [
  "Bar",
  "Line",
  "Pie",
  "Donut",
  "Scatter",
  "Table",
  "Big Number",
  "Heatmap",
  "Area",
  "Box Plot",
  "Violin",
  "Treemap",
  "Sunburst",
  "Sankey",
  "Gauge",
];

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
}

export default defineHandler(async (event) => {
  await requireAuth(event);
  const body = (await readBody(event)) as Partial<{
    name: string;
    vizType: ChartVizType;
    datasetId: number;
    description: string;
  }>;

  if (!body?.name?.trim()) throw createError({ statusCode: 400, message: "name is required" });
  if (!body.vizType || !ALLOWED_VIZ.includes(body.vizType)) throw createError({ statusCode: 400, message: "vizType is required" });
  if (body.datasetId == null) throw createError({ statusCode: 400, message: "datasetId is required" });

  const dsRows = await db.select().from(datasets).where(eq(datasets.id, body.datasetId));
  const ds = dsRows[0];
  if (!ds) throw createError({ statusCode: 404, message: "Dataset not found" });

  const slugBase = slugify(body.name) || `chart-${Date.now()}`;
  const existingSlugs = await db.select({ slug: charts.slug }).from(charts);
  const slugSet = new Set(existingSlugs.map((r) => r.slug));
  let slug = slugBase;
  if (slugSet.has(slug)) slug = `${slugBase}-${Date.now()}`;

  const [row] = await db
    .insert(charts)
    .values({
      name: body.name.trim().slice(0, 120),
      slug,
      vizType: body.vizType,
      datasetId: ds.id,
      description: body.description?.trim() || null,
      certified: false,
      modifiedById: 1,
      createdById: 1,
    })
    .returning();

  if (!row) throw createError({ statusCode: 500, message: "Failed to create chart" });

  await db.insert(chartOwners).values({ chartId: row.id, userId: 1 }).onConflictDoNothing();

  // Return shape compatible with previous placeholder (with derived fields for client)
  const chart = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    vizType: row.vizType,
    dataset: ds.name,
    database: ds.databaseId,
    schema: ds.schema,
    table: ds.tableName ?? ds.name,
    modified: (row.modifiedAt ?? row.createdAt).toISOString(),
    modifiedBy: { id: 1, name: "Admin User" },
    createdBy: { id: 1, name: "Admin User" },
    owners: [{ id: 1, name: "Admin User" }],
    tags: [],
    favorite: false,
    description: row.description ?? undefined,
  };

  return { ok: true, chart };
});