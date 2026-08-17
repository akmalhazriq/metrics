import { defineHandler, getRouterParam, readBody } from "nitro/h3";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { alerts } from "../../../src/db/schema";
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
  const fields = ["name", "type", "trigger", "schedule", "timezone", "status", "validationType", "threshold", "sqlQuery", "deliveryType", "message"] as const;
  const colMap: Record<string, string> = { validationType: "validationType", threshold: "threshold", sqlQuery: "sqlQuery", deliveryType: "deliveryType" };
  for (const f of fields) if (body[f] !== undefined) (patch as Record<string, unknown>)[colMap[f] ?? f] = body[f] === "" ? null : body[f];
  if (body.active !== undefined) {
    (patch as Record<string, unknown>).active = !!body.active;
    if (body.status === undefined) (patch as Record<string, unknown>).status = body.active ? "active" : "paused";
  }
  if (body.recipients !== undefined) {
    (patch as Record<string, unknown>).recipients = Array.isArray(body.recipients) ? body.recipients : String(body.recipients).split(",").map((s: string) => s.trim()).filter(Boolean);
  }
  if (body.logRetentionDays !== undefined) (patch as Record<string, unknown>).logRetentionDays = Number(body.logRetentionDays) || 30;
  if (body.name !== undefined && !String(body.name).trim()) {
    event.node.res.statusCode = 400;
    return { error: "Name is required" };
  }
  const [row] = await db.update(alerts).set(patch as never).where(eq(alerts.id, id)).returning();
  if (!row) {
    event.node.res.statusCode = 404;
    return { error: "Not found" };
  }
  return { data: row };
});