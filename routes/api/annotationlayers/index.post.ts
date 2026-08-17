import { defineHandler, readBody } from "nitro/h3";
import { db } from "../../../src/db";
import { annotationLayers } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const body = (await readBody(event)) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) { event.node.res.statusCode = 400; return { error: "name required" }; }
  const annotationType = String(body.annotationType ?? "event").trim();
  const [row] = await db.insert(annotationLayers).values({
    name, description: body.description ? String(body.description) : null,
    annotationType,
    startField: body.startField ? String(body.startField) : null,
    endField: body.endField ? String(body.endField) : null,
    jsonMetadata: body.jsonMetadata as Record<string, unknown> | null ?? null,
  }).returning();
  return { data: row };
});