/**
 * GET /api/databases — placeholder.
 * Single source: `seedDatabases` from `src/data/databases.ts`. Same array that
 * `routes/api/sqllab/databases` and SQL Lab's client selector read from (see
 * `src/data/databases.ts` decision note). Filtering/sorting/pagination here
 * mirrors `routes/api/dashboards`.
 */
import { defineHandler, getQuery } from "nitro/h3";

import { seedDatabases } from "../../../src/data/databases";
import type { DatabaseBackend } from "../../../src/types/database";

export default defineHandler((event) => {
  const query = getQuery(event) as Record<string, string | undefined>;
  const q = (query.q ?? "").toLowerCase().trim();
  const backend = query.backend as DatabaseBackend | "all" | undefined;
  const sortBy = (query.sortBy as "name" | "backend" | "modified" | undefined) ?? "modified";
  const sortDir = (query.sortDir as "asc" | "desc" | undefined) ?? "desc";
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize ?? 10) || 10));

  let filtered = [...seedDatabases];

  if (q) filtered = filtered.filter((d) => d.name.toLowerCase().includes(q));
  if (backend && backend !== "all") filtered = filtered.filter((d) => d.backend === backend);

  filtered.sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortBy === "name") return dir * a.name.localeCompare(b.name);
    if (sortBy === "backend") return dir * a.backend.localeCompare(b.backend);
    return dir * a.modified.localeCompare(b.modified);
  });

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);
  return { data, total, page, pageSize };
});
