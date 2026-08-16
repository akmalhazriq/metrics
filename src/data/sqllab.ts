/**
 * Mock SQL Lab data — PLACEHOLDER DATA LAYER
 *
 * Query results + history are owned here. The database/schema/table tree is
 * the canonical `seedDatabases` from `src/data/databases.ts` — re-exported as
 * `mockDatabases` so SQL Lab and the Database List share one source of truth
 * (see decision note in `src/data/databases.ts`).
 * Swap for real execution + metadata when a DB gateway exists.
 */
import type { QueryHistoryEntry, SavedQuery, SqlDatabase } from "@/types/sqllab";
import { seedDatabases } from "./databases";

/**
 * Derived from the canonical `seedDatabases` — single source, projected to
 * the lighter `SqlDatabase` shape that SQL Lab's selector needs. This keeps
 * the Database List and SQL Lab from forking into two inconsistent seeds.
 */
export const mockDatabases: SqlDatabase[] = seedDatabases.map((db) => ({
  id: db.id,
  name: db.name,
  type: db.backend as SqlDatabase["type"],
  schemas: db.schemas,
}));

export type MockResultSet = { columns: string[]; rows: Record<string, string | number>[] };

const resultSets: Record<string, MockResultSet> = {
  orders: {
    columns: ["order_id", "customer_id", "amount", "status", "created_at"],
    rows: [
      {
        order_id: 1001,
        customer_id: 42,
        amount: 129.9,
        status: "paid",
        created_at: "2026-08-14 10:12:00",
      },
      {
        order_id: 1002,
        customer_id: 18,
        amount: 89.0,
        status: "shipped",
        created_at: "2026-08-14 09:40:00",
      },
      {
        order_id: 1003,
        customer_id: 77,
        amount: 245.5,
        status: "paid",
        created_at: "2026-08-13 16:01:00",
      },
      {
        order_id: 1004,
        customer_id: 42,
        amount: 19.9,
        status: "refunded",
        created_at: "2026-08-13 14:22:00",
      },
      {
        order_id: 1005,
        customer_id: 91,
        amount: 560.0,
        status: "paid",
        created_at: "2026-08-12 11:05:00",
      },
      {
        order_id: 1006,
        customer_id: 33,
        amount: 75.25,
        status: "processing",
        created_at: "2026-08-12 09:00:00",
      },
      {
        order_id: 1007,
        customer_id: 18,
        amount: 310.0,
        status: "paid",
        created_at: "2026-08-11 18:30:00",
      },
      {
        order_id: 1008,
        customer_id: 52,
        amount: 42.0,
        status: "paid",
        created_at: "2026-08-11 12:01:00",
      },
    ],
  },
  customers: {
    columns: ["customer_id", "email", "region", "created_at"],
    rows: [
      { customer_id: 42, email: "mira@example.com", region: "EMEA", created_at: "2025-11-02" },
      { customer_id: 18, email: "jonah@example.com", region: "AMER", created_at: "2025-09-14" },
      { customer_id: 77, email: "sarah@example.com", region: "APAC", created_at: "2026-01-08" },
      { customer_id: 91, email: "dev@example.com", region: "APAC", created_at: "2026-02-20" },
    ],
  },
  events: {
    columns: ["event_id", "user_id", "event_name", "ts"],
    rows: [
      { event_id: "a1", user_id: 101, event_name: "page_view", ts: "2026-08-14 10:00:00" },
      { event_id: "a2", user_id: 101, event_name: "add_to_cart", ts: "2026-08-14 10:01:12" },
      { event_id: "a3", user_id: 42, event_name: "purchase", ts: "2026-08-14 10:02:04" },
    ],
  },
  shipments: {
    columns: ["shipment_id", "origin", "latency_hours", "cost"],
    rows: [
      { shipment_id: "S-001", origin: "KUL", latency_hours: 18.5, cost: 42.0 },
      { shipment_id: "S-002", origin: "SIN", latency_hours: 9.2, cost: 18.9 },
      { shipment_id: "S-003", origin: "BKK", latency_hours: 27.1, cost: 33.5 },
    ],
  },
};

export function getMockResult(sql: string, limit: number): MockResultSet & { durationMs: number } {
  const lower = sql.toLowerCase();
  // naive table detection
  let key: string | null = null;
  if (lower.includes("orders")) key = "orders";
  else if (lower.includes("customers")) key = "customers";
  else if (lower.includes("events")) key = "events";
  else if (lower.includes("shipments") || lower.includes("shipment")) key = "shipments";

  const base = key ? resultSets[key] : resultSets.orders;
  const rows = base.rows.slice(0, Math.max(1, Math.min(limit, base.rows.length)));
  const durationMs = 80 + Math.floor(Math.random() * 240);
  return { columns: base.columns, rows, durationMs };
}

export const mockSavedQueries: SavedQuery[] = [
  {
    id: 1,
    name: "Top orders — last 7d",
    database: "analytics",
    schema: "public",
    sql: "SELECT * FROM orders WHERE created_at >= now() - interval '7 days' ORDER BY amount DESC LIMIT 100;",
    savedBy: "Mira Chen",
    modified: "2026-08-14T08:00:00.000Z",
  },
  {
    id: 2,
    name: "Funnel drop-off by step",
    database: "analytics",
    schema: "product",
    sql: "SELECT step, count(*) FROM funnel_sessions GROUP BY 1 ORDER BY 2 DESC;",
    savedBy: "Sarah Lin",
    modified: "2026-08-12T11:00:00.000Z",
  },
  {
    id: 3,
    name: "Shipments cost outlier",
    database: "warehouse",
    schema: "ops",
    sql: "SELECT shipment_id, latency_hours, cost FROM shipments WHERE latency_hours > 24;",
    savedBy: "Omar Farouk",
    modified: "2026-08-10T09:30:00.000Z",
  },
];

export const mockHistory: QueryHistoryEntry[] = [
  {
    id: 101,
    time: "2026-08-14T10:22:00.000Z",
    user: "Akmal Hazriq",
    database: "analytics",
    schema: "public",
    rows: 8,
    status: "success",
    sql: "SELECT * FROM orders LIMIT 100;",
    durationMs: 142,
  },
  {
    id: 102,
    time: "2026-08-14T09:12:00.000Z",
    user: "Mira Chen",
    database: "analytics",
    schema: "public",
    rows: 0,
    status: "error",
    sql: "SELECT * FROM orderz LIMIT 100;",
    durationMs: 38,
    error: 'relation "orderz" does not exist',
  },
  {
    id: 103,
    time: "2026-08-13T16:40:00.000Z",
    user: "Jonah Park",
    database: "warehouse",
    schema: "ops",
    rows: 3,
    status: "success",
    sql: "SELECT * FROM shipments WHERE latency_hours > 20;",
    durationMs: 96,
  },
  {
    id: 104,
    time: "2026-08-13T11:05:00.000Z",
    user: "Akmal Hazriq",
    database: "analytics",
    schema: "product",
    rows: 3,
    status: "success",
    sql: "SELECT * FROM events LIMIT 50;",
    durationMs: 78,
  },
];
