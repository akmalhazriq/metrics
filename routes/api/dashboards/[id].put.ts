/**
 * PUT /api/dashboards/:id — Drizzle/Postgres
 *
 * Mutates dashboards table: title/slug/description/layout/status,
 * bumps modifiedAt/modifiedBy. Validates layout span 1-12 and chartId
 * existence via DB lookup. No owner/tag mutation in this pass.
 */
import { createError, defineHandler, getRouterParam, readBody } from "nitro/h3";
import { eq } from "drizzle-orm";

import { db } from "../../../src/db";
import { charts, dashboards } from "../../../src/db/schema";
import type { DashboardLayoutRow } from "../../../src/types/dashboard";
import { requireAuth } from "../../../src/lib/requireAuth";

async function isValidLayout(v: unknown, existingChartIds: Set<number>): Promise<boolean> {
  if (!Array.isArray(v)) return false;
  for (const row of v as unknown[]) {
    if (!row || typeof row !== "object") return false;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || !Array.isArray(r.cells)) return false;
    for (const cell of r.cells as unknown[]) {
      if (!cell || typeof cell !== "object") return false;
      const c = cell as Record<string, unknown>;
      if (typeof c.id !== "string" || typeof c.type !== "string" || typeof c.span !== "number") return false;
      if (c.span < 1 || c.span > 12) return false;
      if (c.type === "chart") {
        if (typeof c.chartId !== "number") return false;
        if (!existingChartIds.has(c.chartId)) return false;
      } else if (c.type === "header") {
        if (typeof c.text !== "string") return false;
      } else if (c.type === "markdown") {
        if (typeof c.content !== "string") return false;
      } else if (c.type !== "divider") return false;
    }
  }
  return true;
}

export default defineHandler(async (event) => {
  await requireAuth(event);
  const raw = getRouterParam(event, "id");
  const id = Number(raw);
  if (!raw || Number.isNaN(id)) throw createError({ statusCode: 400, message: "Invalid dashboard id" });

  const existing = await db.select().from(dashboards).where(eq(dashboards.id, id));
  const dashboard = existing[0];
  if (!dashboard) throw createError({ statusCode: 404, message: "Dashboard not found" });

  const body = (await readBody(event)) as Partial<{ title: string; description: string; layout: DashboardLayoutRow[]; status: string }>;

  const patch: Record<string, unknown> = {};

  if (body.layout !== undefined) {
    const chartRows = await db.select({ id: charts.id }).from(charts);
    const chartIds = new Set(chartRows.map((c) => c.id));
    if (!(await isValidLayout(body.layout, chartIds))) throw createError({ statusCode: 400, message: "Invalid layout shape" });
    patch.layout = body.layout as unknown as Record<string, unknown>;
  }
  if (typeof body.title === "string" && body.title.trim()) {
    const t = body.title.trim().slice(0, 120);
    patch.title = t;
    patch.slug = t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || dashboard.slug;
  }
  if (body.description !== undefined) {
    patch.description = body.description.trim() || null;
  }
  if (typeof body.status === "string" && ["published", "draft", "archived"].includes(body.status)) {
    patch.status = body.status;
  }
  patch.modifiedAt = new Date();
  patch.modifiedById = 1;

  if (Object.keys(patch).length > 0) {
    await db.update(dashboards).set(patch as never).where(eq(dashboards.id, id));
  }

  const [updated] = await db.select().from(dashboards).where(eq(dashboards.id, id));
  return { data: updated };
});