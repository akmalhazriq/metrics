import { defineHandler, getQuery } from "nitro/h3";
import { db } from "../../../src/db";
import { alerts, users } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const q = ((getQuery(event).q as string) ?? "").toLowerCase().trim();
  const status = (getQuery(event).status as string) ?? "";
  const activeParam = getQuery(event).active as string | undefined;
  const sortBy = (getQuery(event).sortBy as string) ?? "modified";
  const sortDir = (getQuery(event).sortDir as string) === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(getQuery(event).page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(getQuery(event).pageSize ?? 10) || 10));

  const [rows, allUsers] = await Promise.all([db.select().from(alerts), db.select().from(users)]);
  const nameById = new Map(allUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));

  let data = rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    trigger: r.trigger,
    schedule: r.schedule,
    timezone: r.timezone,
    lastRun: r.lastRun ? r.lastRun.toISOString() : null,
    status: r.status,
    active: r.active,
    validationType: r.validationType,
    threshold: r.threshold,
    sqlQuery: r.sqlQuery,
    deliveryType: r.deliveryType,
    recipients: r.recipients ?? [],
    message: r.message,
    logRetentionDays: r.logRetentionDays,
    createdBy: r.createdById ? { id: r.createdById, name: nameById.get(r.createdById) ?? String(r.createdById) } : { id: 0, name: "Sample" },
    modifiedBy: r.modifiedById ? { id: r.modifiedById, name: nameById.get(r.modifiedById) ?? String(r.modifiedById) } : { id: 0, name: "Sample" },
    createdAt: r.createdAt.toISOString(),
    modifiedAt: r.modifiedAt.toISOString(),
  }));

  if (q) data = data.filter((d) => d.name.toLowerCase().includes(q));
  if (status && status !== "all") data = data.filter((d) => d.status === status);
  if (activeParam === "true") data = data.filter((d) => d.active);
  if (activeParam === "false") data = data.filter((d) => !d.active);

  const allowed = new Set(["name", "modified", "schedule", "status"]);
  const key = allowed.has(sortBy) ? sortBy : "modified";
  data.sort((a, b) => {
    const av = key === "modified" ? (a as Record<string, unknown>).modifiedAt as string : String((a as Record<string, unknown>)[key] ?? "");
    const bv = key === "modified" ? (b as Record<string, unknown>).modifiedAt as string : String((b as Record<string, unknown>)[key] ?? "");
    const cmp = av.localeCompare(bv);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const total = data.length;
  const sliced = data.slice((page - 1) * pageSize, page * pageSize);
  return { data: sliced, total, page, pageSize };
});