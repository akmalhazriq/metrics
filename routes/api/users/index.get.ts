import { defineHandler, getQuery } from "nitro/h3";
import { db } from "../../../src/db";
import { databaseAccess, datasourceAccess, roles, userRoles, users } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const q = ((getQuery(event).q as string) ?? "").toLowerCase().trim();
  const activeParam = getQuery(event).active as string | undefined;
  const roleFilter = ((getQuery(event).role as string) ?? "").toLowerCase().trim();
  const sortBy = (getQuery(event).sortBy as string) ?? "modified";
  const sortDir = (getQuery(event).sortDir as string) === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(getQuery(event).page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(getQuery(event).pageSize ?? 10) || 10));

  const [rows, roleRows, urRows, dbAcc, dsAcc, allRoles] = await Promise.all([
    db.select().from(users),
    db.select().from(roles),
    db.select().from(userRoles),
    db.select().from(databaseAccess),
    db.select().from(datasourceAccess),
    db.select().from(roles),
  ]);
  void allRoles;

  const roleNameById = new Map(roleRows.map((r) => [r.id, r.name]));
  const rolesByUser = new Map<number, string[]>();
  for (const r of urRows) {
    const arr = rolesByUser.get(r.userId) ?? [];
    const name = roleNameById.get(r.roleId);
    if (name) arr.push(name);
    rolesByUser.set(r.userId, arr);
  }
  const dbCountByUser = new Map<number, number>();
  for (const r of dbAcc) dbCountByUser.set(r.userId, (dbCountByUser.get(r.userId) ?? 0) + 1);
  const dsCountByUser = new Map<number, number>();
  for (const r of dsAcc) dsCountByUser.set(r.userId, (dsCountByUser.get(r.userId) ?? 0) + 1);

  let data = rows.map((u) => ({
    id: u.id,
    username: u.username,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    active: u.active ?? true,
    roles: rolesByUser.get(u.id) ?? [],
    databaseAccessCount: dbCountByUser.get(u.id) ?? 0,
    datasourceAccessCount: dsCountByUser.get(u.id) ?? 0,
    createdAt: u.createdAt.toISOString(),
    modifiedAt: u.modifiedAt.toISOString(),
  }));

  if (q) data = data.filter((d) => [d.username, d.firstName, d.lastName, d.email].some((s) => s.toLowerCase().includes(q)));
  if (activeParam === "true") data = data.filter((d) => d.active);
  if (activeParam === "false") data = data.filter((d) => !d.active);
  if (roleFilter) data = data.filter((d) => d.roles.some((r) => r.toLowerCase().includes(roleFilter)));

  const allowed = new Set(["username", "modified", "email"]);
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