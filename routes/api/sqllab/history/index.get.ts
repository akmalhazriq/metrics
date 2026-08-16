/**
 * GET /api/sqllab/history — placeholder.
 * Source of truth: `src/data/sqllab.ts` `mockHistory` (same array
 * SQL Lab's History tab reads from). No forked seed — same discipline
 * as `src/data/databases.ts` being canonical for the DB tree.
 */
import { defineHandler, getQuery } from "nitro/h3";

import { mockHistory } from "../../../../src/data/sqllab";

export default defineHandler((event) => {
  const q = getQuery(event) as Record<string, string | undefined>;
  const search = (q.q ?? "").toLowerCase().trim();
  const user = (q.user ?? "").toLowerCase().trim();
  const database = (q.database ?? "").trim();
  const status = q.status as "all" | "success" | "error" | "running" | undefined;
  const from = q.from ? new Date(q.from).getTime() : null;
  const to = q.to ? new Date(q.to).getTime() : null;
  const sortBy = (q.sortBy as "time" | "database" | "rows" | undefined) ?? "time";
  const sortDir = (q.sortDir as "asc" | "desc" | undefined) ?? "desc";
  const page = Math.max(1, Number(q.page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(q.pageSize ?? 10) || 10));

  let filtered = [...mockHistory];

  if (search) {
    filtered = filtered.filter(
      (h) =>
        h.sql.toLowerCase().includes(search) ||
        h.user.toLowerCase().includes(search) ||
        h.database.toLowerCase().includes(search) ||
        h.schema.toLowerCase().includes(search) ||
        (h.error ?? "").toLowerCase().includes(search),
    );
  }
  if (user) filtered = filtered.filter((h) => h.user.toLowerCase().includes(user));
  if (database) filtered = filtered.filter((h) => h.database === database);
  if (status && status !== "all") filtered = filtered.filter((h) => h.status === status);
  if (from != null && !Number.isNaN(from))
    filtered = filtered.filter((h) => new Date(h.time).getTime() >= from);
  if (to != null && !Number.isNaN(to))
    filtered = filtered.filter((h) => new Date(h.time).getTime() <= to);

  filtered.sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortBy === "database") return dir * a.database.localeCompare(b.database);
    if (sortBy === "rows") return dir * (a.rows - b.rows);
    return dir * (new Date(a.time).getTime() - new Date(b.time).getTime());
  });

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);
  return { data, total, page, pageSize };
});
