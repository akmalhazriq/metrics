import { defineHandler, readBody } from "nitro/h3";
import { db } from "../../../src/db";
import { charts, dashboards, databases, datasets } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

type ImportPayload = {
  dashboards?: Record<string, unknown>[];
  charts?: Record<string, unknown>[];
  datasets?: Record<string, unknown>[];
  databases?: Record<string, unknown>[];
  file?: string;
  json?: string;
  data?: unknown;
};

function decodePayload(body: ImportPayload): Record<string, unknown[]> | null {
  // handle base64 file field
  if (body.file) {
    try {
      const decoded = Buffer.from(body.file, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded) as Record<string, unknown>;
      if (Array.isArray(parsed)) return { dashboards: parsed as Record<string, unknown>[] };
      return parsed as Record<string, unknown[]>;
    } catch { /* fall through */ }
  }
  if (body.json) {
    try {
      const parsed = JSON.parse(body.json) as Record<string, unknown>;
      if (Array.isArray(parsed)) return { dashboards: parsed as Record<string, unknown>[] };
      return parsed as Record<string, unknown[]>;
    } catch { /* fall through */ }
  }
  if (body.data) {
    if (typeof body.data === "string") {
      try {
        const parsed = JSON.parse(body.data) as Record<string, unknown>;
        return parsed as Record<string, unknown[]>;
      } catch { /* fall through */ }
    } else if (typeof body.data === "object") return body.data as Record<string, unknown[]>;
  }
  // direct keys
  const hasKeys = body.dashboards || body.charts || body.datasets || body.databases;
  if (hasKeys) return { dashboards: body.dashboards, charts: body.charts, datasets: body.datasets, databases: body.databases };
  // if body itself looks like export (has dashboards/charts arrays) without wrapper
  if (Array.isArray(body as unknown)) return { dashboards: body as unknown as Record<string, unknown>[] };
  // last try: body is the payload itself
  const maybe = body as unknown as Record<string, unknown[]>;
  if (maybe.dashboards || maybe.charts || maybe.datasets || maybe.databases) return maybe;
  return null;
}

export default defineHandler(async (event) => {
  await requireAuth(event);
  const body = (await readBody(event)) as ImportPayload & Record<string, unknown>;
  const payload = decodePayload(body);
  if (!payload) { event.node.res.statusCode = 400; return { error: "Invalid import JSON — expected { dashboards, charts, datasets, databases }" }; }

  const summary: Record<string, number> = { databases: 0, datasets: 0, dashboards: 0, charts: 0, tags: 0 };
  const errors: string[] = [];

  await db.transaction(async (tx) => {
    if (Array.isArray(payload.databases) && payload.databases.length) {
      for (const d of payload.databases) {
        try {
          const id = String((d.id as string) ?? `import_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
          await tx.insert(databases).values({
            id,
            name: String(d.name ?? d.title ?? id),
            backend: String(d.backend ?? "postgresql"),
            sqlalchemyUri: String(d.sqlalchemyUri ?? d.sqlalchemy_uri ?? "postgresql://localhost/metrics"),
          }).onConflictDoNothing();
          summary.databases += 1;
        } catch (e: unknown) { errors.push(`database: ${e instanceof Error ? e.message : String(e)}`); }
      }
    }
    if (Array.isArray(payload.datasets) && payload.datasets.length) {
      for (const ds of payload.datasets) {
        try {
          const databaseId = String(ds.databaseId ?? ds.database_id ?? "analytics");
          await tx.insert(datasets).values({
            name: String(ds.name ?? "Imported dataset"),
            databaseId,
            schema: String(ds.schema ?? "public"),
            tableName: ds.tableName ? String(ds.tableName) : ds.table ? String(ds.table) : null,
            type: String(ds.type ?? "physical"),
          });
          summary.datasets += 1;
        } catch (e: unknown) { errors.push(`dataset: ${e instanceof Error ? e.message : String(e)}`); }
      }
    }
    if (Array.isArray(payload.dashboards) && payload.dashboards.length) {
      for (const d of payload.dashboards) {
        try {
          const title = String(d.title ?? d.name ?? "Imported dashboard");
          const slug = String(d.slug ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + `-${Date.now().toString(36)}`);
          await tx.insert(dashboards).values({
            title, slug, status: String(d.status ?? "draft"), description: d.description ? String(d.description) : null,
            layout: (d.layout as Record<string, unknown> | null) ?? [],
          });
          summary.dashboards += 1;
        } catch (e: unknown) { errors.push(`dashboard: ${e instanceof Error ? e.message : String(e)}`); }
      }
    }
    if (Array.isArray(payload.charts) && payload.charts.length) {
      for (const c of payload.charts) {
        try {
          const name = String(c.name ?? c.title ?? "Imported chart");
          const slug = String(c.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + `-${Date.now().toString(36)}`);
          await tx.insert(charts).values({
            name, slug, vizType: String(c.vizType ?? c.viz_type ?? "bar"), datasetId: (c.datasetId as number | null) ?? null,
          });
          summary.charts += 1;
        } catch (e: unknown) { errors.push(`chart: ${e instanceof Error ? e.message : String(e)}`); }
      }
    }
  });

  return { summary, errors: errors.length ? errors : undefined };
});