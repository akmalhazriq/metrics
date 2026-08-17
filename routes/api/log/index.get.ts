import { defineHandler, getQuery } from "nitro/h3";
import { db } from "../../../src/db";
import { actionLog, users } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const q = ((getQuery(event).q as string) ?? "").toLowerCase().trim();
  const userFilter = ((getQuery(event).user as string) ?? "").toLowerCase().trim();
  const action = ((getQuery(event).action as string) ?? "").toLowerCase().trim();
  const object = ((getQuery(event).object as string) ?? "").toLowerCase().trim();
  const from = getQuery(event).from as string | undefined;
  const to = getQuery(event).to as string | undefined;
  const sortBy = (getQuery(event).sortBy as string) ?? "time";
  const sortDir = (getQuery(event).sortDir as string) === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(getQuery(event).page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(getQuery(event).pageSize ?? 10) || 10));

  const [rows, userRows] = await Promise.all([db.select().from(actionLog), db.select().from(users)]);
  const userMap = new Map(userRows.map((u) => [u.id, u.username]));

  let data = rows.map((r) => ({
    id: r.id,
    timestamp: r.timestamp.toISOString(),
    userId: r.userId,
    user: r.userId ? (userMap.get(r.userId) ?? `#${r.userId}`) : "system",
    action: r.action,
    objectType: r.objectType,
    objectId: r.objectId,
    dashboardId: r.dashboardId,
    chartId: r.chartId,
  }));

  if (q) data = data.filter((d) => [d.user, d.action, d.objectType, String(d.objectId ?? "")].some((s) => s.toLowerCase().includes(q)));
  if (userFilter) data = data.filter((d) => d.user.toLowerCase().includes(userFilter));
  if (action) data = data.filter((d) => d.action.toLowerCase() === action);
  if (object) data = data.filter((d) => d.objectType.toLowerCase() === object);
  if (from) {
    const f = new Date(from).getTime();
    if (Number.isFinite(f)) data = data.filter((d) => new Date(d.timestamp).getTime() >= f);
  }
  if (to) {
    const t = new Date(to).getTime();
    if (Number.isFinite(t)) data = data.filter((d) => new Date(d.timestamp).getTime() <= t);
  }

  const allowed = new Set(["time", "user", "action"]);
  const key = allowed.has(sortBy) ? sortBy : "time";
  data.sort((a, b) => {
    const av = key === "time" ? a.timestamp : key === "user" ? a.user : a.action;
    const bv = key === "time" ? b.timestamp : key === "user" ? b.user : b.action;
    const cmp = String(av ?? "").localeCompare(String(bv ?? ""));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const total = data.length;
  return { data: data.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
});