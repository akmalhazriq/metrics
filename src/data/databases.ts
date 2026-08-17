import type { DatabaseConnection } from "@/types/database";

/**
 * Minimal seed — one coherent "orders & revenue" story.
 * Single Postgres connection (this app's own metrics_bi DB, same Pool
 * that SQL Lab's execute.post runs against).
 */

const analyticsSchemas = [
  {
    name: "public",
    tables: [
      {
        name: "orders",
        rowCount: 12,
        columns: [
          { name: "order_id", type: "integer" },
          { name: "customer_id", type: "integer" },
          { name: "amount", type: "numeric" },
          { name: "status", type: "varchar" },
          { name: "created_at", type: "timestamp" },
          { name: "region", type: "varchar" },
        ],
      },
      {
        name: "customers",
        rowCount: 6,
        columns: [
          { name: "customer_id", type: "integer" },
          { name: "email", type: "varchar" },
          { name: "region", type: "varchar" },
          { name: "created_at", type: "timestamp" },
        ],
      },
    ],
  },
] as DatabaseConnection["schemas"];

export const seedDatabases: DatabaseConnection[] = [
  {
    id: "analytics",
    name: "Analytics",
    backend: "Postgres",
    sqlalchemyUri: "postgresql://postgres:postgres@localhost:5432/metrics_bi",
    serverCert: "",
    extraParams: '{"connect_timeout": 10}',
    impersonateUser: false,
    exposedInSqlLab: true,
    allowDML: false,
    allowCTA: false,
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
    queryTimeout: 300,
    maxRows: 10000,
    defaultSchema: "public",
    defaultLimit: 100,
    owners: [],
    version: "15.3",
    schemaCacheEnabled: false,
    sshTunnelEnabled: false,
    modifiedBy: { id: 0, name: "Sample" },
    modified: "2026-08-16T00:00:00.000Z",
    schemas: analyticsSchemas,
  },
];

export const mockDatabases = seedDatabases;
