import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Pencil,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";

import { fetchList as apiFetchList, ApiError, mutate } from "@/lib/api";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { AlertReportEditor } from "@/components/editors/AlertReportEditor";

type AlertRow = {
  id: number;
  name: string;
  type: string;
  trigger: string;
  schedule: string;
  timezone: string;
  lastRun: string | null;
  status: string;
  active: boolean;
  validationType: string | null;
  threshold: string | null;
  sqlQuery: string | null;
  deliveryType: string;
  recipients: string[];
  message: string | null;
  logRetentionDays: number;
  modifiedAt: string;
  createdAt: string;
};

function humanCron(s: string) {
  if (s === "0 9 * * MON") return "Mon 9am";
  if (s === "0 8 * * *") return "Daily 8am";
  if (s === "0 7 * * FRI") return "Fri 7am";
  if (s === "0 */6 * * *") return "Every 6h";
  if (s === "*/30 * * * *") return "Every 30m";
  return s;
}
function fmt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) +
    " " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
}
const STATUS_VARIANT: Record<string, "success" | "warning" | "muted" | "destructive"> = {
  active: "success",
  paused: "warning",
  error: "destructive",
};

export default function AlertListPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [active, setActive] = useState("all");
  const [sortBy, setSortBy] = useState("modified");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2200);
  };

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AlertRow | null>(null);
  const [confirmRow, setConfirmRow] = useState<AlertRow | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetchList<AlertRow>("/api/alerts", {
        q: q || undefined,
        status: status !== "all" ? status : undefined,
        active: active !== "all" ? (active === "enabled" ? "true" : "false") : undefined,
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
            : "We couldn't load alerts. Try refreshing.";
      setError(msg);
      showToast(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [q, status, active, sortBy, sortDir, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const handleDelete = async (row: AlertRow) => {
    try {
      await mutate(`/api/alerts/${row.id}`, "DELETE");
      showToast("Alert deleted");
      fetchList();
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not delete. Try again.";
      showToast(msg);
    }
  };
  const handleToggle = async (row: AlertRow) => {
    await fetch(`/api/alerts/${row.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !row.active }),
    });
    fetchList();
  };
  const handleBulkDelete = async () => {
    const ids = [...selected];
    let ok = 0;
    let fail = 0;
    let lastErr = "";
    for (const id of ids) {
      try {
        await mutate(`/api/alerts/${id}`, "DELETE");
        ok++;
      } catch (e) {
        fail++;
        lastErr = e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
      }
    }
    if (ok && !fail) showToast(`Deleted ${ok} alerts`);
    else if (ok && fail)
      showToast(`Deleted ${ok} of ${ok + fail} alerts. ${fail} failed: ${lastErr}`);
    else if (!ok && fail) showToast(lastErr || "Could not delete. Try again.");
    setSelected(new Set());
    fetchList();
  };
  const handleTest = async (rowOrPayload: Record<string, unknown>) => {
    const id = (rowOrPayload as { id?: number }).id;
    if (id) {
      try {
        const res = await fetch(`/api/alerts/${id}/test`, { method: "POST" });
        const j = (await res.json()) as { message?: string };
        showToast(
          j.message ??
            "Alert logic validated. Delivery is not configured for this placeholder phase.",
        );
      } catch {
        showToast("Test did not work. Try again.");
      }
      return;
    }
    const n = Array.isArray(rowOrPayload.recipients)
      ? (rowOrPayload.recipients as string[]).length
      : String(rowOrPayload.recipients ?? "")
          .split(",")
          .filter(Boolean).length;
    showToast(
      `Test alert sent to ${n || 1} recipient${n === 1 ? "" : "s"}. Delivery is not configured for this placeholder phase.`,
    );
  };
  const handleSave = async (payload: Record<string, unknown>) => {
    if (editing) {
      const r = await fetch(`/api/alerts/${editing.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = (await r.json()) as { error?: string };
        showToast(j.error ?? "Could not save. Try again.");
        return;
      }
      showToast(`Alert "${String(payload.name)}" saved`);
    } else {
      const r = await fetch("/api/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = (await r.json()) as { error?: string };
        showToast(j.error ?? "Could not create it. Try again.");
        return;
      }
      showToast(`Alert "${String(payload.name)}" created`);
      setPage(1);
    }
    fetchList();
  };

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (row: AlertRow) => {
    setEditing(row);
    setEditorOpen(true);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="bg-muted text-muted-foreground grid h-7 w-7 place-items-center rounded-md">
                <Bell className="h-4 w-4" />
              </div>
              <h1 className="text-[22px] font-semibold tracking-tight">Alerts</h1>
              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                {total}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 max-w-[60ch] text-sm leading-relaxed">
              SQL checks that notify when a threshold is crossed. Runs on cron; delivery via email,
              Slack, or webhook.
            </p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Bell className="mr-1.5 h-3.5 w-3.5" /> Add alert
          </Button>
        </div>

        <div className="border-border bg-card mt-6 rounded-lg border">
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-[360px]">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search by name…"
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
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                  className="border-input bg-background h-8 rounded-md border px-2 pr-6 text-xs font-medium"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="error">Error</option>
                </select>
                <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2" />
              </div>
              <div className="relative">
                <select
                  value={active}
                  onChange={(e) => {
                    setActive(e.target.value);
                    setPage(1);
                  }}
                  className="border-input bg-background h-8 rounded-md border px-2 pr-6 text-xs font-medium"
                >
                  <option value="all">All</option>
                  <option value="enabled">Enabled</option>
                  <option value="paused">Paused</option>
                </select>
                <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2" />
              </div>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="border-input bg-background h-8 rounded-md border px-2 pr-6 text-xs font-medium"
                >
                  <option value="modified">Sort: Modified</option>
                  <option value="name">Sort: Name</option>
                  <option value="schedule">Sort: Schedule</option>
                  <option value="status">Sort: Status</option>
                </select>
                <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2" />
              </div>
              <button
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="border-input bg-background text-muted-foreground hover:text-foreground grid h-8 w-8 place-items-center rounded-md border"
                aria-label="Toggle sort"
              >
                <ChevronsUpDown className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="border-border flex flex-wrap items-center gap-2 border-t px-3 py-2">
            <span className="text-muted-foreground hidden text-xs sm:inline">
              Cron like <code className="bg-muted rounded px-1">0 9 * * MON</code> = Every Monday at
              9am
            </span>
            <div className="ml-auto flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                {loading ? "Loading…" : `${total} alerts`}
              </span>
              {(q || status !== "all" || active !== "all") && (
                <button
                  onClick={() => {
                    setQ("");
                    setStatus("all");
                    setActive("all");
                    setPage(1);
                  }}
                  className="border-input bg-background hover:bg-accent inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
          </div>
          {selected.size > 0 && (
            <div className="border-border bg-muted/50 flex items-center gap-2 border-t px-3 py-2">
              <span className="text-xs font-medium">{selected.size} selected</span>
              <span className="bg-border h-4 w-px" />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setConfirmBulk(true)}
              >
                <Trash2 className="mr-1 h-3 w-3" /> Delete
              </Button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-muted-foreground hover:text-foreground ml-auto text-xs font-medium"
              >
                Clear
              </button>
            </div>
          )}
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
                  <th className="w-8 px-3 py-2.5">
                    <Checkbox
                      checked={allOnPageSelected}
                      indeterminate={!allOnPageSelected && rows.some((r) => selected.has(r.id))}
                      onChange={(e) => {
                        const c = (e.target as HTMLInputElement).checked;
                        setSelected((prev) => {
                          const n = new Set(prev);
                          rows.forEach((r) => {
                            if (c) n.add(r.id);
                            else n.delete(r.id);
                          });
                          return n;
                        });
                      }}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-2 py-2.5">Name</th>
                  <th className="hidden px-2 py-2.5 sm:table-cell">Type</th>
                  <th className="hidden px-2 py-2.5 lg:table-cell">Trigger</th>
                  <th className="hidden px-2 py-2.5 xl:table-cell">Schedule</th>
                  <th className="hidden px-2 py-2.5 lg:table-cell">Last run</th>
                  <th className="px-2 py-2.5">Status</th>
                  <th className="px-2 py-2.5">Active</th>
                  <th className="w-10 px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-3 py-3">
                        <span className="bg-muted block h-3 w-3 rounded" />
                      </td>
                      <td className="px-2 py-3">
                        <span className="bg-muted block h-3 w-32 rounded" />
                      </td>
                      <td colSpan={7} className="px-2 py-3">
                        <span className="bg-muted block h-3 w-24 rounded" />
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center">
                      <div className="mx-auto max-w-sm">
                        <p className="text-sm font-medium">No alerts match your filters</p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          Create one to get notified when a SQL condition is met.
                        </p>
                        <div className="mt-4 flex justify-center">
                          <Button size="sm" onClick={openCreate}>
                            Add alert
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr
                      key={r.id}
                      className={`group hover:bg-muted/40 ${selected.has(r.id) ? "bg-muted/60" : ""}`}
                    >
                      <td className="px-3 py-3">
                        <Checkbox
                          checked={selected.has(r.id)}
                          onChange={(e) => {
                            const c = (e.target as HTMLInputElement).checked;
                            setSelected((prev) => {
                              const n = new Set(prev);
                              if (c) n.add(r.id);
                              else n.delete(r.id);
                              return n;
                            });
                          }}
                          aria-label={`Select ${r.name}`}
                        />
                      </td>
                      <td className="px-2 py-3">
                        <button
                          onClick={() => openEdit(r)}
                          className="text-left text-sm font-medium hover:underline"
                        >
                          {r.name}
                        </button>
                        <div className="text-muted-foreground hidden max-w-[28ch] truncate text-[11px] sm:block">
                          {r.sqlQuery ?? "—"}
                        </div>
                      </td>
                      <td className="hidden px-2 py-2.5 sm:table-cell">
                        <Badge variant="secondary" className="text-[11px]">
                          {r.type}
                        </Badge>
                      </td>
                      <td className="hidden px-2 py-2.5 lg:table-cell">
                        <span className="text-xs">{r.trigger}</span>
                      </td>
                      <td className="hidden px-2 py-2.5 xl:table-cell">
                        <span
                          title={r.schedule}
                          className="bg-muted rounded px-1.5 py-0.5 font-mono text-[11px]"
                        >
                          {humanCron(r.schedule)}
                        </span>
                        <span className="text-muted-foreground ml-1 text-[11px]">{r.timezone}</span>
                      </td>
                      <td className="hidden px-2 py-2.5 lg:table-cell">
                        <span className="text-xs">{fmt(r.lastRun)}</span>
                      </td>
                      <td className="px-2 py-2.5">
                        <Badge
                          variant={STATUS_VARIANT[r.status] ?? "muted"}
                          className="text-[11px] capitalize"
                        >
                          {r.status}
                        </Badge>
                      </td>
                      <td className="px-2 py-2.5">
                        <label className="inline-flex cursor-pointer items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={r.active}
                            onChange={() => handleToggle(r)}
                            className="accent-primary h-3.5 w-3.5"
                          />
                          <span className="text-xs">{r.active ? "On" : "Off"}</span>
                        </label>
                      </td>
                      <td className="px-2 py-3">
                        <div
                          className="relative flex justify-end"
                          ref={openMenu === r.id ? menuRef : undefined}
                        >
                          <button
                            onClick={() => setOpenMenu((v) => (v === r.id ? null : r.id))}
                            className="text-muted-foreground hover:border-input hover:bg-accent hover:text-foreground grid h-7 w-7 place-items-center rounded-md border border-transparent"
                            aria-label="Actions"
                          >
                            <ChevronsUpDown className="h-4 w-4" />
                          </button>
                          {openMenu === r.id && (
                            <div className="border-border bg-popover absolute top-8 right-0 z-20 w-56 rounded-md border p-1 shadow-lg">
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  openEdit(r);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleToggle(r);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Bell className="h-3.5 w-3.5" /> {r.active ? "Pause" : "Enable"}
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleTest(r as unknown as Record<string, unknown>);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Send className="h-3.5 w-3.5" /> Test
                              </button>
                              <div className="bg-border my-1 h-px" />
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  setConfirmRow(r);
                                }}
                                className="text-destructive hover:bg-destructive hover:text-destructive-foreground flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </button>
                            </div>
                          )}
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
        <p className="text-muted-foreground mt-3 text-xs">
          Data via <code className="bg-muted rounded px-1 py-0.5">/api/alerts</code> — Postgres +
          Drizzle.
        </p>
      </div>
      <AlertReportEditor
        mode="alert"
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        initial={editing as unknown as Record<string, unknown>}
        onSave={handleSave}
        onTest={handleTest}
      />
      <ConfirmDialog
        open={!!confirmRow}
        onOpenChange={(o) => !o && setConfirmRow(null)}
        title={`Delete '${confirmRow?.name ?? ""}'?`}
        description={`Delete '${confirmRow?.name ?? ""}'? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (confirmRow) return handleDelete(confirmRow);
        }}
      />
      <ConfirmDialog
        open={confirmBulk}
        onOpenChange={setConfirmBulk}
        title={`Delete ${selected.size} alerts?`}
        description={`Delete ${selected.size} alerts? This cannot be undone.`}
        confirmLabel={`Delete ${selected.size}`}
        variant="destructive"
        onConfirm={handleBulkDelete}
      />
      {toast && (
        <div className="border-border bg-card fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border px-3 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </AppShell>
  );
}
