import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  FlaskConical,
  History,
  Play,
  Plus,
  Save,
  Search,
  Square,
  Table2,
  Trash2,
  X,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mockDatabases, mockHistory, mockSavedQueries, getMockResult } from "@/data/sqllab";
import type { QueryHistoryEntry, QueryTab, SavedQuery } from "@/types/sqllab";

const SQL_KEYWORDS =
  /(\bSELECT\b|\bFROM\b|\bWHERE\b|\bGROUP BY\b|\bORDER BY\b|\bLIMIT\b|\bJOIN\b|\bON\b|\bAS\b|\bAND\b|\bOR\b|\bIN\b|\bNOT\b|\bNULL\b|\bCOUNT\b|\bSUM\b|\bAVG\b|\bNOW\b|\bINTERVAL\b|\bDESC\b|\bASC\b)/gi;

function highlightSql(sql: string) {
  const parts: { text: string; keyword: boolean }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(SQL_KEYWORDS);
  while ((m = re.exec(sql))) {
    if (m.index > last) parts.push({ text: sql.slice(last, m.index), keyword: false });
    parts.push({ text: m[0], keyword: true });
    last = m.index + m[0].length;
  }
  if (last < sql.length) parts.push({ text: sql.slice(last), keyword: false });
  return parts;
}

const STARTER_SQL = `SELECT
  order_id,
  customer_id,
  amount,
  status,
  created_at
FROM orders
WHERE created_at >= now() - interval '7 days'
ORDER BY amount DESC
LIMIT 100;`;

function newTab(): QueryTab {
  return {
    id: Math.random().toString(36).slice(2, 8),
    title: "Untitled",
    sql: STARTER_SQL,
    databaseId: "analytics",
    schemaName: "public",
    limit: 100,
  };
}

function formatIso(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SqlLabPage() {
  const navigate = useNavigate();
  const [databases] = useState(mockDatabases);
  const [selectedDb, setSelectedDb] = useState("analytics");
  const [selectedSchema, setSelectedSchema] = useState("public");
  const [tableSearch, setTableSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["orders"]));

  const [tabs, setTabs] = useState<QueryTab[]>(() => [newTab()]);
  const [activeId, setActiveId] = useState<string>(() => tabs[0]?.id ?? "");
  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];

  const [bottomTab, setBottomTab] = useState<"results" | "history" | "saved">("results");
  const [history, setHistory] = useState<QueryHistoryEntry[]>(mockHistory);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>(mockSavedQueries);
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  // Deep-link from the standalone list pages: /sqllab?open=ID or ?history=ID
  // uses sessionStorage so F5 keeps working even if query param is stripped by "View all"
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openId = params.get("open");
    const histId = params.get("history");
    let opened = false;
    if (openId) {
      try {
        const raw = sessionStorage.getItem("metric:openSavedQuery");
        const sq: SavedQuery | null = raw
          ? (JSON.parse(raw) as SavedQuery)
          : (mockSavedQueries.find((s) => String(s.id) === openId) ?? null);
        if (sq) {
          const nt: QueryTab = {
            id: Math.random().toString(36).slice(2, 8),
            title: sq.name,
            sql: sq.sql,
            databaseId: sq.database,
            schemaName: sq.schema,
            limit: 100,
          };
          setTabs((p) => [...p, nt]);
          setActiveId(nt.id);
          showToast(`Opened "${sq.name}"`);
          opened = true;
        }
      } catch {
        /* ignore */
      }
    }
    if (!opened && histId) {
      try {
        const raw = sessionStorage.getItem("metric:openHistoryEntry");
        const h: QueryHistoryEntry | null = raw
          ? (JSON.parse(raw) as QueryHistoryEntry)
          : (mockHistory.find((x) => String(x.id) === histId) ?? null);
        if (h) {
          const nt: QueryTab = {
            id: Math.random().toString(36).slice(2, 8),
            title: `History #${h.id}`,
            sql: h.sql,
            databaseId: h.database,
            schemaName: h.schema,
            limit: 100,
          };
          setTabs((p) => [...p, nt]);
          setActiveId(nt.id);
          showToast(`Opened history #${h.id}`);
          opened = true;
        }
      } catch {
        /* ignore */
      }
    }
    if (opened) {
      // clean the URL so a refresh doesn't re-add a duplicate tab
      navigate("/sqllab", { replace: true });
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const db = databases.find((d) => d.id === selectedDb) ?? databases[0];
  const schema = db.schemas.find((s) => s.name === selectedSchema) ??
    db.schemas[0] ?? { name: "public", tables: [] };

  const filteredTables = useMemo(() => {
    if (!tableSearch.trim()) return schema.tables;
    const q = tableSearch.toLowerCase();
    return schema.tables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.columns.some((c) => c.name.toLowerCase().includes(q)),
    );
  }, [schema.tables, tableSearch]);

  const updateActive = (patch: Partial<QueryTab>) => {
    setTabs((prev) => prev.map((t) => (t.id === activeId ? { ...t, ...patch } : t)));
  };

  const addTab = () => {
    const nt = newTab();
    nt.databaseId = selectedDb;
    nt.schemaName = selectedSchema;
    setTabs((p) => [...p, nt]);
    setActiveId(nt.id);
  };

  const closeTab = (id: string) => {
    if (tabs.length === 1) {
      showToast("At least one tab must remain");
      return;
    }
    const idx = tabs.findIndex((t) => t.id === id);
    setTabs((prev) => prev.filter((t) => t.id !== id));
    if (id === activeId) {
      const next = tabs[Math.max(0, idx - 1)];
      if (next && next.id !== id) setActiveId(next.id);
    }
  };

  const runQuery = async () => {
    if (!activeTab) return;
    if (activeTab.running) return;
    const sql = activeTab.sql;
    if (!sql.trim()) {
      showToast("Write some SQL first");
      return;
    }
    updateActive({ running: true, error: undefined, result: undefined, elapsedMs: 0 });
    const start = Date.now();
    timerRef.current = window.setInterval(() => {
      updateActive({ elapsedMs: Date.now() - start });
    }, 100);

    try {
      // Try real handler first, fall back to client mock if dev server not ready
      let data: {
        columns: string[];
        rows: Record<string, string | number>[];
        rowCount: number;
        durationMs: number;
        error?: string;
      } | null = null;
      try {
        const res = await fetch("/api/sqllab/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sql, limit: activeTab.limit }),
        });
        if (res.ok) data = (await res.json()) as typeof data;
        else {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? "Query failed");
        }
      } catch {
        // fallback to client mock
        const mock = getMockResult(sql, activeTab.limit);
        data = {
          columns: mock.columns,
          rows: mock.rows,
          rowCount: mock.rows.length,
          durationMs: mock.durationMs,
        };
        if (sql.toLowerCase().includes("from orderz"))
          throw new Error('relation "orderz" does not exist');
      }

      if (!data) throw new Error("No result");

      const duration = Date.now() - start;
      updateActive({
        result: {
          columns: data.columns,
          rows: data.rows,
          rowCount: data.rowCount,
          durationMs: data.durationMs ?? duration,
        },
        running: false,
        error: undefined,
        elapsedMs: duration,
      });
      setHistory((prev) => [
        {
          id: Date.now(),
          time: new Date().toISOString(),
          user: "Akmal Hazriq",
          database: activeTab.databaseId,
          schema: activeTab.schemaName,
          rows: data!.rowCount,
          status: "success",
          sql,
          durationMs: data!.durationMs ?? duration,
        },
        ...prev,
      ]);
      setBottomTab("results");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Query failed";
      const duration = Date.now() - start;
      updateActive({ running: false, error: msg, elapsedMs: duration });
      setHistory((prev) => [
        {
          id: Date.now(),
          time: new Date().toISOString(),
          user: "Akmal Hazriq",
          database: activeTab.databaseId,
          schema: activeTab.schemaName,
          rows: 0,
          status: "error",
          sql,
          durationMs: duration,
          error: msg,
        },
        ...prev,
      ]);
      setBottomTab("results");
    } finally {
      if (timerRef.current) window.clearInterval(timerRef.current);
    }
  };

  const stopQuery = () => {
    if (!activeTab?.running) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    updateActive({ running: false, error: "Query cancelled" });
    showToast("Query stopped");
  };

  const copySql = async () => {
    if (!activeTab) return;
    await navigator.clipboard.writeText(activeTab.sql);
    showToast("SQL copied");
  };

  const exportCsv = () => {
    const res = activeTab?.result;
    if (!res) {
      showToast("Nothing to export — run a query first");
      return;
    }
    const csv = [
      res.columns.join(","),
      ...res.rows.map((r) => res.columns.map((c) => String(r[c] ?? "")).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${res.rowCount} rows as CSV`);
  };

  const saveQuery = () => {
    if (!activeTab) return;
    const name = window.prompt(
      "Name this query:",
      activeTab.title === "Untitled" ? "Untitled query" : activeTab.title,
    );
    if (!name) return;
    const sq: SavedQuery = {
      id: Date.now(),
      name,
      database: activeTab.databaseId,
      schema: activeTab.schemaName,
      sql: activeTab.sql,
      savedBy: "Akmal Hazriq",
      modified: new Date().toISOString(),
    };
    setSavedQueries((p) => [sq, ...p]);
    setTabs((prev) => prev.map((t) => (t.id === activeId ? { ...t, title: name } : t)));
    showToast("Query saved");
  };

  const openSaved = (sq: SavedQuery) => {
    const nt: QueryTab = {
      // eslint-disable-next-line react-hooks/purity
      id: Math.random().toString(36).slice(2, 8),
      title: sq.name,
      sql: sq.sql,
      databaseId: sq.database,
      schemaName: sq.schema,
      limit: 100,
    };
    setTabs((p) => [...p, nt]);
    setActiveId(nt.id);
    showToast("Opened saved query");
  };

  const lineCount = activeTab ? activeTab.sql.split("\n").length : 1;

  return (
    <AppShell>
      <div className="flex min-h-[calc(100vh-44px)] flex-col">
        {/* Top meta bar */}
        <div className="border-border bg-card flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <span className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
            <FlaskConical className="h-3.5 w-3.5" />
            SQL Lab
          </span>
          <span className="text-muted-foreground hidden text-xs sm:inline">
            Write, run, and share SQL — results stay inspectable.
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground hidden text-xs lg:inline">
              No database connected — using mock execution
            </span>
            <span className="bg-warning text-warning-foreground rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide">
              PLACEHOLDER
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col lg:flex-row">
          {/* Left — table browser */}
          <aside className="border-border bg-sidebar flex w-full shrink-0 flex-col border-b lg:w-[280px] lg:border-r lg:border-b-0">
            <div className="border-border border-b p-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-muted-foreground text-[11px] font-semibold tracking-widest uppercase">
                    Database
                  </span>
                  <div className="relative">
                    <select
                      value={selectedDb}
                      onChange={(e) => {
                        setSelectedDb(e.target.value);
                        const nd = databases.find((d) => d.id === e.target.value);
                        if (nd) setSelectedSchema(nd.schemas[0]?.name ?? "public");
                      }}
                      className="border-input bg-background h-8 w-full rounded-md border px-2 pr-6 text-xs font-medium"
                    >
                      {databases.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} · {d.type}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2" />
                  </div>
                </label>
                <label className="space-y-1">
                  <span className="text-muted-foreground text-[11px] font-semibold tracking-widest uppercase">
                    Schema
                  </span>
                  <div className="relative">
                    <select
                      value={selectedSchema}
                      onChange={(e) => setSelectedSchema(e.target.value)}
                      className="border-input bg-background h-8 w-full rounded-md border px-2 pr-6 text-xs font-medium"
                    >
                      {db.schemas.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2" />
                  </div>
                </label>
              </div>

              <div className="relative mt-3">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
                <Input
                  placeholder="Search tables or columns…"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="h-7 pl-7 text-xs"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              <p className="text-muted-foreground px-1 py-1 text-[11px] font-semibold tracking-widest uppercase">
                Tables · {filteredTables.length}
              </p>
              <ul className="space-y-1">
                {filteredTables.map((t) => {
                  const isOpen = expanded.has(t.name);
                  return (
                    <li key={t.name} className="rounded-md border border-transparent">
                      <button
                        onClick={() =>
                          setExpanded((prev) => {
                            const n = new Set(prev);
                            if (n.has(t.name)) n.delete(t.name);
                            else n.add(t.name);
                            return n;
                          })
                        }
                        className="hover:bg-sidebar-accent flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3 w-3 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3 w-3 shrink-0" />
                        )}
                        <Table2 className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs font-medium">{t.name}</span>
                        <span className="text-muted-foreground ml-auto text-[11px]">
                          {t.rowCount?.toLocaleString()}
                        </span>
                      </button>
                      {isOpen && (
                        <ul className="border-border ml-6 border-l pl-3">
                          {t.columns.map((c) => (
                            <li key={c.name} className="flex items-center gap-2 py-0.5">
                              <span className="font-mono text-[11px] tracking-tight">{c.name}</span>
                              <span className="text-muted-foreground font-mono text-[10px]">
                                {c.type}
                              </span>
                              <button
                                onClick={async () => {
                                  // insert column name at cursor — simple append for placeholder
                                  updateActive({
                                    sql: activeTab
                                      ? `${activeTab.sql.trimEnd()} ${c.name}`
                                      : c.name,
                                  });
                                }}
                                className="text-muted-foreground hover:text-foreground ml-auto text-[11px]"
                                title="Insert column"
                              >
                                +
                              </button>
                            </li>
                          ))}
                          <li className="pt-1">
                            <button
                              onClick={() => {
                                const snippet = `SELECT * FROM ${t.name} LIMIT 100;`;
                                updateActive({ sql: snippet, title: t.name });
                              }}
                              className="text-muted-foreground hover:text-foreground text-[11px] underline-offset-2 hover:underline"
                            >
                              Preview → SELECT * FROM {t.name}
                            </button>
                          </li>
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
              {filteredTables.length === 0 && (
                <p className="text-muted-foreground px-2 py-6 text-center text-xs">
                  No tables match “{tableSearch}”.
                </p>
              )}
            </div>

            <div className="border-border bg-muted/40 border-t p-2 text-[11px] leading-relaxed">
              <p className="font-medium">Mock tree — no live connection</p>
              <p className="text-muted-foreground">
                This tree is seeded in{" "}
                <code className="bg-background rounded border px-1">src/data/sqllab.ts</code>. Swap
                for <code className="bg-background rounded border px-1">/api/sqllab/databases</code>{" "}
                when a DB gateway exists.
              </p>
            </div>
          </aside>

          {/* Center + bottom */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Tabs */}
            <div className="border-border bg-card flex items-center gap-1 overflow-x-auto border-b px-2 py-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveId(t.id)}
                  className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap ${
                    t.id === activeId
                      ? "border-input bg-background shadow-sm"
                      : "text-muted-foreground hover:bg-accent border-transparent"
                  }`}
                >
                  <span className="max-w-[14ch] truncate">{t.title}</span>
                  {t.running && (
                    <span className="bg-warning h-1.5 w-1.5 animate-pulse rounded-full" />
                  )}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(t.id);
                    }}
                    className="hover:bg-muted ml-1 grid h-4 w-4 place-items-center rounded"
                    role="button"
                    aria-label="Close tab"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </button>
              ))}
              <button
                onClick={addTab}
                className="border-border bg-background ml-1 grid h-7 w-7 place-items-center rounded-md border"
                aria-label="New tab"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <div className="text-muted-foreground ml-auto hidden items-center gap-2 text-xs whitespace-nowrap lg:flex">
                <span className="font-mono text-[11px]">
                  {activeTab?.databaseId}.{activeTab?.schemaName}
                </span>
                <span className="bg-border h-3 w-px" />
                <span>Limit</span>
                <Input
                  type="number"
                  value={activeTab?.limit ?? 100}
                  onChange={(e) =>
                    updateActive({
                      limit: Math.max(1, Math.min(1000, Number(e.target.value) || 100)),
                    })
                  }
                  className="h-7 w-[72px] font-mono text-xs"
                />
              </div>
            </div>

            {/* Editor — textarea + gutter + highlight preview */}
            <div className="border-editor bg-editor flex flex-col border-b">
              <div className="flex items-center gap-2 border-b border-[var(--editor-border)] bg-[var(--editor-gutter)] px-3 py-2">
                <span className="font-mono text-[11px] tracking-wide text-[var(--editor-gutter-foreground)]">
                  SQL Editor
                </span>
                <span className="text-muted-foreground hidden text-xs sm:inline">
                  — JetBrains Mono ·{" "}
                  <code className="bg-background rounded border px-1">--editor</code> tokens
                </span>
                <div className="ml-auto flex items-center gap-2">
                  {activeTab?.running ? (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={stopQuery}>
                      <Square className="mr-1 h-3 w-3 fill-current" />
                      Stop
                    </Button>
                  ) : (
                    <Button size="sm" className="h-7 text-xs" onClick={runQuery}>
                      <Play className="mr-1 h-3 w-3 fill-current" />
                      Run
                    </Button>
                  )}
                  <span className="font-mono text-xs text-[var(--editor-gutter-foreground)]">
                    {activeTab?.elapsedMs != null
                      ? `${(activeTab.elapsedMs / 1000).toFixed(2)}s`
                      : "—"}
                  </span>
                </div>
              </div>

              <div className="flex min-h-[220px]">
                {/* Gutter */}
                <div
                  className="hidden border-r border-[var(--editor-border)] bg-[var(--editor-gutter)] px-2 py-3 text-right font-mono text-[11px] leading-6 select-none sm:block"
                  style={{ color: "var(--editor-gutter-foreground)" }}
                >
                  {Array.from({ length: Math.max(8, lineCount) }).map((_, i) => (
                    <div
                      key={i}
                      className={i + 1 === lineCount ? "text-foreground font-medium" : ""}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>

                {/* Editable */}
                <div className="relative min-w-0 flex-1">
                  <textarea
                    value={activeTab?.sql ?? ""}
                    onChange={(e) => updateActive({ sql: e.target.value })}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        runQuery();
                      }
                    }}
                    spellCheck={false}
                    placeholder="SELECT * FROM orders LIMIT 100;"
                    className="placeholder:text-muted-foreground absolute inset-0 h-full w-full resize-none bg-transparent p-3 font-mono text-[13px] leading-6 whitespace-pre text-[var(--editor-foreground)] focus:outline-none"
                    style={{
                      fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
                    }}
                  />
                  {/* Highlight preview — shown when textarea is not focused for readability */}
                  <div className="pointer-events-none absolute inset-0 p-3 font-mono text-[13px] leading-6 whitespace-pre-wrap opacity-0">
                    {activeTab &&
                      highlightSql(activeTab.sql).map((p, i) => (
                        <span
                          key={i}
                          className={p.keyword ? "font-semibold text-[var(--chart-2)]" : ""}
                        >
                          {p.text}
                        </span>
                      ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-[var(--editor-border)] bg-[var(--editor-gutter)] px-3 py-2">
                <span className="text-muted-foreground text-xs">⌘+Enter to run</span>
                <button
                  onClick={copySql}
                  className="text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-1 text-xs"
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </button>
                <button
                  onClick={() =>
                    updateActive({
                      sql: activeTab
                        ? activeTab.sql.replace(
                            /\s+LIMIT\s+\d+\s*;?\s*$/i,
                            ` LIMIT ${activeTab.limit};`,
                          )
                        : "",
                    })
                  }
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
                >
                  Format limit
                </button>
                <span className="bg-border h-3 w-px" />
                <span className="font-mono text-[11px] text-[var(--editor-gutter-foreground)]">
                  No editor dep — textarea + line gutter (see token audit)
                </span>
              </div>
            </div>

            {/* Bottom tabs */}
            <div className="bg-card flex flex-col">
              <div className="border-border flex items-center gap-1 border-b px-2">
                {(
                  [
                    {
                      id: "results",
                      label: "Results",
                      icon: Table2,
                      count: activeTab?.result?.rowCount,
                    },
                    { id: "history", label: "History", icon: History, count: history.length },
                    {
                      id: "saved",
                      label: "Saved Queries",
                      icon: Bookmark,
                      count: savedQueries.length,
                    },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setBottomTab(t.id)}
                    className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium ${
                      bottomTab === t.id
                        ? "border-primary text-foreground"
                        : "text-muted-foreground hover:text-foreground border-transparent"
                    }`}
                  >
                    <t.icon className="h-3.5 w-3.5" />
                    {t.label}
                    {t.count != null && (
                      <span className="bg-muted rounded-full px-1.5 py-0.5 text-[11px]">
                        {t.count}
                      </span>
                    )}
                  </button>
                ))}
                <div className="ml-auto hidden items-center gap-1 p-1 sm:flex">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={exportCsv}>
                    <Download className="mr-1 h-3 w-3" />
                    Export CSV
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={saveQuery}>
                    <Save className="mr-1 h-3 w-3" />
                    Save
                  </Button>
                </div>
              </div>

              {bottomTab === "results" && (
                <div className="min-h-[260px]">
                  {activeTab?.error ? (
                    <div className="border-destructive/30 bg-destructive/10 m-3 rounded-md border p-3">
                      <p className="text-destructive text-xs font-semibold">Query failed</p>
                      <pre className="mt-1 font-mono text-xs break-words whitespace-pre-wrap text-[var(--editor-foreground)]">
                        {activeTab.error}
                      </pre>
                      <p className="text-muted-foreground mt-2 text-xs">
                        This is a mock error — in production, diagnostics would offer a fix.
                        Placeholder for Phase 2 self-healing.
                      </p>
                    </div>
                  ) : activeTab?.result ? (
                    <div className="overflow-auto">
                      <div className="flex items-center gap-2 px-3 py-2 text-xs">
                        <span className="text-muted-foreground">
                          {activeTab.result.rowCount} rows · {activeTab.result.durationMs}ms ·{" "}
                          {activeTab.limit} limit
                        </span>
                        <span className="bg-border h-3 w-px" />
                        <button
                          onClick={copySql}
                          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        >
                          <Copy className="h-3 w-3" />
                          Copy SQL
                        </button>
                        <button
                          onClick={exportCsv}
                          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" />
                          CSV
                        </button>
                        <button
                          onClick={() =>
                            showToast("Visualize — opens Chart Explore (Phase 1 next)")
                          }
                          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        >
                          <FlaskConical className="h-3 w-3" />
                          Visualize
                        </button>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/40 text-muted-foreground border-y text-left">
                            {activeTab.result.columns.map((c) => (
                              <th
                                key={c}
                                className="px-3 py-2 font-mono text-[11px] font-medium tracking-wide"
                              >
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-border divide-y">
                          {activeTab.result.rows.map((row, i) => (
                            <tr key={i} className="hover:bg-muted/40 font-mono text-[12px]">
                              {activeTab.result!.columns.map((c) => (
                                <td key={c} className="px-3 py-1.5 whitespace-nowrap">
                                  {String(row[c])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : activeTab?.running ? (
                    <div className="text-muted-foreground flex items-center gap-2 px-4 py-10 text-sm">
                      <span className="bg-warning h-2 w-2 animate-pulse rounded-full" />
                      Running — {((activeTab.elapsedMs ?? 0) / 1000).toFixed(2)}s
                    </div>
                  ) : (
                    <div className="px-4 py-10 text-center">
                      <p className="text-sm font-medium">No results yet</p>
                      <p className="text-muted-foreground mx-auto mt-1 max-w-[42ch] text-sm leading-relaxed">
                        Write SQL above and press{" "}
                        <kbd className="bg-muted rounded border px-1 font-mono text-xs">Run</kbd> or{" "}
                        <kbd className="bg-muted rounded border px-1 font-mono text-xs">
                          ⌘+Enter
                        </kbd>
                        . Results will appear here, inspectable and exportable.
                      </p>
                      <div className="mt-4 flex justify-center gap-2">
                        <Button size="sm" onClick={runQuery}>
                          <Play className="mr-1 h-3 w-3" />
                          Run query
                        </Button>
                        <Button variant="outline" size="sm" onClick={copySql}>
                          Copy SQL
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {bottomTab === "history" && (
                <div className="overflow-auto">
                  <div className="flex items-center justify-between px-3 py-2">
                    <p className="text-muted-foreground text-xs">
                      Recent runs — newest first (full history is paginated)
                    </p>
                    <Link
                      to="/sqllab/history"
                      className="text-foreground inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
                    >
                      View all →
                    </Link>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 text-muted-foreground border-y text-left">
                        <th className="px-3 py-2">Time</th>
                        <th className="px-3 py-2">User</th>
                        <th className="hidden px-3 py-2 sm:table-cell">Database</th>
                        <th className="px-3 py-2">Rows</th>
                        <th className="hidden px-3 py-2 md:table-cell">Status</th>
                        <th className="px-3 py-2">SQL preview</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border divide-y">
                      {history.slice(0, 5).map((h) => (
                        <tr key={h.id} className="hover:bg-muted/40">
                          <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="h-3 w-3" />
                              {formatIso(h.time)}
                            </span>
                          </td>
                          <td className="px-3 py-2">{h.user}</td>
                          <td className="hidden px-3 py-2 sm:table-cell">
                            <span className="font-mono text-[11px]">
                              {h.database}.{h.schema}
                            </span>
                          </td>
                          <td className="px-3 py-2">{h.rows}</td>
                          <td className="hidden px-3 py-2 md:table-cell">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${h.status === "success" ? "bg-success text-success-foreground" : h.status === "error" ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground"}`}
                            >
                              {h.status}
                            </span>
                          </td>
                          <td className="max-w-[36ch] truncate px-3 py-2 font-mono text-[11px]">
                            {h.sql}
                          </td>
                        </tr>
                      ))}
                      {history.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="text-muted-foreground px-4 py-8 text-center text-xs"
                          >
                            No history yet — run a query to see it here.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {history.length > 5 && (
                    <div className="border-border border-t px-3 py-2 text-center">
                      <Link
                        to="/sqllab/history"
                        className="text-xs font-medium underline-offset-2 hover:underline"
                      >
                        View all {history.length} runs →
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {bottomTab === "saved" && (
                <div className="overflow-auto">
                  <div className="flex items-center justify-between px-3 py-2">
                    <p className="text-muted-foreground text-xs">Recent saves — newest first</p>
                    <Link
                      to="/savedquerylist/list"
                      className="text-foreground inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
                    >
                      View all →
                    </Link>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 text-muted-foreground border-y text-left">
                        <th className="px-3 py-2">Name</th>
                        <th className="hidden px-3 py-2 sm:table-cell">Database</th>
                        <th className="hidden px-3 py-2 md:table-cell">Saved by</th>
                        <th className="px-3 py-2">Modified</th>
                        <th className="w-10 px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-border divide-y">
                      {savedQueries.slice(0, 5).map((sq) => (
                        <tr key={sq.id} className="hover:bg-muted/40">
                          <td className="px-3 py-2">
                            <button
                              onClick={() => openSaved(sq)}
                              className="text-left font-medium hover:underline"
                            >
                              {sq.name}
                            </button>
                            <div className="text-muted-foreground max-w-[36ch] truncate font-mono text-[11px]">
                              {sq.sql}
                            </div>
                          </td>
                          <td className="hidden px-3 py-2 sm:table-cell">
                            <span className="font-mono text-[11px]">
                              {sq.database}.{sq.schema}
                            </span>
                          </td>
                          <td className="hidden px-3 py-2 md:table-cell">{sq.savedBy}</td>
                          <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                            {formatIso(sq.modified)}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() =>
                                setSavedQueries((p) => p.filter((q) => q.id !== sq.id))
                              }
                              className="text-muted-foreground hover:text-destructive grid h-6 w-6 place-items-center rounded"
                              aria-label="Delete saved query"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {savedQueries.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="text-muted-foreground px-4 py-10 text-center text-xs"
                          >
                            No saved queries yet — run SQL and hit Save.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {savedQueries.length > 5 && (
                    <div className="border-border border-t px-3 py-2 text-center">
                      <Link
                        to="/savedquerylist/list"
                        className="text-xs font-medium underline-offset-2 hover:underline"
                      >
                        View all {savedQueries.length} queries →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            <p className="text-muted-foreground border-border border-t px-4 py-2 text-xs leading-relaxed">
              Data layer: <code className="bg-muted rounded px-1 py-0.5">src/data/sqllab.ts</code> +{" "}
              <code className="bg-muted rounded px-1 py-0.5">
                routes/api/sqllab/databases/index.get.ts
              </code>{" "}
              / <code className="bg-muted rounded px-1 py-0.5">/execute.post.ts</code> — in-memory
              mock tree + seeded result sets. Swap for a DB gateway when a real connection exists.
            </p>
          </div>
        </div>
      </div>

      {toast && (
        <div className="border-border bg-card fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border px-3 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </AppShell>
  );
}
