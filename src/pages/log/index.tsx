import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clock3,
  Search,
  X,
} from "lucide-react";
import { Link } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, fetchList as apiFetchList } from "@/lib/api";

type Row = {
  id: number;
  timestamp: string;
  user: string;
  userId: number | null;
  action: string;
  objectType: string;
  objectId: number | null;
  dashboardId: number | null;
  chartId: number | null;
};

function fmt(iso: string) {
  const d = new Date(iso);
  const abs =
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) +
    " " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const rel =
    mins < 1
      ? "just now"
      : mins < 60
        ? `${mins}m ago`
        : mins < 1440
          ? `${Math.floor(mins / 60)}h ago`
          : `${Math.floor(mins / 1440)}d ago`;
  return { abs, rel };
}

const ACTION_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  create: "default",
  edit: "secondary",
  view: "outline",
  delete: "destructive",
};

export default function LogPage() {
  const [q, setQ] = useState("");
  const [action, setAction] = useState("all");
  const [object, setObject] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortBy, setSortBy] = useState("time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2200);
  };

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetchList<Row>("/api/log", {
        q: q || undefined,
        action: action !== "all" ? action : undefined,
        object: object !== "all" ? object : undefined,
        from: from || undefined,
        to: to || undefined,
        sortBy,
        sortDir,
        page,
        pageSize,
      });
      setRows(res.data);
      setTotal(res.total);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "We couldn't load the action log. Try refreshing.";
      setError(msg);
      showToast(msg);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void fetchList();
  }, [q, action, object, from, to, sortBy, sortDir, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AppShell>
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="bg-muted text-muted-foreground grid h-7 w-7 place-items-center rounded-md">
                <Clock3 className="h-4 w-4" />
              </div>
              <h1 className="text-[22px] font-semibold tracking-tight">Action Log</h1>
              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                {total}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 max-w-[60ch] text-sm leading-relaxed">
              Audit trail of user actions. Read-only — entries are written by the platform when
              dashboards, charts and datasets change.
            </p>
          </div>
        </div>

        <div className="border-border bg-card mt-6 rounded-lg border">
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-[360px]">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search user, action, object…"
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
                  value={action}
                  onChange={(e) => {
                    setAction(e.target.value);
                    setPage(1);
                  }}
                  className="border-input bg-background h-8 rounded-md border px-2 pr-6 text-xs font-medium"
                >
                  <option value="all">All actions</option>
                  <option value="create">create</option>
                  <option value="edit">edit</option>
                  <option value="view">view</option>
                  <option value="delete">delete</option>
                </select>
                <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2" />
              </div>
              <div className="relative">
                <select
                  value={object}
                  onChange={(e) => {
                    setObject(e.target.value);
                    setPage(1);
                  }}
                  className="border-input bg-background h-8 rounded-md border px-2 pr-6 text-xs font-medium"
                >
                  <option value="all">All objects</option>
                  <option value="dashboard">dashboard</option>
                  <option value="chart">chart</option>
                  <option value="dataset">dataset</option>
                  <option value="database">database</option>
                </select>
                <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2" />
              </div>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="border-input bg-background h-8 rounded-md border px-2 pr-6 text-xs font-medium"
                >
                  <option value="time">Sort: Time</option>
                  <option value="user">Sort: User</option>
                  <option value="action">Sort: Action</option>
                </select>
                <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2" />
              </div>
              <button
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="border-input bg-background text-muted-foreground grid h-8 w-8 place-items-center rounded-md border"
              >
                <ChevronsUpDown className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="border-border flex flex-wrap items-center gap-2 border-t px-3 py-2">
            <label className="flex items-center gap-1.5 text-xs">
              From{" "}
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
                className="border-input bg-background rounded-md border px-2 py-1 text-xs"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              To{" "}
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
                className="border-input bg-background rounded-md border px-2 py-1 text-xs"
              />
            </label>
            <span className="text-muted-foreground hidden text-xs sm:inline">
              {loading ? "Loading…" : `${total} entries`}
            </span>
            {(q || action !== "all" || object !== "all" || from || to) && (
              <button
                onClick={() => {
                  setQ("");
                  setAction("all");
                  setObject("all");
                  setFrom("");
                  setTo("");
                  setPage(1);
                }}
                className="border-input bg-background ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="border-destructive/30 bg-destructive/10 text-destructive mt-4 rounded-md border px-3 py-2 text-xs">
            {error}
          </div>
        )}

        <div className="border-border bg-card mt-4 overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border bg-muted/40 text-muted-foreground border-b text-left text-xs font-medium tracking-wide">
                  <th className="px-3 py-2.5">Time</th>
                  <th className="px-2 py-2.5">User</th>
                  <th className="px-2 py-2.5">Action</th>
                  <th className="px-2 py-2.5">Object</th>
                  <th className="hidden px-2 py-2.5 sm:table-cell">ID</th>
                  <th className="hidden px-2 py-2.5 lg:table-cell">Dashboard</th>
                  <th className="hidden px-2 py-2.5 lg:table-cell">Chart</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-3 py-3">
                        <span className="bg-muted block h-3 w-24 rounded" />
                      </td>
                      <td className="px-2 py-3">
                        <span className="bg-muted block h-3 w-16 rounded" />
                      </td>
                      <td colSpan={5} className="px-2 py-3">
                        <span className="bg-muted block h-3 w-20 rounded" />
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="mx-auto max-w-sm">
                        <p className="text-sm font-medium">No log entries match your filters</p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          Actions will appear here as users work.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const { abs, rel } = fmt(r.timestamp);
                    return (
                      <tr key={r.id} className="hover:bg-muted/40">
                        <td className="px-3 py-3">
                          <span className="text-xs font-medium">{rel}</span>
                          <div className="text-muted-foreground text-[11px]">{abs}</div>
                        </td>
                        <td className="px-2 py-2.5">
                          <span className="text-xs">{r.user}</span>
                        </td>
                        <td className="px-2 py-2.5">
                          <Badge
                            variant={ACTION_VARIANT[r.action] ?? "outline"}
                            className="text-[11px] capitalize"
                          >
                            {r.action}
                          </Badge>
                        </td>
                        <td className="px-2 py-2.5">
                          <Badge variant="secondary" className="text-[11px]">
                            {r.objectType}
                          </Badge>
                        </td>
                        <td className="hidden px-2 py-2.5 sm:table-cell">
                          <span className="font-mono text-xs">{r.objectId ?? "—"}</span>
                        </td>
                        <td className="hidden px-2 py-2.5 lg:table-cell">
                          {r.dashboardId ? (
                            <Link
                              to={`/dashboard/${r.dashboardId}`}
                              className="text-primary text-xs hover:underline"
                            >
                              #{r.dashboardId}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="hidden px-2 py-2.5 lg:table-cell">
                          {r.chartId ? (
                            <Link
                              to={`/chart/${r.chartId}`}
                              className="text-primary text-xs hover:underline"
                            >
                              #{r.chartId}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
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
        <p className="text-muted-foreground mt-3 text-xs">
          Read-only via <code className="bg-muted rounded px-1 py-0.5">/api/log</code>. Write via{" "}
          <code className="bg-muted rounded px-1 py-0.5">src/db/log.ts → logAction()</code> — not
          wired to every handler yet.
        </p>
      </div>
      {toast && (
        <div className="border-border bg-card fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border px-3 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </AppShell>
  );
}
