import { defineHandler, getQuery } from "nitro/h3";
import { db } from "../../../src/db";
import { permissions, rolePermissions, roles } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const q = ((getQuery(event).q as string) ?? "").toLowerCase().trim();
  const view = ((getQuery(event).view as string) ?? "").toLowerCase().trim();
  const action = ((getQuery(event).action as string) ?? "").toLowerCase().trim();
  const sortBy = (getQuery(event).sortBy as string) ?? "name";
  const sortDir = (getQuery(event).sortDir as string) === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(getQuery(event).page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(getQuery(event).pageSize ?? 10) || 10));

  const [rows, rpRows, allRoles] = await Promise.all([db.select().from(permissions), db.select().from(rolePermissions), db.select().from(roles)]);
  const rolesByPerm = new Map<number, string[]>();
  const roleName = new Map(allRoles.map((r) => [r.id, r.name]));
  for (const r of rpRows) {
    const arr = rolesByPerm.get(r.permissionId) ?? [];
    const n = roleName.get(r.roleId);
    if (n) arr.push(n);
    rolesByPerm.set(r.permissionId, arr);
  }

  let data = rows.map((p) => ({
    id: p.id, name: p.name, view: p.view, action: p.action, description: p.description,
    roles: rolesByPerm.get(p.id) ?? [],
  }));

  if (q) data = data.filter((d) => [d.name, d.view, d.action].some((s) => s.toLowerCase().includes(q)));
  if (view) data = data.filter((d) => d.view.toLowerCase() === view);
  if (action) data = data.filter((d) => d.action.toLowerCase() === action);

  const allowed = new Set(["name", "view", "action"]);
  const key = allowed.has(sortBy) ? (sortBy as keyof typeof data[0]) : "name";
  data.sort((a, b) => {
    const av = String((a as Record<string, unknown>)[key] ?? "");
    const bv = String((b as Record<string, unknown>)[key] ?? "");
    const cmp = av.localeCompare(bv);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const total = data.length;
  return { data: data.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
});