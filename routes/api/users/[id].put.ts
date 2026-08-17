import { defineHandler, getRouterParam, readBody } from "nitro/h3";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { databaseAccess, datasourceAccess, userRoles, users } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id)) { event.node.res.statusCode = 400; return { error: "Invalid id" }; }
  const body = (await readBody(event)) as Record<string, unknown>;
  const patch: Record<string, unknown> = { modifiedAt: new Date() };
  for (const f of ["username", "firstName", "lastName", "email"] as const) if (body[f] !== undefined) (patch as Record<string, unknown>)[f] = String(body[f]);
  if (body.active !== undefined) (patch as Record<string, unknown>).active = !!body.active;
  if (patch.username !== undefined && !String(patch.username).trim()) { event.node.res.statusCode = 400; return { error: "username required" }; }
  const roleIds: number[] | undefined = Array.isArray(body.roleIds) ? (body.roleIds as number[]).map(Number).filter(Number.isFinite) : undefined;
  const dbIds: string[] | undefined = Array.isArray(body.databaseIds) ? (body.databaseIds as string[]) : undefined;
  const dsIds: number[] | undefined = Array.isArray(body.datasetIds) ? (body.datasetIds as number[]).map(Number).filter(Number.isFinite) : undefined;

  const [row] = await db.update(users).set(patch as never).where(eq(users.id, id)).returning();
  if (!row) { event.node.res.statusCode = 404; return { error: "Not found" }; }

  await db.transaction(async (tx) => {
    if (roleIds !== undefined) { await tx.delete(userRoles).where(eq(userRoles.userId, id)); for (const rid of roleIds) await tx.insert(userRoles).values({ userId: id, roleId: rid }).onConflictDoNothing(); }
    if (dbIds !== undefined) { await tx.delete(databaseAccess).where(eq(databaseAccess.userId, id)); for (const did of dbIds) await tx.insert(databaseAccess).values({ userId: id, databaseId: did }).onConflictDoNothing(); }
    if (dsIds !== undefined) { await tx.delete(datasourceAccess).where(eq(datasourceAccess.userId, id)); for (const did of dsIds) await tx.insert(datasourceAccess).values({ userId: id, datasetId: did }).onConflictDoNothing(); }
  });
  return { data: row };
});