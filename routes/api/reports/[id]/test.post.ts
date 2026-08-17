import { createError, defineHandler, getRouterParam } from "nitro/h3";
import { eq } from "drizzle-orm";

import { db } from "../../../../src/db";
import { reports } from "../../../../src/db/schema";
import { requireAuth } from "../../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const raw = getRouterParam(event, "id");
  const id = Number(raw);
  if (!raw || Number.isNaN(id)) throw createError({ statusCode: 400, message: "Invalid report id" });

  const [row] = await db.select().from(reports).where(eq(reports.id, id));
  if (!row) throw createError({ statusCode: 404, message: "Report not found" });

  return {
    success: true,
    message: "Report logic validated — delivery not configured for this placeholder phase",
    reportId: id,
  };
});
