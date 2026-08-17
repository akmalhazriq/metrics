import { defineHandler, getRouterParam } from "nitro/h3";
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
  await db.transaction(async (tx) => {
    await tx.delete(alerts).where(eq(alerts.id, id));
  });
  return { ok: true };
});