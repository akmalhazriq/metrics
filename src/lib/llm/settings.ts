/** Reads the single active AI provider from Postgres — the ONLY place handlers import ai_settings. */
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { aiSettings } from "@/db/schema";

import type { LlmConfig } from "./client";

export async function getActiveLlmConfig(): Promise<LlmConfig | null> {
  const rows = await db.select().from(aiSettings).where(eq(aiSettings.isActive, true)).limit(1);
  const row = rows[0];
  if (!row || !row.host || !row.model) return null;
  // Empty apiKey means not configured — fall back to mock even if isActive
  if (!row.apiKey || !row.apiKey.trim()) return null;
  return {
    host: row.host,
    apiKey: row.apiKey,
    model: row.model,
    temperature: Number(row.temperature ?? 0.2),
    maxTokens: row.maxTokens ?? 4096,
  };
}

export function maskApiKey(key: string): string {
  if (!key) return "";
  const t = key.trim();
  if (t.length <= 4) return "sk-...****";
  return `sk-...${t.slice(-4)}`;
}
