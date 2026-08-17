/**
 * POST /api/ai/converse — Conversational BI with optional real LLM (server-side only)
 *
 * If an active provider exists, interprets intent via LLM with structured JSON;
 * otherwise falls back to keyword mock. Never auto-applied — caller must Apply.
 */
import { defineHandler, readBody, setHeader } from "nitro/h3";

import { db } from "../../../src/db";
import { databaseSchemas, databaseTableColumns, databaseTables } from "../../../src/db/schema";
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

type ConverseBody = {
  message?: string;
  context?: { surface?: string; chartId?: number; datasetId?: number; vizType?: string; currentQuery?: string; dashboardId?: number; chartIds?: number[] };
};

const VIZ_ALIASES: Record<string, string> = { bar: "Bar", line: "Line", area: "Area", scatter: "Scatter", heatmap: "Heatmap", "box plot": "Box Plot", boxplot: "Box Plot", table: "Table", "big number": "Big Number", pie: "Pie", donut: "Donut" };

export default defineHandler(async (event) => {
  await requireAuth(event);
  const body = (await readBody(event)) as ConverseBody;
  const message = (body?.message ?? "").trim();
  const ctx = body?.context ?? {};
  const surface = (ctx.surface === "dashboard" ? "dashboard" : "explore") as "explore" | "dashboard";
  if (!message) { setHeader(event, "x-mock-ai", "1"); return { error: "message is required", statusCode: 400 as const, _mock: true as const }; }

  const [schemaRows, tableRows, colRows] = await Promise.all([db.select().from(databaseSchemas), db.select().from(databaseTables), db.select().from(databaseTableColumns)]);
  const colsByTable = new Map<number, { name: string; type: string }[]>();
  for (const c of colRows) { const arr = colsByTable.get(c.tableId) ?? []; arr.push({ name: c.name, type: c.type }); colsByTable.set(c.tableId, arr); }
  const tablesBySchema = new Map<number, (typeof tableRows)[number][]>();
  for (const t of tableRows) { const arr = tablesBySchema.get(t.schemaId) ?? []; arr.push(t); tablesBySchema.set(t.schemaId, arr); }
  const allTables: { name: string; columns: { name: string; type: string }[]; schema: string }[] = [];
  for (const s of schemaRows) for (const t of tablesBySchema.get(s.id) ?? []) allTables.push({ name: t.name, columns: colsByTable.get(t.id) ?? [], schema: s.name });
  const allColumns = [...new Set(colRows.map((c) => c.name))];
  const lower = message.toLowerCase();

  // --- Try real LLM ---
  const config = await getActiveLlmConfig();
  if (config) {
    const schemaSummary = allTables.slice(0, 24).map((t) => `${t.schema}.${t.name} (${t.columns.map((c) => `${c.name}:${c.type}`).join(", ")})`).join("\n");
    const contextSummary = `Surface: ${surface}\nDatasetId: ${ctx.datasetId ?? "—"} VizType: ${ctx.vizType ?? "—"} DashboardId: ${ctx.dashboardId ?? "—"} ChartIds: ${ctx.chartIds?.join(",") ?? "—"} CurrentQuery: ${(ctx.currentQuery ?? "").slice(0, 400)}`;
    const system = `You are a BI copilot. Interpret the user's natural-language request about their chart/dashboard and return JSON.
Only reference tables/columns from the schema — never invent names. Actions:
- modify_chart: change vizType (Bar/Line/Area/Scatter/Heatmap/Box Plot/Table/Big Number) or dimensions/metrics
- generate_chart: {chartConfig:{vizType,datasetId,dimension,metric}} for "show me X by Y"
- filter: {filters:[{column,operator,value}]}
- explain: narrative answer
- compare: period comparison

Return JSON: { reply: string (conversational, grounded in real names), action?: {type, payload}, sql?: string (Postgres, inspectable), tablesUsed?: string[] }. Keep reply concise. Output JSON only, no markdown.

Schema (24 tables max):
${schemaSummary}

Context:
${contextSummary}
Allowed vizTypes: Bar, Line, Area, Scatter, Heatmap, Box Plot, Table, Big Number`;
    const userMsg = `User: "${message}"\nReturn JSON with reply/action/sql/tablesUsed.`;
    try {
      const llmRes = await callLlm(config, [{ role: "system", content: system }, { role: "user", content: userMsg }]);
      const raw = llmRes.content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      let parsed: { reply?: string; action?: { type: string; payload: Record<string, unknown> }; sql?: string; tablesUsed?: string[] } = {};
      try { parsed = JSON.parse(raw); } catch {
        parsed = { reply: raw.slice(0, 800), tablesUsed: [] };
      }
      // Validate action type
      const allowed = new Set(["modify_chart", "generate_chart", "filter", "explain", "compare"]);
      let action = parsed.action as { type: string; payload: Record<string, unknown> } | undefined;
      if (action && !allowed.has(action.type)) action = undefined;
      // Validate column names in payload via closest fallback? Trust LLM but sanitize tablesUsed to real tables
      const tablesUsed = (parsed.tablesUsed ?? []).map(String).filter((t) => allTables.some((a) => a.name === t));
      // If sql empty but we have an action, synthesize a minimal sql hint
      let sql = typeof parsed.sql === "string" ? parsed.sql.trim() : "";
      if (!sql && action?.type === "filter" && tablesUsed[0]) sql = `SELECT * FROM public.${tablesUsed[0]} LIMIT 100;`;
      setHeader(event, "x-mock-ai", "0");
      return {
        reply: String(parsed.reply ?? "Done.").trim() || "Got it — see the preview below.",
        action: action as { type: "modify_chart" | "generate_chart" | "filter" | "explain" | "compare"; payload: Record<string, unknown> } | undefined,
        sql: sql || undefined,
        tablesUsed: tablesUsed.length ? tablesUsed : undefined,
        _mock: false as const,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[converse LLM]", msg);
      setHeader(event, "x-mock-ai", "0");
      return { error: `LLM error: ${msg}`, statusCode: 502 as const, _mock: false as const, reply: msg, tablesUsed: [] };
    }
  }

  // --- Mock fallback ---
  const lowerMsg = lower;
  const pickTable = (): (typeof allTables)[number] | null => {
    const mentioned = allTables.find((t) => lowerMsg.includes(t.name.toLowerCase()));
    if (mentioned) return mentioned;
    return allTables.find((t) => t.name === "orders") ?? allTables[0] ?? null;
  };
  const resolveColumn = (raw: string): string | null => {
    const low = raw.toLowerCase().trim();
    if (allColumns.some((c) => c.toLowerCase() === low)) return allColumns.find((c) => c.toLowerCase() === low)!;
    return closest(raw, allColumns);
  };
  const vizMatch = lowerMsg.match(/(?:make it|change to|switch to|as a)\s+(a\s+)?(bar|line|area|scatter|heatmap|box plot|boxplot|table|big number|pie|donut)/i);
  const requestedVizRaw = vizMatch?.[2]?.toLowerCase() ?? null;
  const requestedViz = requestedVizRaw ? VIZ_ALIASES[requestedVizRaw] ?? null : null;
  const filterMatch = lowerMsg.match(/filter to ([a-z0-9_ ]+?)(?:\s+only)?(?:[.,]|$)/i) ?? lowerMsg.match(/only show ([a-z0-9_ \-=']+?)(?:[.,]|$)/i) ?? lowerMsg.match(/where ([a-z0-9_ \-=']+?)(?:[.,]|$)/i);
  const filterRaw = filterMatch?.[1]?.trim() ?? null;
  const breakdownMatch = lowerMsg.match(/(?:break down by|group by|dimension|by)\s+([a-z_][a-z0-9_]*)/i);
  const breakdownRaw = breakdownMatch?.[1]?.trim() ?? null;
  const generateMatch = lowerMsg.match(/show me\s+([a-z_][a-z0-9_]*)\s+by\s+([a-z_][a-z0-9_]*)/i);
  const isExplain = /what drove|why did|why the|what happened|explain|root cause|dip|drop|spike/i.test(lowerMsg);
  const isCompare = /compare|versus|vs\.?|q1 vs q2|last quarter|year over year|yoy/i.test(lowerMsg);
  const table = pickTable();
  const tableName = table?.name ?? "orders";
  const schemaName = table?.schema ?? "public";
  const qualified = `${schemaName}.${tableName}`;
  const cols = table?.columns.map((c) => c.name) ?? allColumns.slice(0, 4);
  const statusCol = cols.find((c) => /status/i.test(c)) ?? cols.find((c) => /state/i.test(c)) ?? cols[3] ?? "status";
  const createdCol = cols.find((c) => /created|date|ts|time/i.test(c)) ?? cols[cols.length - 1] ?? "created_at";
  const amountCol = cols.find((c) => /amount|revenue|cost|spend|value/i.test(c)) ?? cols[1] ?? "amount";
  const regionCol = resolveColumn("region") ?? cols.find((c) => /region|channel|category/i.test(c)) ?? null;
  type Action = { type: "modify_chart" | "generate_chart" | "filter" | "explain" | "compare"; payload: Record<string, unknown> };
  let reply!: string; let action: Action | undefined; let sql: string | undefined; const tablesUsed: string[] = table ? [table.name] : [];
  if (requestedViz) {
    reply = surface === "explore" ? `Got it — I'll switch this chart to **${requestedViz}**. The underlying query stays the same; only the mark changes. Review the preview below and hit Apply when ready.` : `For this dashboard I'd render the trend as a **${requestedViz}** — dashboards reuse the same TanStack marks as Explore, so styling stays consistent.`;
    action = { type: "modify_chart", payload: { vizType: requestedViz } };
    sql = `SELECT ${cols.slice(0, 3).join(", ")} FROM ${qualified} LIMIT 100;`;
  } else if (generateMatch) {
    const rawMetric = generateMatch[1]; const rawDim = generateMatch[2];
    const metric = resolveColumn(rawMetric) ?? amountCol; const dim = resolveColumn(rawDim) ?? regionCol ?? cols[0];
    const viz = requestedViz ?? "Bar"; const dsId = ctx.datasetId ?? 1;
    reply = `I'll build a **${viz}** of **${metric}** by **${dim}** from ${qualified}. The SQL below is the exact query — inspect and Apply to render it in the preview.`;
    action = { type: "generate_chart", payload: { chartConfig: { vizType: viz, datasetId: dsId, dimension: dim, metric } } };
    sql = `SELECT\n  ${dim},\n  SUM(${metric}) AS ${metric}\nFROM ${qualified}\nGROUP BY 1\nORDER BY 2 DESC;`;
  } else if (filterRaw) {
    const eqMatch = filterRaw.match(/([a-z_][a-z0-9_]*)\s*[=:]?\s*['"]?([a-z0-9_ ]+)['"]?/i);
    const colRaw = eqMatch?.[1] ?? filterRaw.split(/\s+/)[0];
    const valRaw = eqMatch?.[2] ?? filterRaw.split(/\s+/).slice(1).join(" ") ?? filterRaw;
    const col = resolveColumn(colRaw) ?? statusCol; const val = valRaw.trim() || "paid";
    reply = `I'll filter **${qualified}** where **${col} = '${val}'** and keep the current chart type (${ctx.vizType ?? "Bar"}). Review the WHERE clause below.`;
    action = { type: "filter", payload: { filters: [{ column: col, operator: "=", value: val }] } };
    sql = `SELECT ${cols.slice(0, 4).join(", ")} FROM ${qualified} WHERE ${col} = '${val.replace(/'/g, "''")}' LIMIT 100;`;
  } else if (breakdownRaw) {
    const dim = resolveColumn(breakdownRaw) ?? regionCol ?? cols[0];
    const note = dim.toLowerCase() !== breakdownRaw.toLowerCase() ? ` (corrected from "${breakdownRaw}")` : "";
    reply = `Breaking down by **${dim}**${note} — I'll group ${amountCol} by ${dim} so you can spot the distribution. Same metric, new dimension.`;
    action = { type: "modify_chart", payload: { dimensions: [dim], metrics: [amountCol] } };
    sql = `SELECT\n  ${dim},\n  SUM(${amountCol}) AS ${amountCol}\nFROM ${qualified}\nGROUP BY 1\nORDER BY 2 DESC;`;
  } else if (isCompare) {
    reply = surface === "dashboard" ? `**Q1 vs Q2 comparison** — Q1 averaged ~$42k/week, Q2 ~$51k/week (+21%). Growth was driven by the EMEA region after the March pricing change; APAC was flat. The SQL below reproduces the comparison — add the generated chart to the dashboard if you want it pinned.` : `Comparing periods — I'll bucket ${createdCol} by quarter and sum ${amountCol}. Check the SQL and Apply to swap the dimension to a quarter grain.`;
    action = { type: "compare", payload: {} };
    sql = `SELECT\n  date_trunc('quarter', ${createdCol}) AS quarter,\n  SUM(${amountCol}) AS revenue\nFROM ${qualified}\nGROUP BY 1\nORDER BY 1;`;
  } else if (isExplain) {
    const regionClause = regionCol ? ` by ${regionCol}` : "";
    reply = surface === "dashboard" ? `**What drove the dip?** Revenue dipped ~23% in March${regionClause ? ` — the drop was concentrated in EMEA` : ""} after a shipment latency spike (avg ${createdCol} lag +4.2d). The two charts on latency and orders both trough that week, so it's operational, not demand. The SQL below isolates March${regionClause} rows — run it in SQL Lab to drill further.` : `The dip aligns with a status breakdown: **${statusCol} = 'refunded'** share rose from ~4% to ~11% that week${regionCol ? `, mostly in ${regionCol}` : ""}. Try filtering to refunded rows or breaking down by ${regionCol ?? cols[0]} to see the concentration.`;
    action = { type: "explain", payload: {} };
    sql = `SELECT\n  ${regionCol ?? cols[0]},\n  COUNT(*) AS orders,\n  SUM(${amountCol}) AS revenue\nFROM ${qualified}\nWHERE ${createdCol} >= date_trunc('month', now()) - interval '2 months'\nGROUP BY 1\nORDER BY revenue DESC;`;
  } else {
    reply = `I can modify this ${surface === "explore" ? "chart" : "dashboard"} — try “make it a line chart”, “filter to ${statusCol} = paid”, “break down by ${regionCol ?? cols[0]}”, or “show me ${amountCol} by ${regionCol ?? cols[0]}”. The SQL preview below is always inspectable before you Apply.`;
    sql = `SELECT ${cols.slice(0, 4).join(", ")} FROM ${qualified} LIMIT 100;`;
  }
  setHeader(event, "x-mock-ai", "1");
  await new Promise((r) => setTimeout(r, 220));
  return { reply, action, sql, tablesUsed, _mock: true as const };
});