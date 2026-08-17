/**
 * GET /api/savedqueries — Drizzle/Postgres
 *
 * Replace mockSavedQueries with saved_queries + users join via TS.
 * Keeps search/database/schema/sort/pagination semantics.
 */
import { defineHandler, getQuery } from "nitro/h3";

import { db } from "../../../src/db";
import { savedQueries, users } from "../../../src/db/schema";
import type { SavedQuery } from "../../../src/types/sqllab";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const q = getQuery(event) as Record<string, string | undefined>;
  const search = (q.q ?? "").toLowerCase().trim();
  const database = (q.database ?? "").trim();
  const schema = (q.schema ?? "").trim();
  const sortBy = (q.sortBy as "name" | "modified" | "database" | undefined) ?? "modified";
  const sortDir = (q.sortDir as "asc" | "desc" | undefined) ?? "desc";
  const page = Math.max(1, Number(q.page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(q.pageSize ?? 10) || 10));

  const [rows, allUsers] = await Promise.all([db.select().from(savedQueries), db.select().from(users)]);
  const userName = new Map(allUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));

  let data: SavedQuery[] = rows.map((r) => ({
    id: r.id,
    name: r.label,
    database: r.databaseId ?? "",
    schema: r.schema ?? "",
    sql: r.sql,
    savedBy: r.createdById ? (userName.get(r.createdById) ?? String(r.createdById)) : "",
    modified: (r.modifiedAt ?? r.createdAt).toISOString(),
    description: r.description ?? undefined,
  }));

  if (search) {
    data = data.filter(
      (s) =>
        s.name.toLowerCase().includes(search) ||
        s.database.toLowerCase().includes(search) ||
        s.schema.toLowerCase().includes(search) ||
        s.savedBy.toLowerCase().includes(search) ||
        s.sql.toLowerCase().includes(search) ||
        (s.description ?? "").toLowerCase().includes(search),
    );
  }
  if (database) data = data.filter((s) => s.database === database);
  if (schema) data = data.filter((s) => s.schema === schema);

  data.sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortBy === "name") return dir * a.name.localeCompare(b.name);
    if (sortBy === "database") return dir * a.database.localeCompare(b.database);
    return dir * a.modified.localeCompare(b.modified);
  });

  const total = data.length;
  const start = (page - 1) * pageSize;
  const sliced = data.slice(start, start + pageSize);
  return { data: sliced, total, page, pageSize };
});