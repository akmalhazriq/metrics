import { defineHandler, getQuery } from "nitro/h3";
import { db } from "../../../src/db";
import { rlsFilterRoles, rlsFilterTables, roles, rowLevelSecurityFilters } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const q = ((getQuery(event).q as string) ?? "").toLowerCase().trim();
  const filterType = ((getQuery(event).filterType as string) ?? "").toLowerCase().trim();
  const role = ((getQuery(event).role as string) ?? "").toLowerCase().trim();
  const sortBy = (getQuery(event).sortBy as string) ?? "modified";
  const sortDir = (getQuery(event).sortDir as string) === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(getQuery(event).page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(getQuery(event).pageSize ?? 10) || 10));

  const [rows, rRoles, rTables, allRoles] = await Promise.all([
    db.select().from(rowLevelSecurityFilters),
    db.select().from(rlsFilterRoles),
    db.select().from(rlsFilterTables),
    db.select().from(roles),
  ]);
  const roleName = new Map(allRoles.map((r) => [r.id, r.name]));
  const rolesByFilter = new Map<number, string[]>();
  for (const r of rRoles) {
    const arr = rolesByFilter.get(r.filterId) ?? [];
    const n = roleName.get(r.roleId);
    if (n) arr.push(n);
    rolesByFilter.set(r.filterId, arr);
  }
  const tablesByFilter = new Map<number, { table: string; schema: string; databaseId: string }[]>();
  for (const r of rTables) {
    const arr = tablesByFilter.get(r.filterId) ?? [];
    arr.push({ table: r.tableName, schema: r.schemaName, databaseId: r.databaseId });
    tablesByFilter.set(r.filterId, arr);
  }

  let data = rows.map((f) => ({
    id: f.id, name: f.name, filterType: f.filterType, clause: f.clause, groupKey: f.groupKey, description: f.description,
    roles: rolesByFilter.get(f.id) ?? [],
    tables: tablesByFilter.get(f.id) ?? [],
    createdAt: f.createdAt.toISOString(), modifiedAt: f.modifiedAt.toISOString(),
  }));

  if (q) data = data.filter((d) => d.name.toLowerCase().includes(q) || d.clause.toLowerCase().includes(q));
  if (filterType) data = data.filter((d) => d.filterType.toLowerCase() === filterType);
  if (role) data = data.filter((d) => d.roles.some((r) => r.toLowerCase().includes(role)));
  const allowed = new Set(["name", "modified"]);
  const key = allowed.has(sortBy) ? sortBy : "modified";
  data.sort((a, b) => {
    const av = key === "modified" ? a.modifiedAt : String((a as unknown as Record<string, string>)[key] ?? "");
    const bv = key === "modified" ? b.modifiedAt : String((b as unknown as Record<string, string>)[key] ?? "");
    const cmp = av.localeCompare(bv);
    return sortDir === "asc" ? cmp : -cmp;
  });
  const total = data.length;
  return { data: data.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
});