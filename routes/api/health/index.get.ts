import { defineHandler } from "nitro/h3";
import { sql } from "drizzle-orm";
import { db } from "../../../src/db";

export default defineHandler(async () => {
  let database: "connected" | "error" = "connected";
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    database = "error";
  }
  return { status: "ok" as const, database, timestamp: new Date().toISOString() };
});
