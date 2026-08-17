import { defineHandler, getQuery } from "nitro/h3";
import { inArray } from "drizzle-orm";
import { db } from "../../../src/db";
import { charts, dashboards, databases, datasets } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const entitiesParam = ((getQuery(event).entities as string) ?? "").toLowerCase().trim();
  const idsParam = ((getQuery(event).ids as string) ?? "").trim();
  const wanted = entitiesParam ? entitiesParam.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : ["dashboard", "chart", "dataset", "database"];
  const ids = idsParam ? idsParam.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)) : null;

  const out: Record<string, unknown[]> = {};

  if (wanted.includes("dashboard") || wanted.includes("dashboards")) {
    const rows = ids ? await db.select().from(dashboards).where(inArray(dashboards.id, ids)) : await db.select().from(dashboards);
    out.dashboards = rows;
  }
  if (wanted.includes("chart") || wanted.includes("charts")) {
    const rows = ids ? await db.select().from(charts).where(inArray(charts.id, ids)) : await db.select().from(charts);
    out.charts = rows;
  }
  if (wanted.includes("dataset") || wanted.includes("datasets")) {
    const rows = ids ? await db.select().from(datasets).where(inArray(datasets.id, ids)) : await db.select().from(datasets);
    out.datasets = rows;
  }
  if (wanted.includes("database") || wanted.includes("databases")) {
    // databases uses text PK, ids filter not meaningful for string ids; ignore ids for databases if provided as numbers
    const rows = await db.select().from(databases);
    out.databases = rows;
  }

  event.node.res.setHeader("content-type", "application/json");
  event.node.res.setHeader("content-disposition", `attachment; filename="export-${new Date().toISOString().slice(0, 10)}.json"`);
  return out;
});