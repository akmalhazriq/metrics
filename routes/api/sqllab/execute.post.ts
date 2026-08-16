/**
 * POST /api/sqllab/execute — mock execution.
 * Accepts { sql: string, limit?: number } and returns a seeded result set.
 * No DB connection — uses `getMockResult` from `src/data/sqllab.ts`.
 */
import { defineHandler, readBody } from "nitro/h3";

import { getMockResult } from "../../../src/data/sqllab";

export default defineHandler(async (event) => {
  const body = (await readBody(event)) as { sql?: string; limit?: number };
  const sql = body?.sql ?? "";
  const limit = Math.max(1, Math.min(1000, Number(body?.limit ?? 100) || 100));

  if (!sql.trim()) {
    return { error: "SQL is required", statusCode: 400 };
  }

  // Simulate a tiny delay
  await new Promise((r) => setTimeout(r, 120));

  // Simple error simulation: unknown table
  if (sql.toLowerCase().includes("from orderz")) {
    return {
      error: 'relation "orderz" does not exist',
      statusCode: 400,
    };
  }

  const result = getMockResult(sql, limit);
  return {
    columns: result.columns,
    rows: result.rows,
    rowCount: result.rows.length,
    durationMs: result.durationMs,
  };
});
