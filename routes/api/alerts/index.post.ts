import { defineHandler, readBody } from "nitro/h3";
import { db } from "../../../src/db";
import { alerts } from "../../../src/db/schema";
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
  const [row] = await db
    .insert(alerts)
    .values({
      name,
      type: String(body.type ?? "Alert"),
      trigger: String(body.trigger ?? "Threshold"),
      schedule: String(body.schedule ?? "0 9 * * *"),
      timezone: String(body.timezone ?? "UTC"),
      status: body.active === false ? "paused" : String(body.status ?? "active"),
      active: body.active !== false,
      validationType: body.validationType ? String(body.validationType) : null,
      threshold: body.threshold != null ? String(body.threshold) : null,
      sqlQuery: body.sqlQuery ? String(body.sqlQuery) : null,
      deliveryType: String(body.deliveryType ?? "email"),
      recipients: Array.isArray(body.recipients) ? (body.recipients as string[]) : body.recipients ? String(body.recipients).split(",").map((s: string) => s.trim()).filter(Boolean) : [],
      message: body.message ? String(body.message) : null,
      logRetentionDays: Number(body.logRetentionDays ?? 30) || 30,
      createdById: 1,
      modifiedById: 1,
      createdAt: now,
      modifiedAt: now,
    })
    .returning();
  return { data: row };
});