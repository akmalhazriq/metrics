import { defineHandler, readBody } from "nitro/h3";
import { db } from "../../../src/db";
import { rolePermissions, roles } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const body = (await readBody(event)) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) { event.node.res.statusCode = 400; return { error: "Name required" }; }
  const permIds: number[] = Array.isArray(body.permissionIds) ? (body.permissionIds as number[]).map(Number).filter(Number.isFinite) : [];
  const [row] = await db.insert(roles).values({ name, description: body.description ? String(body.description) : null }).returning();
  await db.transaction(async (tx) => {
    for (const pid of permIds) await tx.insert(rolePermissions).values({ roleId: row.id, permissionId: pid }).onConflictDoNothing();
  });
  return { data: row };
});