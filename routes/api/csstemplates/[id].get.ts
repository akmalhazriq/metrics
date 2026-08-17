import { defineHandler, getRouterParam } from "nitro/h3";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { cssTemplates } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id)) { event.node.res.statusCode = 400; return { error: "Invalid id" }; }
  const [row] = await db.select().from(cssTemplates).where(eq(cssTemplates.id, id));
  if (!row) { event.node.res.statusCode = 404; return { error: "Not found" }; }
  return { data: { id: row.id, name: row.name, description: row.description, cssCode: row.cssCode, createdAt: row.createdAt.toISOString(), modifiedAt: row.modifiedAt.toISOString() } };
});