/**
 * POST /api/charts — placeholder persistence
 *
 * Pushes into the in-memory `seedCharts` so Chart Explore → Save appears in
 * Chart List immediately (same discipline as seedDatabases mutation for uploads).
 * No DB — resets on restart. Contract is `src/types/chart.ts`.
 */
import { createError, defineHandler, readBody } from "nitro/h3";

import { seedCharts } from "../../../src/data/charts";
import { seedDatasets } from "../../../src/data/datasets";
import type { Chart, ChartVizType } from "../../../src/types/chart";

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
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export default defineHandler(async (event) => {
  const body = (await readBody(event)) as Partial<{
    name: string;
    vizType: ChartVizType;
    datasetId: number;
    description: string;
  }>;

  if (!body?.name?.trim()) throw createError({ statusCode: 400, message: "name is required" });
  if (!body.vizType || !ALLOWED_VIZ.includes(body.vizType))
    throw createError({ statusCode: 400, message: "vizType is required" });
  if (body.datasetId == null)
    throw createError({ statusCode: 400, message: "datasetId is required" });

  const ds = seedDatasets.find((d) => d.id === body.datasetId);
  if (!ds) throw createError({ statusCode: 404, message: "Dataset not found" });

  const id = Math.max(0, ...seedCharts.map((c) => c.id)) + 1;
  const slug = slugify(body.name) || `chart-${id}`;
  const now = new Date().toISOString();

  const chart: Chart = {
    id,
    name: body.name.trim().slice(0, 120),
    slug,
    vizType: body.vizType,
    dataset: ds.name,
    database: ds.databaseName,
    schema: ds.schema,
    table: ds.table ?? ds.name,
    modified: now,
    modifiedBy: { id: 1, name: "Akmal Hazriq" },
    createdBy: { id: 1, name: "Akmal Hazriq" },
    owners: [{ id: 1, name: "Akmal Hazriq" }],
    tags: [],
    favorite: false,
    description: body.description?.trim() || undefined,
  };

  seedCharts.unshift(chart);
  return { ok: true, chart };
});
