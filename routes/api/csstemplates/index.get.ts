import { defineHandler, getQuery } from "nitro/h3";
import { db } from "../../../src/db";
import { cssTemplates } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const q = ((getQuery(event).q as string) ?? "").toLowerCase().trim();
  const sortBy = (getQuery(event).sortBy as string) ?? "modified";
  const sortDir = (getQuery(event).sortDir as string) === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(getQuery(event).page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(getQuery(event).pageSize ?? 10) || 10));

  const rows = await db.select().from(cssTemplates);
  let data = rows.map((r) => ({
    id: r.id, name: r.name, description: r.description, cssCode: r.cssCode,
    createdAt: r.createdAt.toISOString(), modifiedAt: r.modifiedAt.toISOString(),
  }));
  if (q) data = data.filter((d) => d.name.toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q));
  const allowed = new Set(["name", "modified"]);
  const key = allowed.has(sortBy) ? sortBy : "modified";
  data.sort((a, b) => {
    const av = key === "modified" ? a.modifiedAt : a.name;
    const bv = key === "modified" ? b.modifiedAt : b.name;
    const cmp = String(av ?? "").localeCompare(String(bv ?? ""));
    return sortDir === "asc" ? cmp : -cmp;
  });
  const total = data.length;
  return { data: data.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
});