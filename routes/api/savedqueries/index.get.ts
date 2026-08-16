/**
 * GET /api/savedqueries — placeholder.
 * Source of truth: `src/data/sqllab.ts` `mockSavedQueries` (same array
 * SQL Lab's tabs read from). No forked seed — see header in that file.
 */
import { defineHandler, getQuery } from "nitro/h3";

import { mockSavedQueries } from "../../../src/data/sqllab";

export default defineHandler((event) => {
  const q = getQuery(event) as Record<string, string | undefined>;
  const search = (q.q ?? "").toLowerCase().trim();
  const database = (q.database ?? "").trim();
  const schema = (q.schema ?? "").trim();
  const sortBy = (q.sortBy as "name" | "modified" | "database" | undefined) ?? "modified";
  const sortDir = (q.sortDir as "asc" | "desc" | undefined) ?? "desc";
  const page = Math.max(1, Number(q.page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(q.pageSize ?? 10) || 10));

  let filtered = [...mockSavedQueries];

  if (search) {
    filtered = filtered.filter(
      (s) =>
        s.name.toLowerCase().includes(search) ||
        s.database.toLowerCase().includes(search) ||
        s.schema.toLowerCase().includes(search) ||
        s.savedBy.toLowerCase().includes(search) ||
        s.sql.toLowerCase().includes(search) ||
        (s.description ?? "").toLowerCase().includes(search),
    );
  }
  if (database) filtered = filtered.filter((s) => s.database === database);
  if (schema) filtered = filtered.filter((s) => s.schema === schema);

  filtered.sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortBy === "name") return dir * a.name.localeCompare(b.name);
    if (sortBy === "database") return dir * a.database.localeCompare(b.database);
    return dir * a.modified.localeCompare(b.modified);
  });

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);
  return { data, total, page, pageSize };
});
