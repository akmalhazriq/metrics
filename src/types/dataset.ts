import type { DatabaseBackend } from "./database";

export type DatasetType = "physical" | "virtual";

export interface DatasetColumn {
  name: string;
  type: string; // e.g. INTEGER, VARCHAR, TIMESTAMP, NUMERIC, BOOLEAN
  groupable: boolean;
  filterable: boolean;
  description?: string;
  /** Only for calculated columns */
  expression?: string;
}

export interface DatasetMetric {
  name: string;
  sqlExpression: string;
  d3Format?: string; // e.g. ",.0f", ".2%"
  warningText?: string;
  description?: string;
}

export interface DatasetSampleRow {
  [key: string]: string | number | boolean | null;
}

export interface Dataset {
  id: number;
  name: string;
  type: DatasetType;
  /** FK into seedDatabases */
  databaseId: string;
  databaseName: string;
  backend: DatabaseBackend;
  schema: string;
  /** physical: table name; virtual: null */
  table: string | null;
  /** FK-style source label for the list */
  source: string; // `${database}.${schema}.${table}` or `${database}: ${sql short}`
  mainDatetimeColumn: string | null;
  columns: DatasetColumn[];
  metrics: DatasetMetric[];
  createdBy: { id: number; name: string };
  modifiedBy: { id: number; name: string };
  modified: string; // ISO
  owners: { id: number; name: string }[];
  description?: string;
  // Settings extras
  defaultEndpoint?: string;
  timeGrain?: string; // e.g. "P1D", "PT1H"
  cacheTimeout?: number | null;
  offset?: number;
  fetchValuesPredicate?: string;
  templateParams?: string;
  /** Only for virtual */
  sql?: string;
  sampleRows?: DatasetSampleRow[];
}

export type DatasetListParams = {
  q?: string;
  database?: string; // filter by databaseId
  schema?: string;
  owner?: string;
  type?: DatasetType | "all";
  page?: number;
  pageSize?: number;
  sortBy?: "name" | "modified" | "database";
  sortDir?: "asc" | "desc";
};

export type DatasetListResponse = {
  data: Dataset[];
  total: number;
  page: number;
  pageSize: number;
};
