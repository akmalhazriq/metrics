/**
 * GET /api/sqllab/databases — placeholder metadata API.
 * Returns the in-memory database/schema/table tree from `src/data/sqllab.ts`.
 * Swap for real connection metadata when a DB gateway exists.
 */
import { defineHandler } from "nitro/h3";

import { mockDatabases } from "../../../../src/data/sqllab";

export default defineHandler(() => {
  return { databases: mockDatabases };
});
