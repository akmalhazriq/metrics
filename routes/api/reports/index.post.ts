import { defineHandler, readBody } from "nitro/h3";
import { db } from "../../../src/db";
import { reports } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const body = (await readBody(event)) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) {
    event.node.res.statusCode = 400;
    return { error: "Name is required" };
  }
  const now = new Date();
  const dashboardId = body.dashboardId != null && body.dashboardId !== "" ? Number(body.dashboardId) : null;
  const chartId = body.chartId != null && body.chartId !== "" ? Number(body.chartId) : null;
  const [row] = await db
    .insert(reports)
    .values({
      name,
      type: String(body.type ?? "Report"),
      schedule: String(body.schedule ?? "0 9 * * MON"),
      timezone: String(body.timezone ?? "UTC"),
      status: body.active === false ? "paused" : String(body.status ?? "active"),
      active: body.active !== false,
      deliveryType: String(body.deliveryType ?? "email"),
      recipients: Array.isArray(body.recipients) ? (body.recipients as string[]) : body.recipients ? String(body.recipients).split(",").map((s: string) => s.trim()).filter(Boolean) : [],
      message: body.message ? String(body.message) : null,
      logRetentionDays: Number(body.logRetentionDays ?? 30) || 30,
      dashboardId: dashboardId && Number.isFinite(dashboardId) ? dashboardId : null,
      chartId: chartId && Number.isFinite(chartId) ? chartId : null,
      filterValues: body.filterValues ? (typeof body.filterValues === "string" ? tryJson(body.filterValues) : body.filterValues as Record<string, unknown>) : null,
      createdById: 1,
      modifiedById: 1,
      createdAt: now,
      modifiedAt: now,
    })
    .returning();
  return { data: row };
});

function tryJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}