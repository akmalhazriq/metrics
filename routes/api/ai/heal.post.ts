/**
 * POST /api/ai/heal — self-healing SQL with optional real LLM (server-side only)
 *
 * If an active ai_settings row exists, asks the LLM to diagnose + fix using
 * the real schema; otherwise falls back to Levenshtein mock. Never auto-applied.
 */
import { defineHandler, readBody, setHeader } from "nitro/h3";

import { db } from "../../../src/db";
import { databaseTableColumns, databaseTables } from "../../../src/db/schema";
import { callLlm } from "../../../src/lib/llm/client";
import { getActiveLlmConfig } from "../../../src/lib/llm/settings";
import { requireAuth } from "../../../src/lib/requireAuth";

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}
function closest(target: string, candidates: string[]): string | null {
  if (!candidates.length) return null;
  let best: string | null = null; let bestD = Infinity;
  for (const c of candidates) { const d = levenshtein(target.toLowerCase(), c.toLowerCase()); if (d < bestD) { bestD = d; best = c; } }
  if (best !== null && bestD <= Math.max(2, Math.floor(target.length * 0.4))) return best;
  return null;
}

export default defineHandler(async (event) => {
  await requireAuth(event);
  const body = (await readBody(event)) as { sql?: string; errorMessage?: string; databaseId?: string; schema?: string; schemaName?: string };
  const sql = (body?.sql ?? "").trim();
  const errorMessage = (body?.errorMessage ?? "").trim();
  const _databaseId = (body?.databaseId ?? "analytics").trim() || "analytics";
  void _databaseId;

  if (!sql || !errorMessage) {
    setHeader(event, "x-mock-ai", "1");
    return { error: "sql and errorMessage are required", statusCode: 400 as const, _mock: true as const };
  }

  const [tableRows, colRows] = await Promise.all([db.select().from(databaseTables), db.select().from(databaseTableColumns)]);
  const allTables = tableRows.map((t) => t.name);
  const colsByTable = new Map<number, string[]>();
  for (const c of colRows) { const arr = colsByTable.get(c.tableId) ?? []; arr.push(c.name); colsByTable.set(c.tableId, arr); }
  const allColumns = [...new Set(colRows.map((c) => c.name))];
  const lowerTables = new Map(allTables.map((t) => [t.toLowerCase(), t] as const));

  // --- Try real LLM ---
  const config = await getActiveLlmConfig();
  if (config) {
    const schemaSummary = allTables.slice(0, 40).join(", ");
    const colsSummary = allColumns.slice(0, 60).join(", ");
    const system = `You are a Postgres SQL fixer. The database has tables: ${schemaSummary}. Columns (sample): ${colsSummary}. Fix the given SQL so it runs — only use tables/columns that exist. Return JSON: { fixedSql: string, diagnosis: string (one sentence), changes: [{description, before, after}] }. Never invent tables. If no close match exists, explain and leave SQL unchanged with empty changes. Output JSON only, no markdown.`;
    const userMsg = `SQL:\n${sql}\n\nError from Postgres:\n${errorMessage}\n\nReturn JSON with fixedSql, diagnosis, changes.`;
    try {
      const llmRes = await callLlm(config, [{ role: "system", content: system }, { role: "user", content: userMsg }]);
      const raw = llmRes.content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      let parsed: { fixedSql?: string; diagnosis?: string; changes?: { description: string; before: string; after: string }[] } = {};
      try { parsed = JSON.parse(raw); } catch {
        parsed = { fixedSql: sql, diagnosis: raw.slice(0, 300), changes: [] };
      }
      setHeader(event, "x-mock-ai", "0");
      return {
        fixedSql: String(parsed.fixedSql ?? sql).trim() || sql,
        diagnosis: String(parsed.diagnosis ?? "Fixed via LLM.").trim(),
        changes: Array.isArray(parsed.changes) ? parsed.changes : [],
        _mock: false as const,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[heal LLM]", msg);
      setHeader(event, "x-mock-ai", "0");
      return { error: `LLM error: ${msg}`, statusCode: 502 as const, _mock: false as const, fixedSql: sql, diagnosis: msg, changes: [] };
    }
  }

  // --- Mock fallback ---
  const lowerErr = errorMessage.toLowerCase();
  const lowerSql = sql.toLowerCase();
  let fixedSql = sql; let diagnosis = ""; const changes: { description: string; before: string; after: string }[] = [];
  const relMatch = errorMessage.match(/relation\s+"?([^"\s]+)"?\s+does not exist/i) ?? errorMessage.match(/table\s+"?([^"\s]+)"?\s+does not exist/i);
  const missingTableRaw = relMatch?.[1]?.replace(/^public\./i, "") ?? null;
  let missingTable = missingTableRaw;
  if (!missingTable) {
    const fromTokens = [...lowerSql.matchAll(/\bfrom\s+([a-z_][a-z0-9_.]*)/gi)].map((m) => m[1].split(".").pop()!);
    for (const tok of fromTokens) if (!lowerTables.has(tok)) { missingTable = tok; break; }
  }
  if (missingTable) {
    const suggestion = closest(missingTable, allTables);
    if (suggestion) {
      const re = new RegExp(`\\b${missingTable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      fixedSql = fixedSql.replace(re, suggestion);
      diagnosis = `Table "${missingTable}" does not exist. Closest real table is "${suggestion}".`;
      changes.push({ description: `Fix table name: ${missingTable} → ${suggestion}`, before: missingTable, after: suggestion });
    } else diagnosis = `Table "${missingTable}" does not exist in this database. Available tables: ${allTables.slice(0, 8).join(", ")}${allTables.length > 8 ? " …" : ""}.`;
  }
  if (!changes.length) {
    const colMatch = errorMessage.match(/column\s+"?([^"\s]+)"?\s+does not exist/i);
    const missingColRaw = colMatch?.[1]?.split(".").pop()?.replace(/"/g, "") ?? null;
    let missingCol: string | null = missingColRaw;
    if (!missingCol) { const q = errorMessage.match(/"([^"]+)"\s+does not exist/i)?.[1] ?? null; if (q && !allTables.includes(q)) missingCol = q; }
    if (missingCol) {
      const suggestion = closest(missingCol, allColumns);
      if (suggestion) {
        const re = new RegExp(`\\b${missingCol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
        fixedSql = fixedSql.replace(re, suggestion);
        diagnosis = `Column "${missingCol}" does not exist. Closest real column is "${suggestion}".`;
        changes.push({ description: `Fix column name: ${missingCol} → ${suggestion}`, before: missingCol, after: suggestion });
      } else diagnosis = `Column "${missingCol}" does not exist. Try one of: ${allColumns.slice(0, 10).join(", ")}.`;
    }
  }
  if (!changes.length && (lowerErr.includes("syntax error") || lowerErr.includes("parse error"))) {
    if (/,\s*from/i.test(sql)) {
      const before = sql; fixedSql = sql.replace(/,\s*from/gi, " FROM"); diagnosis = "Dangling comma before FROM — removed."; changes.push({ description: "Remove dangling comma before FROM", before, after: fixedSql });
    } else if (lowerErr.includes("at or near") || lowerErr.includes("near")) {
      diagnosis = "Syntax error — check quoting, commas, and that every SELECT has a FROM. The fix below re-formats LIMIT/ORDER if present.";
      if (/limit\s*;/i.test(sql)) { const before = sql; fixedSql = sql.replace(/limit\s*;/i, "LIMIT 100;"); changes.push({ description: "Add LIMIT value", before, after: fixedSql }); }
    }
  }
  if (!changes.length && (lowerErr.includes("operator does not exist") || lowerErr.includes("type mismatch") || lowerErr.includes("cannot cast"))) {
    diagnosis = "Type mismatch — an operator was applied to an incompatible column type. Check numeric vs. text columns or add an explicit ::type cast.";
  }
  if (!changes.length && !diagnosis) diagnosis = `Could not auto-fix this error. The database reports: "${errorMessage.slice(0, 180)}". Check table/column names against the schema browser on the left.`;
  if (!changes.length) fixedSql = sql;
  setHeader(event, "x-mock-ai", "1");
  await new Promise((r) => setTimeout(r, 180));
  return { fixedSql, diagnosis, changes, _mock: true as const };
});