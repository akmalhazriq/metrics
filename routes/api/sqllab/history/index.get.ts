/**
 * GET /api/sqllab/history — Drizzle/Postgres
 *
 * Replace mockHistory with query_history + users, preserving
 * search/user/database/status/from/to/sort/pagination.
 */
import { defineHandler, getQuery } from "nitro/h3";

import { db } from "../../../../src/db";
import { queryHistory, users } from "../../../../src/db/schema";
import type { QueryHistoryEntry } from "../../../../src/types/sqllab";
import { requireAuth } from "../../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
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

  const [rows, allUsers] = await Promise.all([db.select().from(queryHistory), db.select().from(users)]);
  const userName = new Map(allUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));

  let data: QueryHistoryEntry[] = rows.map((r) => ({
    id: r.id,
    time: r.executedAt.toISOString(),
    user: r.userId ? (userName.get(r.userId) ?? String(r.userId)) : "",
    database: r.databaseId ?? "",
    schema: r.schema ?? "",
    rows: r.rows ?? 0,
    status: r.status as QueryHistoryEntry["status"],
    sql: r.sql,
    durationMs: r.durationMs ?? 0,
    error: r.errorMessage ?? undefined,
  }));

  if (search) {
    data = data.filter(
      (h) =>
        h.sql.toLowerCase().includes(search) ||
        h.user.toLowerCase().includes(search) ||
        h.database.toLowerCase().includes(search) ||
        h.schema.toLowerCase().includes(search) ||
        (h.error ?? "").toLowerCase().includes(search),
    );
  }
  if (user) data = data.filter((h) => h.user.toLowerCase().includes(user));
  if (database) data = data.filter((h) => h.database === database);
  if (status && status !== "all") data = data.filter((h) => h.status === status);
  if (from != null && !Number.isNaN(from)) data = data.filter((h) => new Date(h.time).getTime() >= from);
  if (to != null && !Number.isNaN(to)) data = data.filter((h) => new Date(h.time).getTime() <= to);

  data.sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortBy === "database") return dir * a.database.localeCompare(b.database);
    if (sortBy === "rows") return dir * (a.rows - b.rows);
    return dir * (new Date(a.time).getTime() - new Date(b.time).getTime());
  });

  const total = data.length;
  const start = (page - 1) * pageSize;
  const sliced = data.slice(start, start + pageSize);
  return { data: sliced, total, page, pageSize };
});