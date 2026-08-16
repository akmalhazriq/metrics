/**
 * GET /api/datasets — placeholder.
 * Hand-authored `seedDatasets` from `src/data/datasets.ts`; each entry
 * points at a real `seedDatabases` id/schema/table (see file header).
 * Filtering/mirroring the dashboards API for now.
 */
import { defineHandler, getQuery } from "nitro/h3";

import { seedDatasets } from "../../../src/data/datasets";
import type { DatasetType } from "../../../src/types/dataset";

export default defineHandler((event) => {
  const q = getQuery(event) as Record<string, string | undefined>;
  const search = (q.q ?? "").toLowerCase().trim();
  const database = (q.database ?? "").trim();
  const schema = (q.schema ?? "").trim();
  const owner = (q.owner ?? "").toLowerCase().trim();
  const type = q.type as DatasetType | "all" | undefined;
  const sortBy = (q.sortBy as "name" | "modified" | "database" | undefined) ?? "modified";
  const sortDir = (q.sortDir as "asc" | "desc" | undefined) ?? "desc";
  const page = Math.max(1, Number(q.page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(q.pageSize ?? 10) || 10));

  let filtered = [...seedDatasets];

  if (search) filtered = filtered.filter((d) => d.name.toLowerCase().includes(search));
  if (database) filtered = filtered.filter((d) => d.databaseId === database);
  if (schema) filtered = filtered.filter((d) => d.schema === schema);
  if (owner)
    filtered = filtered.filter((d) => d.owners.some((o) => o.name.toLowerCase().includes(owner)));
  if (type && type !== "all") filtered = filtered.filter((d) => d.type === type);

  filtered.sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortBy === "name") return dir * a.name.localeCompare(b.name);
    if (sortBy === "database") return dir * a.databaseName.localeCompare(b.databaseName);
    return dir * a.modified.localeCompare(b.modified);
  });

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);
  return { data, total, page, pageSize };
});
