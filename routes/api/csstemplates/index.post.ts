import { defineHandler, readBody } from "nitro/h3";
import { db } from "../../../src/db";
import { cssTemplates } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const body = (await readBody(event)) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) { event.node.res.statusCode = 400; return { error: "name required" }; }
  const [row] = await db.insert(cssTemplates).values({
    name, description: body.description ? String(body.description) : null,
    cssCode: body.cssCode ? String(body.cssCode) : null,
  }).returning();
  return { data: row };
});