import { defineHandler, getQuery } from "nitro/h3";
import { db } from "../../../src/db";
import { permissions, rolePermissions, roles, userRoles } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const q = ((getQuery(event).q as string) ?? "").toLowerCase().trim();
  const sortBy = (getQuery(event).sortBy as string) ?? "modified";
  const sortDir = (getQuery(event).sortDir as string) === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(getQuery(event).page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(getQuery(event).pageSize ?? 10) || 10));

  const [rows, rpRows, urRows, permRows] = await Promise.all([db.select().from(roles), db.select().from(rolePermissions), db.select().from(userRoles), db.select().from(permissions)]);

  const permNameById = new Map(permRows.map((p) => [p.id, p.name]));
  const permNamesByRole = new Map<number, string[]>();
  for (const r of rpRows) {
    const arr = permNamesByRole.get(r.roleId) ?? [];
    const n = permNameById.get(r.permissionId);
    if (n) arr.push(n);
    permNamesByRole.set(r.roleId, arr);
  }
  const userCount = new Map<number, number>();
  for (const r of urRows) userCount.set(r.roleId, (userCount.get(r.roleId) ?? 0) + 1);

  let data = rows.map((r) => ({
    id: r.id, name: r.name, description: r.description,
    permCount: permNamesByRole.get(r.id)?.length ?? 0,
    permNames: permNamesByRole.get(r.id) ?? [],
    userCount: userCount.get(r.id) ?? 0,
    createdAt: r.createdAt.toISOString(), modifiedAt: r.modifiedAt.toISOString(),
  }));

  if (q) data = data.filter((d) => d.name.toLowerCase().includes(q));
  const allowed = new Set(["name", "modified"]);
  const key = allowed.has(sortBy) ? sortBy : "modified";
  data.sort((a, b) => {
    const av = key === "modified" ? a.modifiedAt : (a as unknown as Record<string, string>)[key] ?? "";
    const bv = key === "modified" ? b.modifiedAt : (b as unknown as Record<string, string>)[key] ?? "";
    const cmp = av.localeCompare(bv);
    return sortDir === "asc" ? cmp : -cmp;
  });
  const total = data.length;
  return { data: data.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
});