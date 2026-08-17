import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Copy,
  Download,
  FlaskConical,
  Pencil,
  Search,
  Trash2,
  X,
  Bookmark,
  Clock3,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { SavedQuery } from "@/types/sqllab";
import { fetchList } from "@/lib/api";
import type { DatabaseConnection } from "@/types/database";

type ApiResponse = { data: SavedQuery[]; total: number; page: number; pageSize: number };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function SavedQueriesListPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [database, setDatabase] = useState("all");
  const [sortBy, setSortBy] = useState<"modified" | "name" | "database">("modified");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [liveDbs, setLiveDbs] = useState<DatabaseConnection[]>([]);
  const [rows, setRows] = useState<SavedQuery[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<SavedQuery | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (database !== "all") params.set("database", database);
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    fetch(`/api/savedqueries?${params.toString()}`)
      .then((r) => r.json() as Promise<ApiResponse>)
      .then((res) => {
        if (cancelled) return;
        setRows(res.data);
        setTotal(res.total);
      })
      .catch(() => {
        if (!cancelled) showToast("Could not load saved queries");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, database, sortBy, sortDir, page, pageSize, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    async function loadDbs() {
      try {
        const res = await fetchList<DatabaseConnection>("/api/databases", { page: 1, pageSize: 50 });
        if (!cancelled) setLiveDbs(res.data);
      } catch { if (!cancelled) setLiveDbs([]); }
    }
    void loadDbs();
    return () => { cancelled = true; };
  }, []);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/savedqueries/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error((j as { statusMessage?: string })?.statusMessage ?? `Delete failed (${res.status})`);
      }
      showToast("Saved query deleted");
      setSelected((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      setReloadKey((k) => k + 1);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleExport = (sq: SavedQuery) => {
    const blob = new Blob([JSON.stringify(sq, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sq.name.replace(/[^a-z0-9]+/gi, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported "${sq.name}"`);
  };

  const handleOpen = (sq: SavedQuery) => {
    // deep-link into SQL Lab with the query preloaded — keep payload in sessionStorage so spec route stays bookmarkable
    try {
      sessionStorage.setItem("metric:openSavedQuery", JSON.stringify(sq));
    } catch {
      /* ignore */
    }
    navigate(`/sqllab?open=${sq.id}`);
  };

  const handleSaveEdit = async () => {
    if (!editing || !editing.name.trim()) {
      showToast("Name is required");
      return;
    }
    if (!editing.sql.trim()) {
      showToast("SQL is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/savedqueries/${editing.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: editing.name.trim(),
          database: editing.database,
          schema: editing.schema,
          sql: editing.sql,
          description: editing.description,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error((j as { statusMessage?: string })?.statusMessage ?? `Save failed (${res.status})`);
      }
      setEditing(null);
      setReloadKey((k) => k + 1);
      showToast(`Saved "${editing.name.trim()}"`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="bg-muted text-muted-foreground grid h-7 w-7 place-items-center rounded-md">
                <Bookmark className="h-4 w-4" />
              </div>
              <h1 className="text-[22px] font-semibold tracking-tight">Saved queries</h1>
              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                {total}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 max-w-[60ch] text-sm leading-relaxed">
              Reusable SQL — open in SQL Lab to run or edit. Same seed as SQL Lab's inline list;
              filters stay shareable in the URL.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => showToast("Import — drop a JSON export from another workspace")}
            >
              Import
            </Button>
            <Button size="sm" onClick={() => navigate("/sqllab")}>
              New in SQL Lab
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="border-border bg-card mt-6 rounded-lg border">
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-[360px]">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search name, database, author, or SQL…"
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
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="border-input bg-background h-8 rounded-md border px-2 pr-6 text-xs font-medium"
                >
                  <option value="modified">Sort: Modified</option>
                  <option value="name">Sort: Name</option>
                  <option value="database">Sort: Database</option>
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
          <div className="border-border flex flex-wrap items-center gap-2 border-t px-3 py-2">
            <Link
              to="/sqllab"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
            >
              <FlaskConical className="h-3 w-3" /> Back to SQL Lab
            </Link>
            <span className="bg-border hidden h-3 w-px sm:inline-block" />
            <span className="text-muted-foreground hidden text-xs sm:inline">
              Tip: search also matches SQL text.
            </span>
            <div className="ml-auto flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                {loading ? "Loading…" : `${total} queries`}
              </span>
              {(q || database !== "all") && (
                <button
                  onClick={() => {
                    setQ("");
                    setDatabase("all");
                    setPage(1);
                  }}
                  className="border-input bg-background hover:bg-accent inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium"
                >
                  <X className="h-3 w-3" />
                  Clear
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
                onClick={async () => {
                  const ids = [...selected];
                  let ok = 0;
                  for (const delId of ids) {
                    const res = await fetch(`/api/savedqueries/${delId}`, { method: "DELETE" });
                    if (res.ok) ok += 1;
                  }
                  setSelected(new Set());
                  setReloadKey((k) => k + 1);
                  showToast(ok ? `${ok} deleted` : "Delete failed");
                }}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Delete
              </Button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-muted-foreground hover:text-foreground ml-auto text-xs font-medium"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>

        {/* Table */}
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
                  <th className="px-2 py-2.5">
                    <button
                      onClick={() => {
                        if (sortBy === "name") setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        else {
                          setSortBy("name");
                          setSortDir("asc");
                        }
                      }}
                      className="hover:text-foreground inline-flex items-center gap-1"
                    >
                      Name
                      <ChevronsUpDown className="h-3 w-3 opacity-60" />
                    </button>
                  </th>
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
                  <th className="hidden px-2 py-2.5 lg:table-cell">Saved by</th>
                  <th className="hidden px-2 py-2.5 md:table-cell">
                    <button
                      onClick={() => {
                        if (sortBy === "modified")
                          setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        else {
                          setSortBy("modified");
                          setSortDir("desc");
                        }
                      }}
                      className="hover:text-foreground inline-flex items-center gap-1"
                    >
                      Modified
                      <ChevronsUpDown className="h-3 w-3 opacity-60" />
                    </button>
                  </th>
                  <th className="hidden px-2 py-2.5 xl:table-cell">Description</th>
                  <th className="w-10 px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-3 py-3">
                        <span className="bg-muted block h-3 w-3 rounded" />
                      </td>
                      <td className="px-2 py-3">
                        <span className="bg-muted block h-3 w-32 rounded" />
                      </td>
                      <td className="hidden px-2 py-3 sm:table-cell">
                        <span className="bg-muted block h-3 w-20 rounded" />
                      </td>
                      <td className="hidden px-2 py-3 lg:table-cell">
                        <span className="bg-muted block h-3 w-16 rounded" />
                      </td>
                      <td className="hidden px-2 py-3 md:table-cell">
                        <span className="bg-muted block h-3 w-20 rounded" />
                      </td>
                      <td className="hidden px-2 py-3 xl:table-cell">
                        <span className="bg-muted block h-3 w-24 rounded" />
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
                        <p className="text-sm font-medium">No saved queries match your filters</p>
                        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                          Try a broader search or switch database. Save from SQL Lab to add one.
                        </p>
                        <div className="mt-4 flex justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setQ("");
                              setDatabase("all");
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
                  rows.map((sq) => (
                    <tr
                      key={sq.id}
                      className={`group hover:bg-muted/40 ${selected.has(sq.id) ? "bg-muted/60" : ""}`}
                    >
                      <td className="px-3 py-3">
                        <Checkbox
                          checked={selected.has(sq.id)}
                          onChange={(e) => {
                            const c = (e.target as HTMLInputElement).checked;
                            setSelected((prev) => {
                              const n = new Set(prev);
                              if (c) n.add(sq.id);
                              else n.delete(sq.id);
                              return n;
                            });
                          }}
                          aria-label={`Select ${sq.name}`}
                        />
                      </td>
                      <td className="px-2 py-3">
                        <button
                          onClick={() => handleOpen(sq)}
                          className="text-left text-sm font-medium hover:underline"
                          title={sq.sql}
                        >
                          {sq.name}
                        </button>
                        <div
                          className="text-muted-foreground max-w-[34ch] truncate font-mono text-[11px]"
                          title={sq.sql}
                        >
                          {sq.sql}
                        </div>
                        <div className="mt-1 flex gap-1 sm:hidden">
                          <span className="bg-secondary text-secondary-foreground rounded-full px-1.5 py-0.5 font-mono text-[10px]">
                            {sq.database}.{sq.schema}
                          </span>
                          <span className="text-muted-foreground text-[11px]">{sq.savedBy}</span>
                        </div>
                      </td>
                      <td className="hidden px-2 py-2.5 sm:table-cell">
                        <span className="font-mono text-xs">
                          {sq.database}.{sq.schema}
                        </span>
                      </td>
                      <td className="hidden px-2 py-2.5 lg:table-cell">
                        <span className="bg-secondary text-secondary-foreground grid h-6 w-6 place-items-center rounded-full text-[10px] font-medium">
                          {sq.savedBy
                            .split(" ")
                            .map((p) => p[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                        <span className="ml-2 text-xs">{sq.savedBy}</span>
                      </td>
                      <td className="hidden px-2 py-2.5 md:table-cell">
                        <div className="text-xs">{formatDate(sq.modified)}</div>
                        <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
                          <Clock3 className="h-3 w-3" />
                          {formatDate(sq.modified)}
                        </div>
                      </td>
                      <td className="hidden px-2 py-2.5 xl:table-cell">
                        <span className="text-muted-foreground text-xs">
                          {sq.description ?? "—"}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <div
                          className="relative flex justify-end"
                          ref={openMenu === sq.id ? menuRef : undefined}
                        >
                          <button
                            onClick={() => setOpenMenu((v) => (v === sq.id ? null : sq.id))}
                            className="text-muted-foreground hover:border-input hover:bg-accent hover:text-foreground grid h-7 w-7 place-items-center rounded-md border border-transparent"
                            aria-label="Row actions"
                          >
                            <ChevronsUpDown className="h-4 w-4" />
                          </button>
                          {openMenu === sq.id && (
                            <div className="border-border bg-popover absolute top-8 right-0 z-20 w-56 rounded-md border p-1 shadow-lg">
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleOpen(sq);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <FlaskConical className="h-3.5 w-3.5" />
                                Open in SQL Lab
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  setEditing({ ...sq });
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleExport(sq);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Export
                              </button>
                              <button
                                onClick={async () => {
                                  setOpenMenu(null);
                                  await navigator.clipboard.writeText(sq.sql);
                                  showToast("SQL copied");
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Copy SQL
                              </button>
                              <div className="bg-border my-1 h-px" />
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleDelete(sq.id);
                                }}
                                className="text-destructive hover:bg-destructive hover:text-destructive-foreground flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
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
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          Data via <code className="bg-muted rounded px-1 py-0.5">/api/savedqueries</code> — Postgres + Drizzle. Mutations persisted.
        </p>
      </div>

      {editing && (
        <div className="fixed inset-0 z-40 flex">
          <button
            aria-label="Close editor"
            onClick={() => setEditing(null)}
            className="bg-foreground/20 flex-1 backdrop-blur-sm"
          />
          <div className="bg-card border-border flex w-full max-w-[560px] flex-col border-l shadow-xl">
            <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
              <div>
                <h2 className="text-[16px] font-semibold tracking-tight">Edit saved query</h2>
                <p className="text-muted-foreground mt-1 text-xs">
                  Name, database, and SQL — stays reviewable before running.
                </p>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="text-muted-foreground hover:bg-accent grid h-8 w-8 place-items-center rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <label className="space-y-1.5">
                <span className="text-xs font-medium">Name *</span>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Database</span>
                  <div className="relative">
                    <select
                      value={editing.database}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          database: e.target.value,
                          schema:
                            liveDbs.find((d) => d.id === e.target.value)?.schemas[0]?.name ??
                            editing.schema,
                        })
                      }
                      className="border-input bg-background h-9 w-full rounded-md border px-3 pr-8 text-sm"
                    >
                      {liveDbs.map((db) => (
                        <option key={db.id} value={db.id}>
                          {db.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2" />
                  </div>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Schema</span>
                  <div className="relative">
                    <select
                      value={editing.schema}
                      onChange={(e) => setEditing({ ...editing, schema: e.target.value })}
                      className="border-input bg-background h-9 w-full rounded-md border px-3 pr-8 text-sm"
                    >
                      {(liveDbs.find((d) => d.id === editing.database)?.schemas ?? []).map(
                        (s) => (
                          <option key={s.name} value={s.name}>
                            {s.name}
                          </option>
                        ),
                      )}
                    </select>
                    <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2" />
                  </div>
                </label>
              </div>
              <label className="space-y-1.5">
                <span className="text-xs font-medium">Description</span>
                <Input
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Optional — why this query exists"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium">SQL *</span>
                <textarea
                  value={editing.sql}
                  onChange={(e) => setEditing({ ...editing, sql: e.target.value })}
                  rows={8}
                  className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-xs"
                  style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
                />
              </label>
            </div>
            <div className="border-border flex items-center gap-2 border-t px-5 py-4">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button size="sm" className="ml-auto" onClick={handleSaveEdit} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
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
