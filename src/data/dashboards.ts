import type { Dashboard } from "@/types/dashboard";

/**
 * Minimal seed — one dashboard laying out the 2 sample charts.
 */

export const seedDashboards: Dashboard[] = [
  {
    id: 1,
    title: "Orders Overview",
    slug: "orders-overview",
    status: "published",
    modifiedBy: { id: 0, name: "Sample" },
    modified: "2026-08-16T00:00:00.000Z",
    createdBy: { id: 0, name: "Sample" },
    owners: [],
    tags: [],
    favorite: false,
    certified: false,
    description: "Sample dashboard — revenue and recent orders from public.orders.",
    layout: [
      { id: "r1", cells: [{ id: "c1", type: "header", text: "Orders Overview", level: 1, span: 12 }] },
      {
        id: "r2",
        cells: [
          { id: "c2", type: "markdown", content: "Sample data from **Analytics · public.orders** — 12 orders across three statuses. Replace with your own dataset when ready.", span: 12 },
        ],
      },
      { id: "r3", cells: [{ id: "c3", type: "chart", chartId: 1, span: 6 }, { id: "c4", type: "chart", chartId: 2, span: 6 }] },
      { id: "r4", cells: [{ id: "c5", type: "divider", span: 12 }] },
      { id: "r5", cells: [{ id: "c6", type: "markdown", content: "Source: `public.orders` · 12 rows · last updated Aug 2026", span: 12 }] },
    ],
  },
];
