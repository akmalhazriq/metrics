import { defineHandler, readBody, setResponseStatus } from "nitro/h3";
import { eq } from "drizzle-orm";

import { db } from "../../../../src/db";
import { aiSettings } from "../../../../src/db/schema";
import { requireAuth } from "../../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const body = (await readBody(event)) as {
    name?: string;
    host?: string;
    apiKey?: string;
    model?: string;
    temperature?: number | string;
    maxTokens?: number | string;
    isActive?: boolean;
  };

  const name = (body?.name ?? "").trim();
  const host = (body?.host ?? "").trim();
  const apiKey = (body?.apiKey ?? "").trim();
  const model = (body?.model ?? "").trim();
  const temperature = body?.temperature !== undefined ? Number(body.temperature) : 0.2;
  const maxTokens = body?.maxTokens !== undefined ? Number(body.maxTokens) : 4096;
  const isActive = body?.isActive !== false; // default true if not explicitly false

  if (!name || !host || !model) {
    setResponseStatus(event, 400);
    return { error: "name, host, and model are required" };
  }
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    setResponseStatus(event, 400);
    return { error: "temperature must be 0–2" };
  }
  if (!Number.isFinite(maxTokens) || maxTokens < 1 || maxTokens > 128_000) {
    setResponseStatus(event, 400);
    return { error: "maxTokens must be 1–128000" };
  }
  try {
    // Validate host is a URL
    new URL(host);
  } catch {
    setResponseStatus(event, 400);
    return { error: "host must be a valid URL (e.g. https://api.openai.com/v1)" };
  }

  // Enforce single active
  if (isActive) {
    await db.update(aiSettings).set({ isActive: false }).where(eq(aiSettings.isActive, true));
  }

  const [row] = await db
    .insert(aiSettings)
    .values({
      name,
      host,
      apiKey,
      model,
      temperature: String(temperature),
      maxTokens: Math.floor(maxTokens),
      isActive,
    })
    .returning();

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