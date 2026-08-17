import { defineHandler, getRouterParam, setResponseStatus } from "nitro/h3";
import { eq } from "drizzle-orm";

import { db } from "../../../../src/db";
import { aiSettings } from "../../../../src/db/schema";
import { requireAuth } from "../../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id)) {
    setResponseStatus(event, 400);
    return { error: "invalid id" };
  }
  const rows = await db.select().from(aiSettings).where(eq(aiSettings.id, id)).limit(1);
  if (!rows[0]) {
    setResponseStatus(event, 404);
    return { error: "not found" };
  }
  const all = await db.select().from(aiSettings);
  // Cannot delete if it's the only active row — would leave no provider and no way to restore mock? Actually mock fallback exists, but spec says "cannot delete if it's the only one and isActive"
  if (rows[0].isActive && all.length === 1) {
    setResponseStatus(event, 400);
    return { error: "Cannot delete the only active provider. Deactivate it first or create another provider." };
  }

  await db.delete(aiSettings).where(eq(aiSettings.id, id));
  return { success: true };
});