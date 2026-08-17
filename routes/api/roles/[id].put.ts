import { defineHandler, getRouterParam, readBody } from "nitro/h3";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { rolePermissions, roles } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id)) { event.node.res.statusCode = 400; return { error: "Invalid id" }; }
  const body = (await readBody(event)) as Record<string, unknown>;
  const patch: Record<string, unknown> = { modifiedAt: new Date() };
  if (body.name !== undefined) patch.name = String(body.name).trim() || null;
  if (body.description !== undefined) patch.description = body.description ? String(body.description) : null;
  if (patch.name !== undefined && !String(patch.name).trim()) { event.node.res.statusCode = 400; return { error: "Name required" }; }
  const permIds: number[] | undefined = Array.isArray(body.permissionIds) ? (body.permissionIds as number[]).map(Number).filter(Number.isFinite) : undefined;
  const [row] = await db.update(roles).set(patch as never).where(eq(roles.id, id)).returning();
  if (!row) { event.node.res.statusCode = 404; return { error: "Not found" }; }
  if (permIds !== undefined) await db.transaction(async (tx) => { await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id)); for (const pid of permIds) await tx.insert(rolePermissions).values({ roleId: id, permissionId: pid }).onConflictDoNothing(); });
  return { data: row };
});