import type { Dataset } from "@/types/dataset";

/**
 * Minimal seed — orders & revenue.
 * Two physical datasets on the single "Analytics" DB / public schema.
 * Sample rows are the same rows re-inserted as real tables in seed.ts
 * (public.orders / public.customers) so SQL Lab reads the same data.
 */

export const seedDatasets: Dataset[] = [
  {
    id: 1,
    name: "orders",
    type: "physical",
    databaseId: "analytics",
    databaseName: "Analytics",
    backend: "Postgres",
    schema: "public",
    table: "orders",
    source: "analytics.public.orders",
    mainDatetimeColumn: "created_at",
    columns: [
      { name: "order_id", type: "INTEGER", groupable: false, filterable: true, description: "Primary key" },
      { name: "customer_id", type: "INTEGER", groupable: true, filterable: true, description: "Customer" },
      { name: "amount", type: "NUMERIC", groupable: false, filterable: true, description: "Order total" },
      { name: "status", type: "VARCHAR", groupable: true, filterable: true, description: "paid / shipped / refunded" },
      { name: "created_at", type: "TIMESTAMP", groupable: true, filterable: true, description: "Order time" },
      { name: "region", type: "VARCHAR", groupable: true, filterable: true, description: "EMEA / AMER / APAC" },
    ],
    metrics: [
      { name: "total_revenue", sqlExpression: "SUM(amount)", d3Format: "$,.2f", description: "Gross revenue" },
      { name: "order_count", sqlExpression: "COUNT(*)", d3Format: ",.0f", description: "Orders" },
      { name: "avg_order_value", sqlExpression: "AVG(amount)", d3Format: "$,.2f", description: "AOV" },
    ],
    createdBy: { id: 0, name: "Sample" },
    modifiedBy: { id: 0, name: "Sample" },
    modified: "2026-08-16T00:00:00.000Z",
    owners: [],
    description: "Orders fact — the one table dashboards and charts read.",
    defaultEndpoint: "/table/1",
    timeGrain: "P1D",
    cacheTimeout: 0,
    templateParams: "",
    sampleRows: [
      { order_id: 1001, customer_id: 1, amount: 129.9, status: "paid", created_at: "2026-08-12 10:00:00", region: "EMEA" },
      { order_id: 1002, customer_id: 2, amount: 89.0, status: "shipped", created_at: "2026-08-12 11:30:00", region: "AMER" },
      { order_id: 1003, customer_id: 3, amount: 245.5, status: "paid", created_at: "2026-08-11 09:00:00", region: "APAC" },
      { order_id: 1004, customer_id: 1, amount: 19.9, status: "refunded", created_at: "2026-08-11 14:00:00", region: "EMEA" },
      { order_id: 1005, customer_id: 4, amount: 560.0, status: "paid", created_at: "2026-08-10 08:00:00", region: "AMER" },
      { order_id: 1006, customer_id: 5, amount: 75.25, status: "paid", created_at: "2026-08-10 12:00:00", region: "EMEA" },
      { order_id: 1007, customer_id: 2, amount: 310.0, status: "shipped", created_at: "2026-08-09 16:00:00", region: "APAC" },
      { order_id: 1008, customer_id: 6, amount: 42.0, status: "paid", created_at: "2026-08-09 09:00:00", region: "EMEA" },
      { order_id: 1009, customer_id: 3, amount: 18.5, status: "refunded", created_at: "2026-08-08 10:00:00", region: "AMER" },
      { order_id: 1010, customer_id: 4, amount: 199.0, status: "paid", created_at: "2026-08-08 15:00:00", region: "APAC" },
      { order_id: 1011, customer_id: 1, amount: 88.0, status: "paid", created_at: "2026-08-07 11:00:00", region: "EMEA" },
      { order_id: 1012, customer_id: 6, amount: 132.5, status: "shipped", created_at: "2026-08-07 14:30:00", region: "EMEA" },
    ],
  },
  {
    id: 2,
    name: "customers",
    type: "physical",
    databaseId: "analytics",
    databaseName: "Analytics",
    backend: "Postgres",
    schema: "public",
    table: "customers",
    source: "analytics.public.customers",
    mainDatetimeColumn: "created_at",
    columns: [
      { name: "customer_id", type: "INTEGER", groupable: false, filterable: true },
      { name: "email", type: "VARCHAR", groupable: true, filterable: true },
      { name: "region", type: "VARCHAR", groupable: true, filterable: true, description: "EMEA / AMER / APAC" },
      { name: "created_at", type: "TIMESTAMP", groupable: true, filterable: true },
    ],
    metrics: [{ name: "customer_count", sqlExpression: "COUNT(DISTINCT customer_id)", d3Format: ",.0f" }],
    createdBy: { id: 0, name: "Sample" },
    modifiedBy: { id: 0, name: "Sample" },
    modified: "2026-08-16T00:00:00.000Z",
    owners: [],
    description: "Customer dimension for orders.",
    timeGrain: "P1D",
    cacheTimeout: null,
    sampleRows: [
      { customer_id: 1, email: "ana@example.com", region: "EMEA", created_at: "2025-11-02" },
      { customer_id: 2, email: "ben@example.com", region: "AMER", created_at: "2025-09-14" },
      { customer_id: 3, email: "cara@example.com", region: "APAC", created_at: "2026-01-08" },
      { customer_id: 4, email: "dan@example.com", region: "AMER", created_at: "2026-02-20" },
      { customer_id: 5, email: "emi@example.com", region: "EMEA", created_at: "2026-03-12" },
      { customer_id: 6, email: "finn@example.com", region: "EMEA", created_at: "2026-04-01" },
    ],
  },
];
