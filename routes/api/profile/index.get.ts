import { defineHandler, getHeader } from "nitro/h3";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { actionLog, charts, dashboards, favorites, sessions, users, userRoles, roles } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

function extractToken(event: unknown): string | null {
  const h = (getHeader(event as never, "authorization") as string) ?? "";
  if (h.startsWith("Bearer ")) return h.slice(7).trim();
  const xt = (getHeader(event as never, "x-session-token") as string) ?? "";
  if (xt) return xt.trim();
  return null;
}

export default defineHandler(async (event) => {
  await requireAuth(event);
  const token = extractToken(event);
  if (!token) {
    event.node.res.statusCode = 401;
    return { error: "Not authenticated" };
  }
  const [sess] = await db.select().from(sessions).where(eq(sessions.token, token));
  if (!sess || new Date(sess.expiresAt).getTime() < Date.now()) {
    event.node.res.statusCode = 401;
    return { error: "Invalid session" };
  }
  const [user] = await db.select().from(users).where(eq(users.id, sess.userId));
  if (!user) {
    event.node.res.statusCode = 404;
    return { error: "User not found" };
  }
  const urs = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));
  const roleIds = urs.map((r) => r.roleId);
  let roleRows: typeof roles.$inferSelect[] = [];
  if (roleIds.length) {
    const { inArray } = await import("drizzle-orm");
    roleRows = await db.select().from(roles).where(inArray(roles.id, roleIds));
  }
  // favorites joined
  const favs = await db.select().from(favorites).where(eq(favorites.userId, user.id));
  const dashFavIds = favs.filter((f) => f.entityType === "dashboard").map((f) => f.entityId);
  const chartFavIds = favs.filter((f) => f.entityType === "chart").map((f) => f.entityId);
  let favDash: typeof dashboards.$inferSelect[] = [];
  let favChart: typeof charts.$inferSelect[] = [];
  if (dashFavIds.length) {
    const { inArray } = await import("drizzle-orm");
    favDash = await db.select().from(dashboards).where(inArray(dashboards.id, dashFavIds));
  }
  if (chartFavIds.length) {
    const { inArray } = await import("drizzle-orm");
    favChart = await db.select().from(charts).where(inArray(charts.id, chartFavIds));
  }
  const recentActivity = await db.select().from(actionLog).where(eq(actionLog.userId, user.id)).orderBy(desc(actionLog.timestamp)).limit(10);
  const createdDash = await db.select().from(dashboards).where(eq(dashboards.createdById, user.id)).orderBy(desc(dashboards.modifiedAt)).limit(10);
  const createdChart = await db.select().from(charts).where(eq(charts.createdById, user.id)).orderBy(desc(charts.modifiedAt)).limit(10);

  return {
    user: { id: user.id, username: user.username, firstName: user.firstName, lastName: user.lastName, email: user.email, active: user.active },
    roles: roleRows.map((r) => ({ id: r.id, name: r.name })),
    favorites: {
      dashboards: favDash.map((d) => ({ id: d.id, title: d.title, slug: d.slug })),
      charts: favChart.map((c) => ({ id: c.id, name: c.name, slug: c.slug, vizType: c.vizType })),
    },
    recentActivity: recentActivity.map((a) => ({ id: a.id, action: a.action, objectType: a.objectType, objectId: a.objectId, dashboardId: a.dashboardId, chartId: a.chartId, timestamp: a.timestamp.toISOString() })),
    created: {
      dashboards: createdDash.map((d) => ({ id: d.id, title: d.title, slug: d.slug })),
      charts: createdChart.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
    },
  };
});