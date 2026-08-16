export type SqlColumn = { name: string; type: string; nullable?: boolean };

export type SqlTable = {
  name: string;
  columns: SqlColumn[];
  rowCount?: number;
  description?: string;
};

export type SqlSchema = { name: string; tables: SqlTable[] };

export type SqlDatabase = {
  id: string;
  name: string;
  type:
    | "Postgres"
    | "BigQuery"
    | "Snowflake"
    | "MySQL"
    | "Presto"
    | "Redshift"
    | "Trino"
    | "SQLite";
  schemas: SqlSchema[];
};

export type QueryResult = {
  columns: string[];
  rows: Record<string, string | number>[];
  rowCount: number;
  durationMs: number;
};

export type QueryTab = {
  id: string;
  title: string;
  sql: string;
  databaseId: string;
  schemaName: string;
  limit: number;
  result?: QueryResult;
  error?: string;
  running?: boolean;
  elapsedMs?: number;
};

export type SavedQuery = {
  id: number;
  name: string;
  database: string;
  schema: string;
  sql: string;
  savedBy: string;
  modified: string;
  description?: string;
};

export type QueryHistoryEntry = {
  id: number;
  time: string; // ISO
  user: string;
  database: string;
  schema: string;
  rows: number;
  status: "success" | "error" | "running";
  sql: string;
  durationMs: number;
  error?: string;
};
