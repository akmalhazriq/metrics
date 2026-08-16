/**
 * GET /api/charts
 *
 * Placeholder data layer — serves `seedCharts` from `src/data/charts.ts`.
 * Same shape as dashboards handler: query params drive server-side filtering.
 *   ?q=string               name substring (case-insensitive)
 *   ?vizType=Bar|Line|...|all
 *   ?dataset=string         substring against chart.dataset
 *   ?owner=string           substring against any owner.name
 *   ?tag=string             exact tag
 *   ?favorite=true|false
 *   ?sortBy=name|modified|vizType
 *   ?sortDir=asc|desc
 *   ?page & pageSize
 *
 * No persistence — mutations are client-side only for this phase.
 */
import { defineHandler, getQuery } from "nitro/h3";

import { seedCharts } from "../../../src/data/charts";
import type { Chart } from "../../../src/types/chart";

export default defineHandler((event) => {
  const query = getQuery(event) as Record<string, string | undefined>;

  const q = (query.q ?? "").toLowerCase().trim();
  const vizType = query.vizType as string | undefined;
  const dataset = (query.dataset ?? "").toLowerCase().trim();
  const owner = (query.owner ?? "").toLowerCase().trim();
  const tag = (query.tag ?? "").toLowerCase().trim();
  const favoriteParam = query.favorite;
  const sortBy = (query.sortBy as keyof Chart | undefined) ?? "modified";
  const sortDir = (query.sortDir as "asc" | "desc" | undefined) ?? "desc";
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize ?? 10) || 10));

  let filtered = [...seedCharts];

  if (q) {
    filtered = filtered.filter((c) => c.name.toLowerCase().includes(q));
  }
  if (vizType && vizType !== "all") {
    filtered = filtered.filter((c) => c.vizType === vizType);
  }
  if (dataset) {
    filtered = filtered.filter((c) => c.dataset.toLowerCase().includes(dataset));
  }
  if (owner) {
    filtered = filtered.filter((c) => c.owners.some((o) => o.name.toLowerCase().includes(owner)));
  }
  if (tag) {
    filtered = filtered.filter((c) => c.tags.some((t) => t.toLowerCase() === tag));
  }
  if (favoriteParam === "true" || favoriteParam === "false") {
    const want = favoriteParam === "true";
    filtered = filtered.filter((c) => c.favorite === want);
  }

  const allowedSort = new Set(["name", "modified", "vizType"]);
  const sortKey = allowedSort.has(sortBy as string) ? (sortBy as keyof Chart) : "modified";

  filtered.sort((a, b) => {
    const av = a[sortKey] as string;
    const bv = b[sortKey] as string;
    const cmp = String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);

  return { data, total, page, pageSize };
});
