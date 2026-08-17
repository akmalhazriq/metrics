import { defineHandler, getRouterParam, readBody } from "nitro/h3";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { reports } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id)) {
    event.node.res.statusCode = 400;
    return { error: "Invalid id" };
  }
  const body = (await readBody(event)) as Record<string, unknown>;
  const patch: Record<string, unknown> = { modifiedAt: new Date(), modifiedById: 1 };
  const fields = ["name", "type", "schedule", "timezone", "status", "deliveryType", "message"] as const;
  for (const f of fields) if (body[f] !== undefined) (patch as Record<string, unknown>)[f === "deliveryType" ? "deliveryType" : f] = body[f] === "" ? null : body[f];
  if (body.active !== undefined) {
    (patch as Record<string, unknown>).active = !!body.active;
    if (body.status === undefined) (patch as Record<string, unknown>).status = body.active ? "active" : "paused";
  }
  if (body.recipients !== undefined) patch.recipients = Array.isArray(body.recipients) ? body.recipients : String(body.recipients).split(",").map((s: string) => s.trim()).filter(Boolean);
  if (body.logRetentionDays !== undefined) patch.logRetentionDays = Number(body.logRetentionDays) || 30;
  if (body.dashboardId !== undefined) patch.dashboardId = body.dashboardId === null || body.dashboardId === "" ? null : Number(body.dashboardId);
  if (body.chartId !== undefined) patch.chartId = body.chartId === null || body.chartId === "" ? null : Number(body.chartId);
  if (body.filterValues !== undefined) patch.filterValues = body.filterValues === null || body.filterValues === "" ? null : typeof body.filterValues === "string" ? tryJson(String(body.filterValues)) : body.filterValues;
  if (body.name !== undefined && !String(body.name).trim()) {
    event.node.res.statusCode = 400;
    return { error: "Name is required" };
  }
  const [row] = await db.update(reports).set(patch as never).where(eq(reports.id, id)).returning();
  if (!row) {
    event.node.res.statusCode = 404;
    return { error: "Not found" };
  }
  return { data: row };
});

function tryJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}