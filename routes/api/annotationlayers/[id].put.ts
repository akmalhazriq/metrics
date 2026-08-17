import { defineHandler, getRouterParam, readBody } from "nitro/h3";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { annotationLayers } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id)) { event.node.res.statusCode = 400; return { error: "Invalid id" }; }
  const body = (await readBody(event)) as Record<string, unknown>;
  const patch: Record<string, unknown> = { modifiedAt: new Date() };
  if (body.name !== undefined) patch.name = String(body.name).trim() || null;
  if (body.description !== undefined) patch.description = body.description ? String(body.description) : null;
  if (body.annotationType !== undefined) patch.annotationType = String(body.annotationType);
  if (body.startField !== undefined) patch.startField = body.startField ? String(body.startField) : null;
  if (body.endField !== undefined) patch.endField = body.endField ? String(body.endField) : null;
  if (body.jsonMetadata !== undefined) patch.jsonMetadata = body.jsonMetadata as unknown;
  if (patch.name !== undefined && !String(patch.name).trim()) { event.node.res.statusCode = 400; return { error: "Name required" }; }
  const [row] = await db.update(annotationLayers).set(patch as never).where(eq(annotationLayers.id, id)).returning();
  if (!row) { event.node.res.statusCode = 404; return { error: "Not found" }; }
  return { data: row };
});