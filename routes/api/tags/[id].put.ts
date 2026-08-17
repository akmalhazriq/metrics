import { defineHandler, getRouterParam, readBody } from "nitro/h3";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { tags } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id)) { event.node.res.statusCode = 400; return { error: "Invalid id" }; }
  const body = (await readBody(event)) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = String(body.name).trim() || null;
  if (body.type !== undefined) patch.type = body.type ? String(body.type).trim() : null;
  if (patch.name !== undefined && !String(patch.name).trim()) { event.node.res.statusCode = 400; return { error: "Name required" }; }
  const [row] = await db.update(tags).set(patch as never).where(eq(tags.id, id)).returning();
  if (!row) { event.node.res.statusCode = 404; return { error: "Not found" }; }
  return { data: row };
});