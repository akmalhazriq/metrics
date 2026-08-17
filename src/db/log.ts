import { db } from "./index";
import { actionLog } from "./schema";

type LogInput = {
  userId: number | null;
  action: string;
  objectType: string;
  objectId?: number | null;
  dashboardId?: number | null;
  chartId?: number | null;
};

export async function logAction(input: LogInput) {
  await db.insert(actionLog).values({
    userId: input.userId ?? null,
    action: input.action,
    objectType: input.objectType,
    objectId: input.objectId ?? null,
    dashboardId: input.dashboardId ?? null,
    chartId: input.chartId ?? null,
  });
}
