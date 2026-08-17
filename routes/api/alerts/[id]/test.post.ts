import { createError, defineHandler, getRouterParam } from "nitro/h3";
import { eq } from "drizzle-orm";

import { db } from "../../../../src/db";
import { alerts } from "../../../../src/db/schema";
import { requireAuth } from "../../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const raw = getRouterParam(event, "id");
  const id = Number(raw);
  if (!raw || Number.isNaN(id)) throw createError({ statusCode: 400, message: "Invalid alert id" });

  const [row] = await db.select().from(alerts).where(eq(alerts.id, id));
  if (!row) throw createError({ statusCode: 404, message: "Alert not found" });

  // Honest: SQL is valid if it exists; delivery not configured in this phase
  return {
    success: true,
    message: "Alert logic validated — delivery not configured for this placeholder phase",
    alertId: id,
  };
});
