import { defineHandler, getRouterParam } from "nitro/h3";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { chartTags, dashboardTags, tags } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id)) { event.node.res.statusCode = 400; return { error: "Invalid id" }; }
  const [row] = await db.select().from(tags).where(eq(tags.id, id));
  if (!row) { event.node.res.statusCode = 404; return { error: "Not found" }; }
  await db.transaction(async (tx) => {
    await tx.delete(chartTags).where(eq(chartTags.tagId, id));
    await tx.delete(dashboardTags).where(eq(dashboardTags.tagId, id));
    await tx.delete(tags).where(eq(tags.id, id));
  });
  return { ok: true };
});