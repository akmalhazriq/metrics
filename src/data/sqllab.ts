/**
 * Minimal seed — SQL Lab helpers.
 * Tree stays canonical via seedDatabases; history/saved start empty
 * (no seeded favorites). Real execution goes through the Pool / query_history.
 */
import type { QueryHistoryEntry, SavedQuery, SqlDatabase } from "@/types/sqllab";
import { seedDatabases } from "./databases";

export const mockDatabases: SqlDatabase[] = seedDatabases.map((db) => ({
  id: db.id,
  name: db.name,
  type: db.backend as SqlDatabase["type"],
  schemas: db.schemas,
}));

export type MockResultSet = { columns: string[]; rows: Record<string, string | number>[] };

/** Empty — no seeded queries/history. First run starts clean. */
export const mockSavedQueries: SavedQuery[] = [];
export const mockHistory: QueryHistoryEntry[] = [];

export function getMockResult(sql: string, limit: number): MockResultSet & { durationMs: number } {
  // kept for type compat; real execute.post hits Postgres now
  void sql;
  void limit;
  return { columns: ["order_id", "amount", "status"], rows: [], durationMs: 42 };
}
