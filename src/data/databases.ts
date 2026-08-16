/**
 * Canonical database seeds — PLACEHOLDER DATA LAYER
 *
 * Single source of truth for all database metadata in the app.
 * `src/data/sqllab.ts` re-exports `seedDatabases` as `mockDatabases` so the
 * SQL Lab selector and the Database List never diverge into two inconsistent
 * "lists of databases" during this placeholder phase.
 *
 * When a persistence layer is chosen, replace this in-memory array and the
 * two API handlers (`routes/api/databases/index.get.ts` and
 * `routes/api/sqllab/databases/index.get.ts`) that read from it.
 */
import type { DatabaseConnection } from "@/types/database";

// Keep schema/table detail in one place so SQL Lab's tree stays in sync.
// Light wrappers per backend to show scan/test breadth.
const analyticsSchemas = [
  {
    name: "public",
    tables: [
      {
        name: "orders",
        rowCount: 48291,
        columns: [
          { name: "order_id", type: "integer" },
          { name: "customer_id", type: "integer" },
          { name: "amount", type: "numeric" },
          { name: "status", type: "varchar" },
          { name: "created_at", type: "timestamp" },
        ],
      },
      {
        name: "customers",
        rowCount: 12043,
        columns: [
          { name: "customer_id", type: "integer" },
          { name: "email", type: "varchar" },
          { name: "region", type: "varchar" },
          { name: "created_at", type: "timestamp" },
        ],
      },
      {
        name: "board_metrics",
        rowCount: 892,
        columns: [
          { name: "metric", type: "varchar" },
          { name: "value", type: "numeric" },
          { name: "period", type: "date" },
        ],
      },
    ],
  },
  {
    name: "product",
    tables: [
      {
        name: "events",
        rowCount: 102394,
        columns: [
          { name: "event_id", type: "uuid" },
          { name: "user_id", type: "integer" },
          { name: "event_name", type: "varchar" },
          { name: "ts", type: "timestamp" },
        ],
      },
      {
        name: "funnel_sessions",
        rowCount: 43120,
        columns: [
          { name: "session_id", type: "uuid" },
          { name: "step", type: "varchar" },
          { name: "converted", type: "boolean" },
        ],
      },
      {
        name: "sessions",
        rowCount: 88321,
        columns: [
          { name: "session_id", type: "uuid" },
          { name: "user_id", type: "integer" },
          { name: "duration_sec", type: "integer" },
        ],
      },
    ],
  },
] as DatabaseConnection["schemas"];

const warehouseSchemas = [
  {
    name: "ops",
    tables: [
      {
        name: "shipments",
        rowCount: 65320,
        columns: [
          { name: "shipment_id", type: "string" },
          { name: "origin", type: "string" },
          { name: "latency_hours", type: "float" },
          { name: "cost", type: "float" },
        ],
      },
    ],
  },
  {
    name: "support",
    tables: [
      {
        name: "tickets",
        rowCount: 22100,
        columns: [
          { name: "ticket_id", type: "integer" },
          { name: "priority", type: "varchar" },
          { name: "status", type: "varchar" },
          { name: "created_at", type: "timestamp" },
        ],
      },
    ],
  },
  {
    name: "infra",
    tables: [
      {
        name: "aws_billing",
        rowCount: 5400,
        columns: [
          { name: "service", type: "varchar" },
          { name: "cost", type: "numeric" },
          { name: "month", type: "date" },
        ],
      },
      {
        name: "incidents",
        rowCount: 890,
        columns: [
          { name: "incident_id", type: "integer" },
          { name: "severity", type: "varchar" },
          { name: "resolved", type: "boolean" },
        ],
      },
    ],
  },
  {
    name: "finance",
    tables: [
      {
        name: "payouts",
        rowCount: 3100,
        columns: [
          { name: "payout_id", type: "integer" },
          { name: "partner_id", type: "integer" },
          { name: "amount", type: "numeric" },
        ],
      },
    ],
  },
] as DatabaseConnection["schemas"];

const marketingSchemas = [
  {
    name: "marketing",
    tables: [
      {
        name: "ad_spend",
        rowCount: 12000,
        columns: [
          { name: "channel", type: "varchar" },
          { name: "spend", type: "numeric" },
          { name: "roas", type: "float" },
        ],
      },
      {
        name: "ltv",
        rowCount: 3400,
        columns: [
          { name: "cohort", type: "varchar" },
          { name: "ltv", type: "numeric" },
        ],
      },
    ],
  },
] as DatabaseConnection["schemas"];

export const seedDatabases: DatabaseConnection[] = [
  {
    id: "analytics",
    name: "analytics",
    backend: "Postgres",
    sqlalchemyUri: "postgresql://analytics:***@db.internal:5432/analytics",
    serverCert: "",
    extraParams: '{"connect_timeout": 10}',
    impersonateUser: false,
    exposedInSqlLab: true,
    allowDML: false,
    allowCTA: true,
    allowCsvUpload: true,
    allowRunSync: true,
    secureExtra: "",
    encryptedExtra: "",
    cacheEnabled: true,
    cacheTimeout: 86400,
    asyncExecution: false,
    concurrency: 4,
    forceSqlLab: false,
    templateParams: '{"schema": "public"}',
    queryTimeout: 300,
    maxRows: 100000,
    defaultSchema: "public",
    defaultLimit: 1000,
    owners: [
      { id: 1, name: "Akmal Hazriq" },
      { id: 2, name: "Mira Chen" },
    ],
    version: "15.3",
    schemaCacheEnabled: true,
    sshTunnelEnabled: false,
    modifiedBy: { id: 2, name: "Mira Chen" },
    modified: "2026-08-14T09:40:00.000Z",
    schemas: analyticsSchemas,
  },
  {
    id: "warehouse",
    name: "warehouse",
    backend: "BigQuery",
    sqlalchemyUri: "bigquery://warehouse-prod",
    impersonateUser: true,
    exposedInSqlLab: true,
    allowDML: false,
    allowCTA: false,
    allowCsvUpload: false,
    allowRunSync: false,
    secureExtra: "",
    encryptedExtra: '{"key_path": "gs://…"}',
    cacheEnabled: false,
    cacheTimeout: null,
    asyncExecution: true,
    concurrency: 8,
    forceSqlLab: true,
    templateParams: "",
    queryTimeout: 600,
    maxRows: 50000,
    defaultSchema: "ops",
    defaultLimit: 1000,
    owners: [{ id: 3, name: "Jonah Park" }],
    version: "",
    schemaCacheEnabled: false,
    sshTunnelEnabled: false,
    modifiedBy: { id: 3, name: "Jonah Park" },
    modified: "2026-08-13T16:22:00.000Z",
    schemas: warehouseSchemas,
  },
  {
    id: "reporting",
    name: "reporting",
    backend: "Snowflake",
    sqlalchemyUri: "snowflake://reporting.us-east-1",
    impersonateUser: false,
    exposedInSqlLab: true,
    allowDML: true,
    allowCTA: true,
    allowCsvUpload: true,
    allowRunSync: true,
    secureExtra: "",
    encryptedExtra: "",
    cacheEnabled: true,
    cacheTimeout: 3600,
    asyncExecution: true,
    concurrency: 2,
    forceSqlLab: false,
    templateParams: "",
    queryTimeout: 180,
    maxRows: 20000,
    defaultSchema: "marketing",
    defaultLimit: 500,
    owners: [{ id: 4, name: "Sarah Lin" }],
    version: "8.12",
    schemaCacheEnabled: true,
    sshTunnelEnabled: true,
    sshTunnelHost: "bastion.internal",
    sshTunnelPort: 22,
    modifiedBy: { id: 4, name: "Sarah Lin" },
    modified: "2026-08-12T11:03:00.000Z",
    schemas: marketingSchemas,
  },
  {
    id: "legacy_mysql",
    name: "legacy_mysql",
    backend: "MySQL",
    sqlalchemyUri: "mysql://legacy:***@10.0.1.12/legacy",
    impersonateUser: false,
    exposedInSqlLab: false,
    allowDML: false,
    allowCTA: false,
    allowCsvUpload: false,
    allowRunSync: true,
    secureExtra: "",
    encryptedExtra: "",
    cacheEnabled: false,
    cacheTimeout: null,
    asyncExecution: false,
    concurrency: 1,
    forceSqlLab: false,
    templateParams: "",
    queryTimeout: 120,
    maxRows: 10000,
    defaultSchema: "main",
    defaultLimit: 500,
    owners: [{ id: 5, name: "Omar Farouk" }],
    version: "8.0",
    schemaCacheEnabled: false,
    sshTunnelEnabled: false,
    modifiedBy: { id: 5, name: "Omar Farouk" },
    modified: "2026-08-10T08:14:00.000Z",
    schemas: [
      {
        name: "main",
        tables: [
          {
            name: "legacy_orders",
            rowCount: 210000,
            columns: [
              { name: "id", type: "int" },
              { name: "total", type: "decimal" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "presto_adhoc",
    name: "presto_adhoc",
    backend: "Presto",
    sqlalchemyUri: "presto://presto.internal:8080/hive",
    impersonateUser: true,
    exposedInSqlLab: true,
    allowDML: false,
    allowCTA: true,
    allowCsvUpload: false,
    allowRunSync: false,
    secureExtra: "",
    encryptedExtra: "",
    cacheEnabled: true,
    cacheTimeout: 1800,
    asyncExecution: true,
    concurrency: 6,
    forceSqlLab: true,
    templateParams: "",
    queryTimeout: 900,
    maxRows: 100000,
    defaultSchema: "hive",
    defaultLimit: 1000,
    owners: [{ id: 1, name: "Akmal Hazriq" }],
    version: "0.285",
    schemaCacheEnabled: true,
    sshTunnelEnabled: false,
    modifiedBy: { id: 1, name: "Akmal Hazriq" },
    modified: "2026-08-11T14:05:00.000Z",
    schemas: [
      {
        name: "hive",
        tables: [
          {
            name: "adhoc_events",
            rowCount: 890000,
            columns: [
              { name: "event_id", type: "varchar" },
              { name: "ts", type: "timestamp" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "sqlite_demo",
    name: "sqlite_demo",
    backend: "SQLite",
    sqlalchemyUri: "sqlite:////tmp/demo.db",
    impersonateUser: false,
    exposedInSqlLab: true,
    allowDML: true,
    allowCTA: true,
    allowCsvUpload: true,
    allowRunSync: true,
    secureExtra: "",
    encryptedExtra: "",
    cacheEnabled: false,
    cacheTimeout: null,
    asyncExecution: false,
    concurrency: null,
    forceSqlLab: false,
    templateParams: "",
    queryTimeout: null,
    maxRows: null,
    defaultSchema: "main",
    defaultLimit: null,
    owners: [{ id: 2, name: "Mira Chen" }],
    version: "3.44",
    schemaCacheEnabled: false,
    sshTunnelEnabled: false,
    modifiedBy: { id: 2, name: "Mira Chen" },
    modified: "2026-08-09T10:00:00.000Z",
    schemas: [
      {
        name: "main",
        tables: [
          {
            name: "demo_table",
            rowCount: 42,
            columns: [{ name: "id", type: "integer" }],
          },
        ],
      },
    ],
  },
];

// Back-compat alias for any code that imported from databases via sqllab path.
// Prefer importing `seedDatabases` directly from "@/data/databases".
export const mockDatabases = seedDatabases;
