import { defineHandler, readBody } from "nitro/h3";
import { db } from "../../../src/db";
import { databaseAccess, datasourceAccess, userRoles, users } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const body = (await readBody(event)) as Record<string, unknown>;
  const username = String(body.username ?? "").trim();
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = String(body.email ?? "").trim();
  if (!username || !firstName || !email) {
    event.node.res.statusCode = 400;
    return { error: "username, firstName, email required" };
  }
  const password = body.password != null ? String(body.password) : null;
  void password;
  const roleIds: number[] = Array.isArray(body.roleIds) ? (body.roleIds as number[]).map(Number).filter(Number.isFinite) : [];
  const dbIds: string[] = Array.isArray(body.databaseIds) ? (body.databaseIds as string[]) : [];
  const dsIds: number[] = Array.isArray(body.datasetIds) ? (body.datasetIds as number[]).map(Number).filter(Number.isFinite) : [];

  const [row] = await db
    .insert(users)
    .values({
      username,
      firstName,
      lastName: lastName || firstName,
      email,
      active: body.active !== false,
    })
    .returning();

  await db.transaction(async (tx) => {
    for (const rid of roleIds) await tx.insert(userRoles).values({ userId: row.id, roleId: rid }).onConflictDoNothing();
    for (const did of dbIds) await tx.insert(databaseAccess).values({ userId: row.id, databaseId: did }).onConflictDoNothing();
    for (const did of dsIds) await tx.insert(datasourceAccess).values({ userId: row.id, datasetId: did }).onConflictDoNothing();
  });

  return { data: row };
});