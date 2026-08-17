import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Copy,
  Eye,
  FlaskConical,
  History,
  Search,
  X,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { QueryHistoryEntry } from "@/types/sqllab";
import { fetchList as apiFetchList, ApiError } from "@/lib/api";
import type { DatabaseConnection } from "@/types/database";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function statusBadge(status: QueryHistoryEntry["status"]) {
  if (status === "success") return "bg-success text-success-foreground";
  if (status === "error") return "bg-destructive text-destructive-foreground";
  return "bg-warning text-warning-foreground";
}

export default function QueryHistoryPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [user, setUser] = useState("");
  const [database, setDatabase] = useState("all");
  const [status, setStatus] = useState<"all" | "success" | "error" | "running">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortBy, setSortBy] = useState<"time" | "database" | "rows">("time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [liveDbs, setLiveDbs] = useState<DatabaseConnection[]>([]);
  const [rows, setRows] = useState<QueryHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inspect, setInspect] = useState<QueryHistoryEntry | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetchList<QueryHistoryEntry>("/api/sqllab/history", {
          q: q || undefined,
          user: user || undefined,
          database: database !== "all" ? database : undefined,
          status: status !== "all" ? status : undefined,
          from: from ? new Date(from).toISOString() : undefined,
          to: to ? new Date(to).toISOString() : undefined,
          sortBy,
          sortDir,
          page,
          pageSize,
        });
        if (!cancelled) {
          setRows(res.data);
          setTotal(res.total);
        }
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Could not load Query history";
        setError(msg);
        showToast(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q, user, database, status, from, to, sortBy, sortDir, page, pageSize]);

  useEffect(() => {
    let cancelled = false;
    async function loadDbs() {
      try {
        const res = await apiFetchList<DatabaseConnection>("/api/databases", { page: 1, pageSize: 50 });
        if (!cancelled) setLiveDbs(res.data);
      } catch { if (!cancelled) setLiveDbs([]); }
    }
    void loadDbs();
    return () => { cancelled = true; };
  }, []);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const openInSqlLab = (h: QueryHistoryEntry) => {
    try {
      sessionStorage.setItem("metric:openHistoryEntry", JSON.stringify(h));
    } catch {
      /* ignore */
    }
    navigate(`/sqllab?history=${h.id}`);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="bg-muted text-muted-foreground grid h-7 w-7 place-items-center rounded-md">
                <History className="h-4 w-4" />
              </div>
              <h1 className="text-[22px] font-semibold tracking-tight">Query history</h1>
              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                {total}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 max-w-[60ch] text-sm leading-relaxed">
              Every execution — time, user, database, and the exact SQL. Same history the SQL Lab
              pane previews; full-page search and range stay shareable.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="border-border bg-card mt-6 rounded-lg border">
          <div className="flex flex-col gap-3 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 sm:max-w-[360px]">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search SQL, user, database, or error…"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 pl-8 text-sm"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <select
                    value={database}
                    onChange={(e) => {
                      setDatabase(e.target.value);
                      setPage(1);
                    }}
                    className="border-input bg-background h-8 rounded-md border px-2 pr-6 text-xs font-medium"
                  >
                    <option value="all">All databases</option>
                    {liveDbs.map((db) => (
                      <option key={db.id} value={db.id}>
                        {db.name} · {db.backend}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2" />
                </div>
                <div className="relative">
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value as typeof status);
                      setPage(1);
                    }}
                    className="border-input bg-background h-8 rounded-md border px-2 pr-6 text-xs font-medium"
                  >
                    <option value="all">All statuses</option>
                    <option value="success">Success</option>
                    <option value="error">Error</option>
                    <option value="running">Running</option>
                  </select>
                  <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2" />
                </div>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="border-input bg-background h-8 rounded-md border px-2 pr-6 text-xs font-medium"
                  >
                    <option value="time">Sort: Time</option>
                    <option value="database">Sort: Database</option>
                    <option value="rows">Sort: Rows</option>
                  </select>
                  <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2" />
                </div>
                <button
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                  className="border-input bg-background text-muted-foreground hover:text-foreground grid h-8 w-8 place-items-center rounded-md border"
                  aria-label="Toggle sort direction"
                >
                  <ChevronsUpDown className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Filter by user…"
                value={user}
                onChange={(e) => {
                  setUser(e.target.value);
                  setPage(1);
                }}
                className="h-7 w-[140px] text-xs"
              />
              <div className="flex items-center gap-1">
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPage(1);
                  }}
                  className="h-7 w-[140px] text-xs"
                />
                <span className="text-muted-foreground text-xs">—</span>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPage(1);
                  }}
                  className="h-7 w-[140px] text-xs"
                />
              </div>
              {(q || user || database !== "all" || status !== "all" || from || to) && (
                <button
                  onClick={() => {
                    setQ("");
                    setUser("");
                    setDatabase("all");
                    setStatus("all");
                    setFrom("");
                    setTo("");
                    setPage(1);
                  }}
                  className="border-input bg-background hover:bg-accent inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              )}
              <span className="text-muted-foreground ml-auto hidden text-xs sm:inline">
                {loading ? "Loading…" : `${total} runs`}
              </span>
            </div>
          </div>
          <div className="border-border flex flex-wrap items-center gap-2 border-t px-3 py-2">
            <Link
              to="/sqllab"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
            >
              <FlaskConical className="h-3 w-3" /> Back to SQL Lab
            </Link>
            <span className="bg-border hidden h-3 w-px sm:inline-block" />
            <Link
              to="/savedquerylist/list"
              className="text-muted-foreground hover:text-foreground hidden text-xs underline-offset-2 hover:underline sm:inline"
            >
              Saved queries →
            </Link>
          </div>
        </div>

        {error && (
          <div className="border-destructive/30 bg-destructive/10 text-destructive mt-4 rounded-md border px-3 py-2 text-xs">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="border-border bg-card mt-4 overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border bg-muted/40 text-muted-foreground border-b text-left text-xs font-medium tracking-wide">
                  <th className="px-2 py-2.5">
                    <button
                      onClick={() => {
                        if (sortBy === "time") setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        else {
                          setSortBy("time");
                          setSortDir("desc");
                        }
                      }}
                      className="hover:text-foreground inline-flex items-center gap-1"
                    >
                      Time
                      <ChevronsUpDown className="h-3 w-3 opacity-60" />
                    </button>
                  </th>
                  <th className="px-2 py-2.5">User</th>
                  <th className="hidden px-2 py-2.5 sm:table-cell">
                    <button
                      onClick={() => {
                        if (sortBy === "database")
                          setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        else {
                          setSortBy("database");
                          setSortDir("asc");
                        }
                      }}
                      className="hover:text-foreground inline-flex items-center gap-1"
                    >
                      Database
                      <ChevronsUpDown className="h-3 w-3 opacity-60" />
                    </button>
                  </th>
                  <th className="hidden px-2 py-2.5 md:table-cell">
                    <button
                      onClick={() => {
                        if (sortBy === "rows") setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        else {
                          setSortBy("rows");
                          setSortDir("desc");
                        }
                      }}
                      className="hover:text-foreground inline-flex items-center gap-1"
                    >
                      Rows
                      <ChevronsUpDown className="h-3 w-3 opacity-60" />
                    </button>
                  </th>
                  <th className="px-2 py-2.5">Status</th>
                  <th className="px-2 py-2.5">SQL preview</th>
                  <th className="w-10 px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-2 py-3">
                        <span className="bg-muted block h-3 w-24 rounded" />
                      </td>
                      <td className="px-2 py-3">
                        <span className="bg-muted block h-3 w-16 rounded" />
                      </td>
                      <td className="hidden px-2 py-3 sm:table-cell">
                        <span className="bg-muted block h-3 w-20 rounded" />
                      </td>
                      <td className="hidden px-2 py-3 md:table-cell">
                        <span className="bg-muted block h-3 w-8 rounded" />
                      </td>
                      <td className="px-2 py-3">
                        <span className="bg-muted block h-5 w-14 rounded-full" />
                      </td>
                      <td className="px-2 py-3">
                        <span className="bg-muted block h-3 w-40 rounded" />
                      </td>
                      <td className="px-2 py-3">
                        <span className="bg-muted block h-3 w-6 rounded" />
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="mx-auto max-w-sm">
                        <p className="text-sm font-medium">No history matches your filters</p>
                        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                          Widen the time range, clear status or database filters, or try a different
                          keyword.
                        </p>
                        <div className="mt-4 flex justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setQ("");
                              setUser("");
                              setDatabase("all");
                              setStatus("all");
                              setFrom("");
                              setTo("");
                              setPage(1);
                            }}
                          >
                            Clear filters
                          </Button>
                          <Button size="sm" onClick={() => navigate("/sqllab")}>
                            Go to SQL Lab
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((h) => (
                    <tr key={h.id} className="group hover:bg-muted/40">
                      <td className="text-muted-foreground px-2 py-3 text-xs whitespace-nowrap">
                        {formatTime(h.time)}
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="bg-secondary text-secondary-foreground grid h-6 w-6 place-items-center rounded-full text-[10px] font-medium">
                            {h.user
                              .split(" ")
                              .map((p) => p[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                          <span className="text-xs">{h.user}</span>
                        </span>
                      </td>
                      <td className="hidden px-2 py-2.5 sm:table-cell">
                        <span className="font-mono text-xs">
                          {h.database}.{h.schema}
                        </span>
                        <div className="text-muted-foreground text-[11px]">{h.durationMs}ms</div>
                      </td>
                      <td className="hidden px-2 py-2.5 md:table-cell">
                        <span className="text-xs font-medium">{h.rows}</span>
                      </td>
                      <td className="px-2 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge(h.status)}`}
                        >
                          {h.status}
                        </span>
                      </td>
                      <td
                        className="max-w-[36ch] truncate px-2 py-2.5 font-mono text-[11px]"
                        title={h.sql}
                      >
                        {h.sql}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openInSqlLab(h)}
                            className="text-muted-foreground hover:text-foreground hover:bg-accent hover:border-input grid h-7 w-7 place-items-center rounded-md border border-transparent"
                            title="Open in SQL Lab"
                          >
                            <FlaskConical className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setInspect(h)}
                            className="text-muted-foreground hover:text-foreground hover:bg-accent hover:border-input grid h-7 w-7 place-items-center rounded-md border border-transparent"
                            title="View full SQL"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="border-border bg-muted/20 flex flex-col items-center justify-between gap-3 border-t px-3 py-3 sm:flex-row">
            <p className="text-muted-foreground text-xs">
              {total === 0
                ? "No results"
                : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: Math.min(5, pageCount) }).map((_, i) => {
                let n: number;
                if (pageCount <= 5) n = i + 1;
                else if (page <= 3) n = i + 1;
                else if (page >= pageCount - 2) n = pageCount - 4 + i;
                else n = page - 2 + i;
                return (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`grid h-7 min-w-7 place-items-center rounded-md border px-2 text-xs font-medium ${n === page ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"}`}
                  >
                    {n}
                  </button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          Data layer: Postgres via <code className="bg-muted rounded px-1 py-0.5">/api/sqllab/history</code> (
          <code className="bg-muted rounded px-1 py-0.5">query_history</code> +{" "}
          <code className="bg-muted rounded px-1 py-0.5">/api/sqllab/execute</code> appends) — live, no mock.
        </p>
      </div>

      {inspect && (
        <div className="fixed inset-0 z-40 flex">
          <button
            aria-label="Close"
            onClick={() => setInspect(null)}
            className="bg-foreground/20 flex-1 backdrop-blur-sm"
          />
          <div className="bg-card border-border flex w-full max-w-[640px] flex-col border-l shadow-xl">
            <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
              <div>
                <h2 className="text-[16px] font-semibold tracking-tight">
                  Query #{inspect.id} · {inspect.status}
                </h2>
                <p className="text-muted-foreground mt-1 font-mono text-xs">
                  {inspect.database}.{inspect.schema} · {inspect.user} · {formatTime(inspect.time)}{" "}
                  · {inspect.rows} rows · {inspect.durationMs}ms
                </p>
                {inspect.error && (
                  <p className="bg-destructive/10 text-destructive border-destructive/30 mt-2 rounded border px-2 py-1 font-mono text-xs">
                    {inspect.error}
                  </p>
                )}
              </div>
              <button
                onClick={() => setInspect(null)}
                className="text-muted-foreground hover:bg-accent grid h-8 w-8 place-items-center rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              <p className="text-xs font-medium">Full SQL</p>
              <pre className="bg-muted/40 border-border mt-2 overflow-auto rounded-md border p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {inspect.sql}
              </pre>
              {inspect.error && (
                <div className="border-border bg-muted/30 mt-4 rounded-md border p-3">
                  <p className="text-xs font-medium">Error details</p>
                  <pre className="text-destructive mt-1 font-mono text-xs break-words whitespace-pre-wrap">
                    {inspect.error}
                  </pre>
                  <p className="text-muted-foreground mt-2 text-xs">
                    Placeholder — Phase 2 will offer a diagnosed fix inline instead of just this
                    message.
                  </p>
                </div>
              )}
            </div>
            <div className="border-border flex items-center gap-2 border-t px-5 py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(inspect.sql);
                  showToast("SQL copied");
                }}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy SQL
              </Button>
              <Button
                size="sm"
                className="ml-auto"
                onClick={() => {
                  const h = inspect;
                  setInspect(null);
                  openInSqlLab(h);
                }}
              >
                <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
                Open in SQL Lab
              </Button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="border-border bg-card fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border px-3 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </AppShell>
  );
}
