import { defineHandler, readBody } from "nitro/h3";
import { db } from "../../../src/db";
import { tags } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const body = (await readBody(event)) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  const type = body.type ? String(body.type).trim() : null;
  if (!name) { event.node.res.statusCode = 400; return { error: "name required" }; }
  try {
    const [row] = await db.insert(tags).values({ name, type }).returning();
    return { data: row };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("duplicate") || msg.includes("unique")) { event.node.res.statusCode = 409; return { error: "Tag name already exists" }; }
    throw e;
  }
});