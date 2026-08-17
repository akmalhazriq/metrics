/**
 * POST /api/ai/nl2sql — NL→SQL with optional real LLM (server-side only)
 *
 * If an active ai_settings row exists (host+apiKey+model), calls the LLM with
 * a schema-aware system prompt and parses JSON {sql, explanation, tablesUsed, confidence}.
 * Otherwise falls back to the existing mock keyword-template logic. Contract is
 * identical either way; only _mock differs (true = mock, false = real LLM).
 */
import { defineHandler, readBody, setHeader } from "nitro/h3";

import { db } from "../../../src/db";
import { databaseSchemas, databaseTableColumns, databaseTables } from "../../../src/db/schema";
import { callLlm } from "../../../src/lib/llm/client";
import { getActiveLlmConfig } from "../../../src/lib/llm/settings";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const body = (await readBody(event)) as {
    prompt?: string;
    databaseId?: string;
    schema?: string;
    schemaName?: string;
  };
  const rawPrompt = (body?.prompt ?? "").trim();
  const databaseId = (body?.databaseId ?? "analytics").trim() || "analytics";
  const schemaName = (body?.schemaName ?? body?.schema ?? "public").trim() || "public";

  if (!rawPrompt) {
    setHeader(event, "x-mock-ai", "1");
    return { error: "prompt is required", statusCode: 400 as const, _mock: true as const };
  }

  // Load real schema — same 4-table join the sqllab/databases handler uses.
  const [schemaRows, tableRows, colRows] = await Promise.all([
    db.select().from(databaseSchemas),
    db.select().from(databaseTables),
    db.select().from(databaseTableColumns),
  ]);

  const colsByTable = new Map<number, { name: string; type: string }[]>();
  for (const c of colRows) {
    const arr = colsByTable.get(c.tableId) ?? [];
    arr.push({ name: c.name, type: c.type });
    colsByTable.set(c.tableId, arr);
  }
  const tablesBySchema = new Map<number, (typeof tableRows)[number][]>();
  for (const t of tableRows) {
    const arr = tablesBySchema.get(t.schemaId) ?? [];
    arr.push(t);
    tablesBySchema.set(t.schemaId, arr);
  }

  const matchedSchemas = schemaRows.filter((s) => s.databaseId === databaseId);
  let targetSchema = matchedSchemas.find((s) => s.name === schemaName) ?? matchedSchemas[0] ?? null;
  if (!targetSchema) targetSchema = schemaRows.find((s) => s.databaseId === "analytics" && s.name === "public") ?? schemaRows[0] ?? null;

  const candidateTables: { name: string; columns: { name: string; type: string }[] }[] = targetSchema
    ? (tablesBySchema.get(targetSchema.id) ?? []).map((t) => ({ name: t.name, columns: colsByTable.get(t.id) ?? [], }))
    : [];

  const allTables: { name: string; columns: { name: string; type: string }[]; databaseId: string; schema: string }[] = [];
  for (const s of schemaRows) for (const t of tablesBySchema.get(s.id) ?? []) allTables.push({ name: t.name, columns: colsByTable.get(t.id) ?? [], databaseId: s.databaseId, schema: s.name });

  // --- Try real LLM if configured ---
  const config = await getActiveLlmConfig();
  if (config) {
    const schemaSummary = allTables
      .slice(0, 24)
      .map((t) => `${t.schema}.${t.name} (${t.columns.map((c) => `${c.name}:${c.type}`).join(", ")})`)
      .join("\n");
    const targetHint = candidateTables.length ? candidateTables.map((t) => `${schemaName}.${t.name}`).join(", ") : "none in target schema";
    const system = `You are a Postgres SQL generator for a BI tool. Use ONLY tables and columns from the schema below — never invent names. Return JSON with keys: sql (single Postgres query), explanation (one sentence grounded in real column names), tablesUsed (array of table names), confidence (0-1). SQL must be valid Postgres, end with semicolon, no markdown. Favor LIMIT 100 unless the prompt asks for aggregation.

Target database: ${databaseId}  Target schema: ${schemaName}  Tables in schema: ${targetHint}

All schemas (up to 24 tables):
${schemaSummary}
`;
    const userMsg = `Natural language request: "${rawPrompt}"\nTarget: ${databaseId}.${schemaName}\nReturn JSON only.`;
    try {
      const llmRes = await callLlm(config, [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ]);
      const raw = llmRes.content.trim();
      // Strip ```json fences if the model added them
      const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      let parsed: { sql?: string; explanation?: string; tablesUsed?: string[]; confidence?: number } = {};
      try { parsed = JSON.parse(jsonStr); } catch {
        // fallback: treat entire content as sql
        parsed = { sql: raw, explanation: "Generated via LLM (unparsed JSON).", tablesUsed: candidateTables[0] ? [candidateTables[0].name] : [], confidence: 0.7 };
      }
      const sql = String(parsed.sql ?? "").trim() || `SELECT * FROM ${schemaName}.${candidateTables[0]?.name ?? allTables[0]?.name ?? "orders"} LIMIT 100;`;
      const explanation = String(parsed.explanation ?? "").trim() || `SQL for "${rawPrompt}" using ${schemaName} schema.`;
      const tablesUsed = Array.isArray(parsed.tablesUsed) && parsed.tablesUsed.length ? parsed.tablesUsed.map(String) : candidateTables[0] ? [candidateTables[0].name] : [];
      const confidence = Number.isFinite(parsed.confidence as number) ? Math.min(1, Math.max(0, Number(parsed.confidence))) : 0.85;
      setHeader(event, "x-mock-ai", "0");
      return { sql, explanation, tablesUsed, confidence, _mock: false as const };
    } catch (e) {
      // Surface LLM error but keep contract — caller can retry or fall back manually via mock toggle
      const msg = e instanceof Error ? e.message : String(e);
      setHeader(event, "x-mock-ai", "0");
      // Return a 502-style payload so the UI can show diagnosis; still include _mock: false to indicate real path was tried
      console.error("[nl2sql LLM]", msg);
      return { error: `LLM error: ${msg}`, statusCode: 502 as const, _mock: false as const, sql: "", explanation: msg, tablesUsed: [], confidence: 0 };
    }
  }

  // --- Mock fallback (no active provider) ---
  const prompt = rawPrompt.toLowerCase();
  const findTable = (needle: string) =>
    allTables.find((t) => t.name.toLowerCase() === needle) ??
    candidateTables.find((t) => t.name.toLowerCase() === needle) ??
    null;
  const mentionOf = (name: string) => prompt.includes(name.toLowerCase());
  const qualified = (tbl: string) => `${schemaName}.${tbl}`;
  type Result = { sql: string; explanation: string; tablesUsed: string[]; confidence: number };
  let result: Result | null = null;
  const ordersTable = findTable("orders");
  const customersTable = findTable("customers");
  const shipmentsTable = findTable("shipments");
  const eventsTable = findTable("events");
  const ordersCols = ordersTable?.columns.map((c) => c.name) ?? ["order_id", "customer_id", "amount", "status", "created_at"];
  const amtCol = ordersCols.find((c) => c.toLowerCase().includes("amount")) ?? "amount";
  const statusCol = ordersCols.find((c) => c.toLowerCase().includes("status")) ?? "status";
  const createdCol = ordersCols.find((c) => c.toLowerCase().includes("created")) ?? "created_at";

  if (!result && mentionOf("customers") && (prompt.includes("top 10") || prompt.includes("top10") || prompt.includes("top customers"))) {
    const t = customersTable ?? candidateTables.find((x) => x.name === "customers") ?? candidateTables[0];
    const cols = t ? t.columns.map((c) => c.name).slice(0, 4) : ["customer_id", "email", "region", "created_at"];
    const from = t ? qualified(t.name) : "customers";
    result = { sql: `SELECT\n  ${cols.join(", ")}\nFROM ${from}\nORDER BY ${cols[0]} DESC\nLIMIT 10;`, explanation: `Top 10 rows from ${from} ordered by ${cols[0]} — using real columns from ${t ? `${t.name}` : "seed schema"}.`, tablesUsed: t ? [t.name] : ["customers"], confidence: 0.9 };
  }
  if (!result && ordersTable && (prompt.includes("per status") || prompt.includes("by status") || prompt.includes("group by status"))) {
    result = { sql: `SELECT\n  ${statusCol},\n  COUNT(*) AS order_count\nFROM ${qualified(ordersTable.name)}\nGROUP BY 1\nORDER BY order_count DESC;`, explanation: `Counts orders grouped by ${statusCol} — real column from ${qualified(ordersTable.name)}.`, tablesUsed: [ordersTable.name], confidence: 0.92 };
  }
  if (!result && ordersTable && (prompt.includes("daily revenue") || prompt.includes("revenue per day") || (prompt.includes("revenue") && prompt.includes("30 days")) || prompt.includes("daily sales"))) {
    result = { sql: `SELECT\n  DATE(${createdCol}) AS day,\n  SUM(${amtCol}) AS revenue\nFROM ${qualified(ordersTable.name)}\nWHERE ${createdCol} >= now() - interval '30 days'\nGROUP BY 1\nORDER BY 1;`, explanation: `Daily ${amtCol} summed per day over last 30 days from ${qualified(ordersTable.name)} — real date column is ${createdCol}.`, tablesUsed: [ordersTable.name], confidence: 0.88 };
  }
  if (!result && ordersTable && prompt.includes("orders") && prompt.includes("7 days")) {
    result = { sql: `SELECT\n  ${ordersCols.slice(0, 5).join(", ")}\nFROM ${qualified(ordersTable.name)}\nWHERE ${createdCol} >= now() - interval '7 days'\nORDER BY ${createdCol} DESC\nLIMIT 100;`, explanation: `Orders from last 7 days — real columns from ${qualified(ordersTable.name)} filtered on ${createdCol}.`, tablesUsed: [ordersTable.name], confidence: 0.86 };
  }
  if (!result && shipmentsTable && (mentionOf("shipments") || mentionOf("shipment") || prompt.includes("latency"))) {
    const sCols = shipmentsTable.columns.map((c) => c.name);
    const latCol = sCols.find((c) => c.toLowerCase().includes("latency")) ?? "latency_hours";
    result = { sql: `SELECT\n  ${sCols.slice(0, 4).join(", ")}\nFROM ${qualified(shipmentsTable.name)}\nWHERE ${latCol} > 20\nORDER BY ${latCol} DESC\nLIMIT 100;`, explanation: `Shipments with high ${latCol} — real columns from ${qualified(shipmentsTable.name)}.`, tablesUsed: [shipmentsTable.name], confidence: 0.84 };
  }
  if (!result && eventsTable && (mentionOf("events") || prompt.includes("funnel") || prompt.includes("event"))) {
    const cols = eventsTable.columns.map((c) => c.name).slice(0, 4);
    result = { sql: `SELECT\n  ${cols.join(", ")}\nFROM ${qualified(eventsTable.name)}\nLIMIT 100;`, explanation: `Preview of ${qualified(eventsTable.name)} — real columns from schema.`, tablesUsed: [eventsTable.name], confidence: 0.78 };
  }
  if (!result) {
    const mentioned = allTables.find((t) => mentionOf(t.name));
    const chosen = mentioned ?? (candidateTables[0] ? { name: candidateTables[0].name, columns: candidateTables[0].columns, databaseId, schema: schemaName } as never : allTables[0] ?? null) as unknown as { name: string; columns: { name: string }[]; schema: string } | null;
    if (chosen) {
      const cols = chosen.columns.map((c) => c.name).slice(0, 6);
      const from = `${(chosen as { schema: string }).schema ?? schemaName}.${chosen.name}`;
      result = { sql: `SELECT\n  ${cols.join(", ")}\nFROM ${from}\nLIMIT 100;`, explanation: `Preview of ${from} — ${cols.length} real columns from ${from}. Refine the prompt for aggregates or filters.`, tablesUsed: [chosen.name], confidence: mentioned ? 0.78 : 0.52 };
    }
  }
  if (!result) result = { sql: `SELECT 1 AS placeholder LIMIT 10;`, explanation: `No tables found in ${databaseId}.${schemaName} — returned a placeholder so the editor stays usable.`, tablesUsed: [], confidence: 0.2 };
  setHeader(event, "x-mock-ai", "1");
  await new Promise((r) => setTimeout(r, 220));
  return { sql: result.sql, explanation: result.explanation, tablesUsed: result.tablesUsed, confidence: result.confidence, _mock: true as const };
});