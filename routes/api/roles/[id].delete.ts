import { defineHandler, getRouterParam } from "nitro/h3";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { roles } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id)) { event.node.res.statusCode = 400; return { error: "Invalid id" }; }
  await db.delete(roles).where(eq(roles.id, id));
  return { ok: true };
});