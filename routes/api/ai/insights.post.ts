/**
 * POST /api/ai/insights — anomaly surfacing with optional real LLM (server-side only)
 *
 * If an active provider exists, computes lightweight stats server-side and asks
 * the LLM to turn them into natural-language insights. Otherwise runs the mock
 * statistical checks. Nothing persisted; regenerates every load.
 */
import { defineHandler, readBody, setHeader } from "nitro/h3";
import { inArray } from "drizzle-orm";

import { db } from "../../../src/db";
import { datasets as datasetsTable } from "../../../src/db/schema";
import { callLlm } from "../../../src/lib/llm/client";
import { getActiveLlmConfig } from "../../../src/lib/llm/settings";

import type { Insight, InsightSeverity, InsightType } from "../../../src/types/ai";
import { requireAuth } from "../../../src/lib/requireAuth";

type InsightsBody = { dashboardId?: number; chartIds?: number[]; datasets?: { datasetId: number; sampleRows: Record<string, unknown>[] }[] };

function mean(vals: number[]): number { if (!vals.length) return 0; return vals.reduce((a, b) => a + b, 0) / vals.length; }
function stddev(vals: number[], m?: number): number { if (vals.length < 2) return 0; const avg = m ?? mean(vals); const variance = vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length; return Math.sqrt(variance); }
function toNumber(v: unknown): number | null { if (typeof v === "number" && Number.isFinite(v)) return v; if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v); return null; }
function severityForDelta(absDelta: number): InsightSeverity { if (absDelta > 0.3) return "critical"; if (absDelta > 0.15) return "warning"; return "info"; }
function fmtDelta(delta: number): string { const pct = (delta * 100).toFixed(1); return `${delta > 0 ? "+" : ""}${pct}%`; }

export default defineHandler(async (event) => {
  await requireAuth(event);
  const body = (await readBody(event)) as InsightsBody;
  const dashboardId = Number(body?.dashboardId ?? 0);
  const chartIds: number[] = Array.isArray(body?.chartIds) ? body.chartIds.filter((n) => Number.isFinite(n)) : [];
  const dsPayload: { datasetId: number; sampleRows: Record<string, unknown>[] }[] = Array.isArray(body?.datasets) ? body.datasets : [];

  const datasetMeta = new Map<number, { qualified: string; tableName: string }>();
  try {
    const ids = dsPayload.map((d) => d.datasetId).filter((n) => Number.isFinite(n));
    if (ids.length) {
      const rows = await db.select().from(datasetsTable).where(inArray(datasetsTable.id, ids));
      for (const r of rows) {
        const tbl = (r.tableName ?? r.name ?? `dataset_${r.id}`).toLowerCase();
        const schema = (r.schema ?? "public").toLowerCase();
        datasetMeta.set(r.id, { qualified: `${schema}.${tbl}`, tableName: tbl });
      }
    }
  } catch { /* fallback below */ }

  // --- Try real LLM ---
  const config = await getActiveLlmConfig();
  if (config) {
    // Build summary stats for prompt (up to 6 datasets, truncate rows summary)
    const summaries: string[] = [];
    for (const ds of dsPayload.slice(0, 6)) {
      const rows = Array.isArray(ds.sampleRows) ? ds.sampleRows : [];
      if (!rows.length) continue;
      const meta = datasetMeta.get(ds.datasetId);
      const qualified = meta?.qualified ?? `public.dataset_${ds.datasetId}`;
      const chartIdForDs = chartIds.length ? chartIds[dsPayload.indexOf(ds) % chartIds.length] : undefined;
      const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      const numericKeys: string[] = []; const categoricalKeys: string[] = [];
      for (const k of keys) {
        const nums = rows.map((r) => toNumber(r[k])).filter((v): v is number => v !== null);
        if (nums.length >= rows.length * 0.5) numericKeys.push(k);
        else { const strs = rows.map((r) => r[k]).filter((v) => typeof v === "string"); if (strs.length >= rows.length * 0.4) categoricalKeys.push(k); }
      }
      const half = Math.floor(rows.length / 2);
      const lines: string[] = [`Dataset ${ds.datasetId} (${qualified}) chartId=${chartIdForDs ?? "—"} rows=${rows.length}`];
      for (const col of numericKeys.slice(0, 4)) {
        const priorVals = rows.slice(0, half).map((r) => toNumber(r[col])).filter((v): v is number => v !== null);
        const lastVals = rows.slice(half).map((r) => toNumber(r[col])).filter((v): v is number => v !== null);
        if (priorVals.length < 2 || lastVals.length < 2) continue;
        const before = mean(priorVals); const after = mean(lastVals);
        if (before === 0) continue;
        const delta = (after - before) / Math.abs(before);
        const avg = mean([...priorVals, ...lastVals]); const sd = stddev([...priorVals, ...lastVals], avg);
        lines.push(`  - ${col}: prior_mean=${before.toFixed(2)} last_mean=${after.toFixed(2)} delta=${fmtDelta(delta)} overall_mean=${avg.toFixed(2)} std=${sd.toFixed(2)} sample=[${[...priorVals, ...lastVals].slice(0, 5).join(",")}]`);
      }
      for (const cat of categoricalKeys.slice(0, 2)) {
        const counts = new Map<string, number>();
        for (const r of rows) { const v = typeof r[cat] === "string" ? r[cat] as string : String(r[cat] ?? "—"); counts.set(v, (counts.get(v) ?? 0) + 1); }
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k}:${n}`).join(", ");
        lines.push(`  - ${cat} (cat): ${top}`);
      }
      summaries.push(lines.join("\n"));
    }
    const chartHint = chartIds.length ? `ChartIds in this dashboard (round-robin map to datasets): ${chartIds.join(", ")}` : "No chartIds";
    const system = `You are a BI anomaly detector. Given summary statistics for 1-6 datasets, identify 0-4 most significant insights. Types: trend (gradual), spike/drop (≥30% jump), outlier (row far from mean), correlation (category share shift). Severity: info (>10%), warning (>15%), critical (>30%). For each insight return JSON: { id, type, severity, title (short, uses real column names), detail (1 sentence, grounded), chartId?: number, sql: string (Postgres query that would surface it), tablesUsed: string[], confidence: 0-1, change?: {before, after, delta: "+12.3%"} }. Titles like "amount dropped 23%" or "region shift: \\"EMEA\\" gained 27 pts". Only reference real qualified tables/columns from the stats. Output JSON: { insights: Insight[] }. No markdown. ${chartHint}`;
    const userMsg = summaries.length ? summaries.join("\n\n") : "No datasets — return empty insights.";
    try {
      const llmRes = await callLlm(config, [{ role: "system", content: system }, { role: "user", content: userMsg }]);
      const raw = llmRes.content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      let parsed: { insights?: unknown } = {};
      try { parsed = JSON.parse(raw); } catch {
        // try to extract JSON array
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) try { parsed = JSON.parse(m[0]); } catch { parsed = { insights: [] }; }
      }
      const rawInsights = Array.isArray((parsed as { insights?: unknown }).insights) ? (parsed as { insights: unknown[] }).insights : [];
      const allowedTypes = new Set<InsightType>(["trend", "spike", "drop", "outlier", "correlation"]);
      const allowedSev = new Set<InsightSeverity>(["info", "warning", "critical"]);
      const insights: Insight[] = [];
      for (const r of rawInsights.slice(0, 4)) {
        const o = r as Record<string, unknown>;
        const type = String(o.type ?? "trend").toLowerCase() as InsightType;
        const severity = String(o.severity ?? "info").toLowerCase() as InsightSeverity;
        if (!allowedTypes.has(type) || !allowedSev.has(severity)) continue;
        const title = String(o.title ?? "").trim() || `${type} detected`;
        const detail = String(o.detail ?? "").trim() || title;
        const sql = String(o.sql ?? "").trim() || `SELECT * FROM ${datasetMeta.get(dsPayload[0]?.datasetId)?.qualified ?? "public.dataset"} LIMIT 5;`;
        const tablesUsed = Array.isArray(o.tablesUsed) ? (o.tablesUsed as unknown[]).map(String).filter(Boolean).slice(0, 2) : [datasetMeta.get(dsPayload[0]?.datasetId)?.tableName ?? "dataset"];
        const confidence = Number.isFinite(o.confidence as number) ? Math.min(1, Math.max(0, Number(o.confidence))) : 0.82;
        const chartId = Number.isFinite(o.chartId as number) ? Number(o.chartId) : undefined;
        const ch = o.change as { before?: number; after?: number; delta?: string } | undefined;
        const change = ch && Number.isFinite(ch.before as number) && Number.isFinite(ch.after as number) ? { before: Number(ch.before), after: Number(ch.after), delta: String(ch.delta ?? "") } : undefined;
        insights.push({ id: String(o.id ?? `${dashboardId}-${insights.length}`), type, severity, title, detail, chartId, sql, tablesUsed, confidence, change });
      }
      setHeader(event, "x-mock-ai", "0");
      return { insights, _mock: false as const };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[insights LLM]", msg);
      setHeader(event, "x-mock-ai", "0");
      return { error: `LLM error: ${msg}`, statusCode: 502 as const, _mock: false as const, insights: [] as Insight[] };
    }
  }

  // --- Mock fallback ---
  const candidates: Insight[] = [];
  for (const ds of dsPayload) {
    const rows = Array.isArray(ds.sampleRows) ? ds.sampleRows : [];
    if (rows.length < 4) continue;
    const meta = datasetMeta.get(ds.datasetId);
    const qualified = meta?.qualified ?? `public.dataset_${ds.datasetId}`;
    const tableName = meta?.tableName ?? `dataset_${ds.datasetId}`;
    const chartIdForThisDataset = chartIds.length ? chartIds[dsPayload.indexOf(ds) % chartIds.length] : undefined;
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const numericKeys: string[] = []; const categoricalKeys: string[] = [];
    for (const k of keys) {
      const nums = rows.map((r) => toNumber(r[k])).filter((v): v is number => v !== null);
      if (nums.length >= rows.length * 0.5) numericKeys.push(k);
      else { const strs = rows.map((r) => r[k]).filter((v) => typeof v === "string"); if (strs.length >= rows.length * 0.4) categoricalKeys.push(k); }
    }
    const half = Math.floor(rows.length / 2);
    for (const col of numericKeys) {
      const priorVals = rows.slice(0, half).map((r) => toNumber(r[col])).filter((v): v is number => v !== null);
      const lastVals = rows.slice(half).map((r) => toNumber(r[col])).filter((v): v is number => v !== null);
      if (priorVals.length < 2 || lastVals.length < 2) continue;
      const before = mean(priorVals); const after = mean(lastVals); if (before === 0) continue;
      const delta = (after - before) / Math.abs(before); const abs = Math.abs(delta); if (abs < 0.1) continue;
      const isSpike = abs >= 0.3; const type: InsightType = isSpike ? (delta > 0 ? "spike" : "drop") : "trend";
      const severity = severityForDelta(abs); const confidence = Math.min(0.96, 0.62 + abs * 0.9); const direction = delta > 0 ? "up" : "down"; const pct = (abs * 100).toFixed(0);
      const title = type === "spike" ? `${col} spiked ${pct}%` : type === "drop" ? `${col} dropped ${pct}%` : `${col} trending ${direction} ${pct}%`;
      let driver = ""; if (categoricalKeys.length) driver = ` — most of the move is in ${categoricalKeys[0]}`;
      const detail = delta > 0 ? `Mean ${col} rose from ${before.toFixed(1)} to ${after.toFixed(1)} in the latter half${driver}.` : `Mean ${col} fell from ${before.toFixed(1)} to ${after.toFixed(1)} in the latter half${driver}.`;
      const sql = `SELECT\n  AVG(${col}) AS avg_${col}\nFROM ${qualified}\n-- compares last ${lastVals.length} rows vs prior ${priorVals.length} rows; delta ${fmtDelta(delta)}`;
      candidates.push({ id: `${dashboardId}-${ds.datasetId}-${col}-trend`, type, severity, title, detail, chartId: chartIdForThisDataset, sql, tablesUsed: [tableName], confidence: Number(confidence.toFixed(2)), change: { before: Number(before.toFixed(2)), after: Number(after.toFixed(2)), delta: fmtDelta(delta) } });
    }
    for (const col of numericKeys) {
      const vals = rows.map((r) => toNumber(r[col])).filter((v): v is number => v !== null); if (vals.length < 5) continue;
      const avg = mean(vals); const sd = stddev(vals, avg); if (sd === 0) continue;
      let best: { idx: number; val: number; z: number } | null = null;
      for (let i = 0; i < rows.length; i++) { const v = toNumber(rows[i][col]); if (v === null) continue; const z = Math.abs(v - avg) / sd; if (z > 2 && (!best || z > best.z)) best = { idx: i, val: v, z }; }
      if (!best) continue;
      const severity: InsightSeverity = best.z > 3 ? "critical" : best.z > 2.5 ? "warning" : "info";
      const confidence = Math.min(0.94, 0.55 + (best.z - 2) * 0.18);
      const title = `${col} outlier: ${best.val}`; const detail = `Row ${best.idx + 1} is ${best.z.toFixed(1)}σ from the mean (${avg.toFixed(1)} ± ${sd.toFixed(1)}). Worth a drill-down.`;
      const sql = `SELECT *\nFROM ${qualified}\nWHERE ABS(${col} - ${avg.toFixed(2)}) > 2 * ${sd.toFixed(2)}\nORDER BY ${col} DESC\nLIMIT 5;`;
      candidates.push({ id: `${dashboardId}-${ds.datasetId}-${col}-outlier`, type: "outlier", severity, title, detail, chartId: chartIdForThisDataset, sql, tablesUsed: [tableName], confidence: Number(confidence.toFixed(2)), change: { before: Number(avg.toFixed(2)), after: best.val, delta: fmtDelta((best.val - avg) / (Math.abs(avg) || 1)) } });
      break;
    }
    for (const cat of categoricalKeys) {
      const priorRows = rows.slice(0, half); const lastRows = rows.slice(half);
      const count = (arr: Record<string, unknown>[], key: string) => { const m = new Map<string, number>(); for (const r of arr) { const v = r[key]; const s = typeof v === "string" ? v : String(v ?? "—"); m.set(s, (m.get(s) ?? 0) + 1); } return m; };
      const priorMap = count(priorRows, cat); const lastMap = count(lastRows, cat);
      const allCats = new Set([...priorMap.keys(), ...lastMap.keys()]);
      let bestCat: string | null = null; let bestDelta = 0; let bestAfterShare = 0;
      for (const c of allCats) { const sharePrior = (priorMap.get(c) ?? 0) / priorRows.length; const shareLast = (lastMap.get(c) ?? 0) / lastRows.length; const d = shareLast - sharePrior; if (Math.abs(d) > Math.abs(bestDelta)) { bestDelta = d; bestCat = c; bestAfterShare = shareLast; } }
      if (bestCat === null || Math.abs(bestDelta) < 0.2) continue;
      const abs = Math.abs(bestDelta); const severity = severityForDelta(abs); const confidence = Math.min(0.92, 0.58 + abs * 0.8); const pct = (abs * 100).toFixed(0); const direction = bestDelta > 0 ? "gained" : "lost";
      const title = `${cat} shift: "${bestCat}" ${direction} ${pct} pts`; const priorShare = bestAfterShare - bestDelta;
      const detail = `"${bestCat}" moved from ${(priorShare * 100).toFixed(0)}% → ${(bestAfterShare * 100).toFixed(0)}% of ${cat} between halves.`;
      const sql = `SELECT\n  ${cat},\n  COUNT(*) AS n,\n  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct\nFROM ${qualified}\nGROUP BY 1\nORDER BY pct DESC;`;
      candidates.push({ id: `${dashboardId}-${ds.datasetId}-${cat}-corr`, type: "correlation", severity, title, detail, chartId: chartIdForThisDataset, sql, tablesUsed: [tableName], confidence: Number(confidence.toFixed(2)) });
      break;
    }
  }
  const severityRank: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2 };
  candidates.sort((a, b) => { const s = severityRank[a.severity] - severityRank[b.severity]; if (s !== 0) return s; const da = a.change ? Math.abs(parseFloat(a.change.delta)) : 0; const db = b.change ? Math.abs(parseFloat(b.change.delta)) : 0; if (db !== da) return db - da; return b.confidence - a.confidence; });
  const insights = candidates.slice(0, 4);
  setHeader(event, "x-mock-ai", "1");
  await new Promise((r) => setTimeout(r, 300));
  return { insights, _mock: true as const };
});