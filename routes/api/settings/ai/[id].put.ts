import { defineHandler, getRouterParam, readBody, setResponseStatus } from "nitro/h3";
import { eq } from "drizzle-orm";

import { db } from "../../../../src/db";
import { aiSettings } from "../../../../src/db/schema";
import { requireAuth } from "../../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id)) {
    setResponseStatus(event, 400);
    return { error: "invalid id" };
  }
  const body = (await readBody(event)) as {
    name?: string;
    host?: string;
    apiKey?: string;
    model?: string;
    temperature?: number | string;
    maxTokens?: number | string;
    isActive?: boolean;
  };

  const existing = await db.select().from(aiSettings).where(eq(aiSettings.id, id)).limit(1);
  if (!existing[0]) {
    setResponseStatus(event, 404);
    return { error: "not found" };
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const v = body.name.trim();
    if (!v) { setResponseStatus(event, 400); return { error: "name cannot be empty" }; }
    patch.name = v;
  }
  if (body.host !== undefined) {
    const v = body.host.trim();
    try { new URL(v); } catch { setResponseStatus(event, 400); return { error: "host must be a valid URL" }; }
    patch.host = v;
  }
  if (body.apiKey !== undefined) patch.apiKey = body.apiKey.trim();
  if (body.model !== undefined) {
    const v = body.model.trim();
    if (!v) { setResponseStatus(event, 400); return { error: "model cannot be empty" }; }
    patch.model = v;
  }
  if (body.temperature !== undefined) {
    const n = Number(body.temperature);
    if (!Number.isFinite(n) || n < 0 || n > 2) { setResponseStatus(event, 400); return { error: "temperature must be 0–2" }; }
    patch.temperature = String(n);
  }
  if (body.maxTokens !== undefined) {
    const n = Number(body.maxTokens);
    if (!Number.isFinite(n) || n < 1 || n > 128_000) { setResponseStatus(event, 400); return { error: "maxTokens must be 1–128000" }; }
    patch.maxTokens = Math.floor(n);
  }
  if (body.isActive !== undefined) patch.isActive = Boolean(body.isActive);
  patch.modifiedAt = new Date();

  // Enforce single active if setting this one active
  if (patch.isActive === true) {
    await db.update(aiSettings).set({ isActive: false }).where(eq(aiSettings.isActive, true));
  }

  const [row] = await db.update(aiSettings).set(patch as never).where(eq(aiSettings.id, id)).returning();
  return {
    data: {
      id: row.id,
      name: row.name,
      host: row.host,
      model: row.model,
      temperature: Number(row.temperature),
      maxTokens: row.maxTokens,
      isActive: row.isActive,
    },
  };
});