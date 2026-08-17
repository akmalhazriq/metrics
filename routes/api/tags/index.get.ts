import { defineHandler, getQuery } from "nitro/h3";
import { db } from "../../../src/db";
import { chartTags, dashboardTags, tags } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const q = ((getQuery(event).q as string) ?? "").toLowerCase().trim();
  const type = ((getQuery(event).type as string) ?? "").toLowerCase().trim();
  const sortBy = (getQuery(event).sortBy as string) ?? "name";
  const sortDir = (getQuery(event).sortDir as string) === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(getQuery(event).page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(getQuery(event).pageSize ?? 10) || 10));

  const [rows, ctRows, dtRows] = await Promise.all([db.select().from(tags), db.select().from(chartTags), db.select().from(dashboardTags)]);
  const chartCount = new Map<number, number>();
  for (const r of ctRows) chartCount.set(r.tagId, (chartCount.get(r.tagId) ?? 0) + 1);
  const dashCount = new Map<number, number>();
  for (const r of dtRows) dashCount.set(r.tagId, (dashCount.get(r.tagId) ?? 0) + 1);

  let data = rows.map((t) => ({
    id: t.id, name: t.name, type: t.type,
    chartCount: chartCount.get(t.id) ?? 0,
    dashboardCount: dashCount.get(t.id) ?? 0,
  }));
  if (q) data = data.filter((d) => d.name.toLowerCase().includes(q));
  if (type) data = data.filter((d) => (d.type ?? "").toLowerCase() === type);

  const allowed = new Set(["name", "type"]);
  const key = allowed.has(sortBy) ? sortBy : "name";
  data.sort((a, b) => {
    const av = String((a as Record<string, unknown>)[key] ?? "");
    const bv = String((b as Record<string, unknown>)[key] ?? "");
    const cmp = av.localeCompare(bv);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const total = data.length;
  return { data: data.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
});