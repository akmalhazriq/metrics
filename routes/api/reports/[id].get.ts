import { defineHandler, getRouterParam } from "nitro/h3";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { reportRuns, reports, users } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id)) {
    event.node.res.statusCode = 400;
    return { error: "Invalid id" };
  }
  const [row] = await db.select().from(reports).where(eq(reports.id, id));
  if (!row) {
    event.node.res.statusCode = 404;
    return { error: "Not found" };
  }
  const [allUsers, runs] = await Promise.all([db.select().from(users), db.select().from(reportRuns).where(eq(reportRuns.reportId, id))]);
  const nameById = new Map(allUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
  return {
    data: {
      id: row.id,
      name: row.name,
      type: row.type,
      schedule: row.schedule,
      timezone: row.timezone,
      lastRun: row.lastRun ? row.lastRun.toISOString() : null,
      status: row.status,
      active: row.active,
      deliveryType: row.deliveryType,
      recipients: row.recipients ?? [],
      message: row.message,
      logRetentionDays: row.logRetentionDays,
      dashboardId: row.dashboardId,
      chartId: row.chartId,
      filterValues: row.filterValues,
      createdBy: row.createdById ? { id: row.createdById, name: nameById.get(row.createdById) ?? String(row.createdById) } : { id: 0, name: "Sample" },
      modifiedBy: row.modifiedById ? { id: row.modifiedById, name: nameById.get(row.modifiedById) ?? String(row.modifiedById) } : { id: 0, name: "Sample" },
      createdAt: row.createdAt.toISOString(),
      modifiedAt: row.modifiedAt.toISOString(),
      runs: runs.sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime()).slice(0, 10).map((r) => ({
        id: r.id,
        status: r.status,
        errorMessage: r.errorMessage,
        executedAt: r.executedAt.toISOString(),
      })),
    },
  };
});