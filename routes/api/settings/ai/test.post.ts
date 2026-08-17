import { defineHandler, readBody } from "nitro/h3";

import { callLlm } from "../../../../src/lib/llm/client";
import { requireAuth } from "../../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const body = (await readBody(event)) as { host?: string; apiKey?: string; model?: string };
  const host = (body?.host ?? "").trim();
  const apiKey = (body?.apiKey ?? "").trim();
  const model = (body?.model ?? "").trim() || "gpt-4o";

  if (!host || !apiKey) {
    return { success: false, message: "host and apiKey are required", latencyMs: 0 };
  }
  try {
    new URL(host);
  } catch {
    return { success: false, message: "host must be a valid URL", latencyMs: 0 };
  }

  const start = Date.now();
  try {
    const res = await callLlm(
      { host, apiKey, model, temperature: 0.2, maxTokens: 16 },
      [{ role: "user", content: "Say 'connected' in one word." }],
    );
    const latencyMs = Date.now() - start;
    const ok = /connected/i.test(res.content);
    return {
      success: true,
      message: ok ? `Connected to ${model} — "${res.content.trim().slice(0, 80)}"` : `Model responded: "${res.content.trim().slice(0, 80)}"`,
      latencyMs,
    };
  } catch (e) {
    const latencyMs = Date.now() - start;
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, message: msg, latencyMs };
  }
});