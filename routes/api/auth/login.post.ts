import { defineHandler, readBody } from "nitro/h3";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { passwordHashes, sessions, users } from "../../../src/db/schema";
import { generateToken, verifyPassword } from "../../../src/db/auth";

export default defineHandler(async (event) => {
  const body = (await readBody(event)) as { username?: string; password?: string };
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  if (!username || !password) {
    event.node.res.statusCode = 400;
    return { error: "username and password required" };
  }
  const [user] = await db.select().from(users).where(eq(users.username, username));
  if (!user) {
    // Also try case-insensitive or without suffix? Keep strict.
    event.node.res.statusCode = 401;
    return { error: "Invalid credentials" };
  }
  if (!user.active) {
    event.node.res.statusCode = 403;
    return { error: "Account is disabled" };
  }
  const [ph] = await db.select().from(passwordHashes).where(eq(passwordHashes.userId, user.id));
  if (!ph || !verifyPassword(password, ph.hash)) {
    event.node.res.statusCode = 401;
    return { error: "Invalid credentials" };
  }
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600_000);
  await db.insert(sessions).values({ userId: user.id, token, expiresAt });
  return {
    token,
    user: { id: user.id, username: user.username, firstName: user.firstName, lastName: user.lastName, email: user.email, active: user.active },
  };
});
