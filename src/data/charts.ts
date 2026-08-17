import type { Chart } from "@/types/chart";

/**
 * Minimal seed — 2 charts on the "orders" dataset.
 * No fake owners — consumers render "Sample" when owners is empty.
 */

export const seedCharts: Chart[] = [
  {
    id: 1,
    name: "Revenue by Status",
    slug: "revenue-by-status",
    vizType: "Bar",
    dataset: "orders",
    database: "Analytics",
    schema: "public",
    table: "orders",
    modified: "2026-08-16T00:00:00.000Z",
    modifiedBy: { id: 0, name: "Sample" },
    createdBy: { id: 0, name: "Sample" },
    owners: [],
    tags: [],
    favorite: false,
    certified: false,
    description: "Total revenue grouped by order status.",
  },
  {
    id: 2,
    name: "Orders — Recent",
    slug: "orders-recent",
    vizType: "Table",
    dataset: "orders",
    database: "Analytics",
    schema: "public",
    table: "orders",
    modified: "2026-08-16T00:00:00.000Z",
    modifiedBy: { id: 0, name: "Sample" },
    createdBy: { id: 0, name: "Sample" },
    owners: [],
    tags: [],
    favorite: false,
    description: "Latest 12 orders with amount, status and region.",
  },
];
