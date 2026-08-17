import { createError, defineHandler, readBody } from "nitro/h3";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { passwordHashes, roles, sessions, users, userRoles } from "../../../src/db/schema";
import { generateToken, hashPassword } from "../../../src/db/auth";

export default defineHandler(async (event) => {
  // Guard — permanently dead once any user exists
  const { pool } = await import("../../../src/db/index");
  const hasRes = await pool.query("SELECT EXISTS (SELECT 1 FROM users) AS has_users");
  if (hasRes.rows[0]?.has_users) {
    throw createError({ statusCode: 409, message: "Setup already completed." });
  }

  const body = (await readBody(event)) as {
    firstName?: string;
    lastName?: string;
    username?: string;
    email?: string;
    password?: string;
    roleIds?: number[];
    roleId?: number;
    roleName?: string;
  };

  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const username = String(body.username ?? "").trim();
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  // Accept roleIds (array), roleId (single), or roleName — all resolve to roleIds
  let rawRoleIds: number[] = Array.isArray(body.roleIds) ? body.roleIds.map(Number).filter(Number.isFinite) : [];
  if (rawRoleIds.length === 0 && body.roleId != null) {
    const single = Number(body.roleId);
    if (Number.isFinite(single)) rawRoleIds = [single];
  }
  if (rawRoleIds.length === 0 && body.roleName) {
    const [byName] = await db.select().from(roles).where(eq(roles.name, String(body.roleName).trim()));
    if (!byName) throw createError({ statusCode: 400, message: `Unknown role: ${String(body.roleName).trim()}` });
    rawRoleIds = [byName.id];
  }
  const roleIds: number[] = rawRoleIds;

  if (!firstName) throw createError({ statusCode: 400, message: "First name is required." });
  if (!lastName) throw createError({ statusCode: 400, message: "Last name is required." });
  if (!username) throw createError({ statusCode: 400, message: "Username is required." });
  if (!email || !email.includes("@")) throw createError({ statusCode: 400, message: "Valid email is required." });
  if (!password || password.length < 8) throw createError({ statusCode: 400, message: "Password must be at least 8 characters." });

  const [existingUser] = await db.select().from(users).where(eq(users.username, username));
  if (existingUser) throw createError({ statusCode: 409, message: "Username already taken." });
  const [existingEmail] = await db.select().from(users).where(eq(users.email, email));
  if (existingEmail) throw createError({ statusCode: 409, message: "Email already registered." });

  // Resolve roleIds — default to Admin if none supplied
  let finalRoleIds = roleIds;
  if (finalRoleIds.length === 0) {
    const [adminRole] = await db.select().from(roles).where(eq(roles.name, "Admin"));
    if (adminRole) finalRoleIds = [adminRole.id];
  } else {
    // validate each exists
    const allRoles = await db.select().from(roles);
    const valid = new Set(allRoles.map((r) => r.id));
    for (const rid of finalRoleIds) {
      if (!valid.has(rid)) throw createError({ statusCode: 400, message: `Unknown role id: ${rid}` });
    }
  }

  const hash = hashPassword(password);

  // Transaction: create user + password + roles + session
  const result = await db.transaction(async (tx) => {
    const [newUser] = await tx.insert(users).values({
      username, firstName, lastName, email, active: true,
    }).returning({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email, active: users.active });

    await tx.insert(passwordHashes).values({ userId: newUser.id, hash });

    for (const rid of finalRoleIds) {
      await tx.insert(userRoles).values({ userId: newUser.id, roleId: rid }).onConflictDoNothing();
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600_000);
    await tx.insert(sessions).values({ userId: newUser.id, token, expiresAt });

    return { user: newUser, token };
  });

  event.node.res.statusCode = 201;
  return { token: result.token, user: result.user };
});
