import { defineHandler, getHeader } from "nitro/h3";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { charts, dashboards, datasets, databases, favorites, sessions } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

function extractToken(event: unknown): string | null {
  const h = (getHeader(event as never, "authorization") as string) ?? "";
  if (h.startsWith("Bearer ")) return h.slice(7).trim();
  const xt = (getHeader(event as never, "x-session-token") as string) ?? "";
  if (xt) return xt.trim();
  return null;
}

async function getUserId(event: unknown): Promise<number | null> {
  const token = extractToken(event);
  if (!token) return null;
  const [sess] = await db.select().from(sessions).where(eq(sessions.token, token));
  if (!sess) return null;
  if (new Date(sess.expiresAt).getTime() < Date.now()) return null;
  return sess.userId;
}

export default defineHandler(async (event) => {
  await requireAuth(event);
  const userId = await getUserId(event);

  const [recentDash, recentChart, allDashCount, allChartCount, allDsCount, allDbCount] = await Promise.all([
    db.select().from(dashboards).orderBy(desc(dashboards.modifiedAt)).limit(5),
    db.select().from(charts).orderBy(desc(charts.modifiedAt)).limit(5),
    db.select().from(dashboards),
    db.select().from(charts),
    db.select().from(datasets),
    db.select().from(databases),
  ]);

  let favoriteDashes: typeof dashboards.$inferSelect[] = [];
  let favoriteCharts: typeof charts.$inferSelect[] = [];
  let createdDashes: typeof dashboards.$inferSelect[] = [];
  let createdCharts: typeof charts.$inferSelect[] = [];

  if (userId) {
    const favs = await db.select().from(favorites).where(eq(favorites.userId, userId));
    const dashFavIds = favs.filter((f) => f.entityType === "dashboard").map((f) => f.entityId);
    const chartFavIds = favs.filter((f) => f.entityType === "chart").map((f) => f.entityId);
    const { inArray } = await import("drizzle-orm");
    if (dashFavIds.length) favoriteDashes = await db.select().from(dashboards).where(inArray(dashboards.id, dashFavIds));
    if (chartFavIds.length) favoriteCharts = await db.select().from(charts).where(inArray(charts.id, chartFavIds));
    createdDashes = await db.select().from(dashboards).where(eq(dashboards.createdById, userId)).orderBy(desc(dashboards.modifiedAt)).limit(5);
    createdCharts = await db.select().from(charts).where(eq(charts.createdById, userId)).orderBy(desc(charts.modifiedAt)).limit(5);
  }

  const mapDash = (d: typeof dashboards.$inferSelect) => ({ id: d.id, title: d.title, slug: d.slug, status: d.status, modifiedAt: d.modifiedAt.toISOString() });
  const mapChart = (c: typeof charts.$inferSelect) => ({ id: c.id, name: c.name, slug: c.slug, vizType: c.vizType, modifiedAt: c.modifiedAt.toISOString() });

  return {
    recentDashboards: recentDash.map(mapDash),
    recentCharts: recentChart.map(mapChart),
    favoriteDashboards: favoriteDashes.map(mapDash),
    favoriteCharts: favoriteCharts.map(mapChart),
    createdDashboards: createdDashes.map(mapDash),
    createdCharts: createdCharts.map(mapChart),
    quickStats: { dashboards: allDashCount.length, charts: allChartCount.length, datasets: allDsCount.length, databases: allDbCount.length },
  };
});