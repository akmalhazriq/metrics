import { defineHandler } from "nitro/h3";

import { db } from "../../../../src/db";
import { aiSettings } from "../../../../src/db/schema";
import { requireAuth } from "../../../../src/lib/requireAuth";

function mask(key: string): string {
  if (!key) return "";
  const t = key.trim();
  if (t.length <= 4) return t ? "sk-...****" : "";
  return `sk-...${t.slice(-4)}`;
}

export default defineHandler(async (event) => {
  await requireAuth(event);
  const rows = await db.select().from(aiSettings);
  // sort newest first
  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const data = rows.map((r) => ({
    id: r.id,
    name: r.name,
    host: r.host,
    // masked — never expose full key
    apiKey: mask(r.apiKey ?? ""),
    apiKeyMasked: mask(r.apiKey ?? ""),
    hasKey: Boolean(r.apiKey && r.apiKey.trim()),
    model: r.model,
    temperature: Number(r.temperature),
    maxTokens: r.maxTokens,
    isActive: r.isActive,
    modifiedById: r.modifiedById,
    createdAt: r.createdAt.toISOString(),
    modifiedAt: r.modifiedAt.toISOString(),
  }));
  return { data };
});