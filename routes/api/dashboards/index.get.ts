/**
 * GET /api/dashboards
 *
 * Placeholder data layer — serves `seedDashboards` from `src/data/dashboards.ts`
 * with server-side filtering / sorting / pagination via query params:
 *   ?q=string             title substring (case-insensitive)
 *   ?status=published|draft|archived|all
 *   ?owner=string         substring match against any owner.name
 *   ?tag=string           exact tag match
 *   ?favorite=true|false  boolean filter
 *   ?sortBy=title|modified|status
 *   ?sortDir=asc|desc
 *   ?page=number          1-indexed
 *   ?pageSize=number
 *
 * No persistence — mutations (create / favorite / delete) are client-side only
 * for this phase. Swap this handler for a DB query when a storage decision is made.
 */
import { defineHandler, getQuery } from "nitro/h3";

import { seedDashboards } from "../../../src/data/dashboards";
import type { Dashboard } from "../../../src/types/dashboard";

export default defineHandler((event) => {
  const query = getQuery(event) as Record<string, string | undefined>;

  const q = (query.q ?? "").toLowerCase().trim();
  const status = query.status as string | undefined;
  const owner = (query.owner ?? "").toLowerCase().trim();
  const tag = (query.tag ?? "").toLowerCase().trim();
  const favoriteParam = query.favorite;
  const sortBy = (query.sortBy as keyof Dashboard | undefined) ?? "modified";
  const sortDir = (query.sortDir as "asc" | "desc" | undefined) ?? "desc";
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize ?? 10) || 10));

  let filtered = [...seedDashboards];

  if (q) {
    filtered = filtered.filter((d) => d.title.toLowerCase().includes(q));
  }
  if (status && status !== "all") {
    filtered = filtered.filter((d) => d.status === status);
  }
  if (owner) {
    filtered = filtered.filter((d) => d.owners.some((o) => o.name.toLowerCase().includes(owner)));
  }
  if (tag) {
    filtered = filtered.filter((d) => d.tags.some((t) => t.toLowerCase() === tag));
  }
  if (favoriteParam === "true" || favoriteParam === "false") {
    const want = favoriteParam === "true";
    filtered = filtered.filter((d) => d.favorite === want);
  }

  const sortKey = (["title", "modified", "status"] as const).includes(
    sortBy as typeof sortBy & string extends string ? string : never,
  )
    ? sortBy
    : "modified";

  filtered.sort((a, b) => {
    const av = a[sortKey as keyof Dashboard];
    const bv = b[sortKey as keyof Dashboard];
    const cmp =
      typeof av === "string" && typeof bv === "string"
        ? av.localeCompare(bv)
        : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);

  return { data, total, page, pageSize };
});
