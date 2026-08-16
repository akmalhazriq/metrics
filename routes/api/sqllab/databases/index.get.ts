/**
 * GET /api/sqllab/databases — placeholder metadata API.
 * Same canonical source as `/api/databases` (`seedDatabases` from
 * `src/data/databases.ts`), projected to `SqlDatabase` shape in
 * `src/data/sqllab.ts` for backwards compat.
 * Swap for real connection metadata when a DB gateway exists.
 */
import { defineHandler } from "nitro/h3";

import { seedDatabases } from "../../../../src/data/databases";

// Return the lighter SqlDatabase projection that SQL Lab's selector uses,
// but from the same canonical array the Database List reads from.
export default defineHandler(() => {
  return {
    databases: seedDatabases.map((db) => ({
      id: db.id,
      name: db.name,
      type: db.backend,
      schemas: db.schemas,
    })),
  };
});
