import type { SqlSchema } from "./sqllab";

export type DatabaseBackend =
  | "Postgres"
  | "BigQuery"
  | "Snowflake"
  | "MySQL"
  | "Presto"
  | "Redshift"
  | "Trino"
  | "SQLite";

export interface DatabaseConnection {
  id: string;
  name: string;
  backend: DatabaseBackend;
  sqlalchemyUri: string;
  serverCert?: string;
  extraParams?: string;
  impersonateUser: boolean;
  exposedInSqlLab: boolean;
  allowDML: boolean;
  allowCTA: boolean;
  allowCsvUpload: boolean;
  allowRunSync: boolean;
  secureExtra?: string;
  encryptedExtra?: string;

  // Performance
  cacheEnabled: boolean;
  cacheTimeout: number | null;
  asyncExecution: boolean;
  concurrency: number | null;
  forceSqlLab: boolean;
  templateParams?: string;

  // SQL Lab settings
  queryTimeout: number | null;
  maxRows: number | null;
  defaultSchema?: string;
  defaultLimit?: number | null;

  // Security
  owners: { id: number; name: string }[];

  // Advanced
  version?: string;
  schemaCacheEnabled: boolean;
  sshTunnelEnabled: boolean;
  sshTunnelHost?: string;
  sshTunnelPort?: number | null;

  modifiedBy: { id: number; name: string };
  modified: string; // ISO

  // Reused from SqlDatabase for SQL Lab tree
  schemas: SqlSchema[];
}

export type DatabaseListParams = {
  q?: string;
  backend?: DatabaseBackend | "all";
  page?: number;
  pageSize?: number;
  sortBy?: "name" | "backend" | "modified";
  sortDir?: "asc" | "desc";
};

export type DatabaseListResponse = {
  data: DatabaseConnection[];
  total: number;
  page: number;
  pageSize: number;
};
