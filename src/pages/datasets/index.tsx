import { useEffect, useRef, useState } from "react";

import {
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clock3,
  Columns3,
  Copy,
  Eye,
  FlaskConical,
  LayoutGrid,
  Pencil,
  RefreshCw,
  Search,
  Settings2,
  Table2,
  Trash2,
  X,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { fetchList } from "@/lib/api";
import type { DatabaseConnection } from "@/types/database";
import type { Dataset, DatasetColumn, DatasetMetric, DatasetType } from "@/types/dataset";

type ApiResponse = { data: Dataset[]; total: number; page: number; pageSize: number };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type EditorTab = "columns" | "metrics" | "data" | "settings";
const EDITOR_TABS: { id: EditorTab; label: string; icon: typeof Columns3 }[] = [
  { id: "columns", label: "Columns", icon: Columns3 },
  { id: "metrics", label: "Metrics", icon: Calculator },
  { id: "data", label: "Data", icon: Table2 },
  { id: "settings", label: "Settings", icon: Settings2 },
];

function emptyDataset(): Dataset {
  const now = new Date().toISOString();
  return {
    id: Date.now(),
    name: "",
    type: "physical",
    databaseId: "analytics",
    databaseName: "Analytics",
    backend: "Postgres",
    schema: "public",
    table: "orders",
    source: "Analytics.public.orders",
    mainDatetimeColumn: null,
    columns: [{ name: "id", type: "INTEGER", groupable: true, filterable: true }],
    metrics: [],
    createdBy: { id: 1, name: "Admin User" },
    modifiedBy: { id: 1, name: "Admin User" },
    modified: now,
    owners: [{ id: 1, name: "Admin User" }],
    description: "",
    defaultEndpoint: "",
    timeGrain: "P1D",
    cacheTimeout: null,
    offset: 0,
    fetchValuesPredicate: "",
    templateParams: "",
    sql: "SELECT * FROM orders",
    sampleRows: [],
  };
}

function emptyColumn(): DatasetColumn {
  return { name: "", type: "VARCHAR", groupable: true, filterable: true };
}
function emptyMetric(): DatasetMetric {
  return { name: "", sqlExpression: "", d3Format: ",.0f" };
}

export default function DatasetListPage() {
  const [q, setQ] = useState("");
  const [databaseFilter, setDatabaseFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<DatasetType | "all">("all");
  const [owner, setOwner] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "modified" | "database">("modified");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [liveDbs, setLiveDbs] = useState<DatabaseConnection[]>([]);
  const [rows, setRows] = useState<Dataset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab>("data");
  const [editing, setEditing] = useState<Dataset | null>(null);
  const [isNew, setIsNew] = useState(false);

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
    if (editorOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [editorOpen]);

  useEffect(() => {
    if (!editorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditorOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editorOpen]);

  useEffect(() => {
    let cancelled = false;
    async function loadDbs() {
      try {
        const res = await fetchList<DatabaseConnection>("/api/databases", {
          page: 1,
          pageSize: 50,
        });
        if (!cancelled) setLiveDbs(res.data);
      } catch {
        if (!cancelled) setLiveDbs([]);
      }
    }
    void loadDbs();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (databaseFilter !== "all") params.set("database", databaseFilter);
    if (owner) params.set("owner", owner);
    if (typeFilter !== "all") params.set("type", typeFilter);
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    fetch(`/api/datasets?${params.toString()}`)
      .then((r) => r.json() as Promise<ApiResponse>)
      .then((res) => {
        if (cancelled) return;
        setRows(res.data);
        setTotal(res.total);
      })
      .catch(() => {
        if (!cancelled) showToast("We couldn't load datasets. Try refreshing.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, databaseFilter, typeFilter, owner, sortBy, sortDir, page, pageSize, reloadKey]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/datasets/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(
          (j as { statusMessage?: string })?.statusMessage ?? `Delete failed (${res.status})`,
        );
      }
      showToast("Dataset deleted");
      setSelected((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      setReloadKey((k) => k + 1);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not delete. Try again.");
    }
  };

  const handleDuplicate = async (id: number) => {
    const src = rows.find((d) => d.id === id);
    if (!src) return;
    try {
      const res = await fetch("/api/datasets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: `${src.name}_copy`,
          databaseId: src.databaseId,
          schema: src.schema,
          tableName: src.table,
          type: src.type,
          mainDatetimeColumn: src.mainDatetimeColumn,
          description: src.description,
          sql: src.sql,
          defaultEndpoint: src.defaultEndpoint,
          timeGrain: src.timeGrain,
          cacheTimeout: src.cacheTimeout,
          offset: src.offset,
          fetchValuesPredicate: src.fetchValuesPredicate,
          templateParams: src.templateParams,
          columns: src.columns,
          metrics: src.metrics,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(
          (j as { statusMessage?: string })?.statusMessage ?? `Duplicate failed (${res.status})`,
        );
      }
      setPage(1);
      setReloadKey((k) => k + 1);
      const j = (await res.json()) as { name?: string };
      showToast(`Duplicated as ${j.name ?? `${src.name}_copy`}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Duplicate failed");
    }
  };

  const openCreate = () => {
    setEditing(emptyDataset());
    setIsNew(true);
    setEditorTab("data");
    setEditorOpen(true);
  };
  const openEdit = (d: Dataset) => {
    setEditing({
      ...d,
      columns: d.columns.map((c) => ({ ...c })),
      metrics: d.metrics.map((m) => ({ ...m })),
      owners: [...d.owners],
    });
    setIsNew(false);
    setEditorTab("columns");
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      showToast("Dataset name is required");
      return;
    }
    if (editing.type === "virtual" && !editing.sql?.trim()) {
      showToast("SQL is required for virtual datasets");
      return;
    }
    if (editing.type === "physical" && !editing.table) {
      showToast("Table is required for physical datasets");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: editing.name.trim(),
        databaseId: editing.databaseId,
        schema: editing.schema,
        tableName: editing.table,
        type: editing.type,
        mainDatetimeColumn: editing.mainDatetimeColumn,
        description: editing.description,
        sql: editing.sql,
        defaultEndpoint: editing.defaultEndpoint,
        timeGrain: editing.timeGrain,
        cacheTimeout: editing.cacheTimeout,
        offset: editing.offset,
        fetchValuesPredicate: editing.fetchValuesPredicate,
        templateParams: editing.templateParams,
        columns: editing.columns,
        metrics: editing.metrics,
      };
      let res: Response;
      if (isNew) {
        res = await fetch("/api/datasets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/datasets/${editing.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(
          (j as { statusMessage?: string })?.statusMessage ?? `Save failed (${res.status})`,
        );
      }
      showToast(isNew ? `Dataset "${payload.name}" created` : `Dataset "${payload.name}" saved`);
      setEditorOpen(false);
      setEditing(null);
      if (isNew) setPage(1);
      setReloadKey((k) => k + 1);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const refreshMeta = (d: Dataset) => {
    showToast(
      `Refreshed metadata for ${d.name}. ${d.columns.length} columns, ${d.metrics.length} metrics.`,
    );
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="bg-muted text-muted-foreground grid h-7 w-7 place-items-center rounded-md">
                <LayoutGrid className="h-3.5 w-3.5 stroke-[1.75]" />
              </div>
              <h1 className="text-[22px] font-semibold tracking-tight text-balance">Datasets</h1>
              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
                {total}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 max-w-[60ch] text-sm leading-relaxed text-pretty">
              Semantic layer between tables and charts. Columns, metrics, and settings — each source
              is a real database, not a mock name.
            </p>
          </div>
          <Button
            size="sm"
            onClick={openCreate}
            className="focus-visible:ring-ring/50 shadow-sm focus-visible:ring-2"
          >
            <Table2 className="mr-1.5 h-3.5 w-3.5 stroke-[1.75]" />
            Create dataset
          </Button>
        </div>

        <div className="border-border bg-card mt-6 rounded-lg border shadow-sm">
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-[300px]">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75]" />
              <Input
                placeholder="Search by name…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="focus-visible:ring-ring/50 h-8 pl-8 text-sm tracking-tight focus-visible:ring-2"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <select
                  value={databaseFilter}
                  onChange={(e) => {
                    setDatabaseFilter(e.target.value);
                    setPage(1);
                  }}
                  className="border-input bg-background focus-visible:ring-ring/50 h-8 rounded-md border px-2 pr-7 text-xs font-medium tracking-tight tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <option value="all">All databases</option>
                  {liveDbs.map((db) => (
                    <option key={db.id} value={db.id}>
                      {db.name} · {db.backend}
                    </option>
                  ))}
                </select>
                <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75] opacity-60" />
              </div>
              <div className="border-input bg-background flex items-center gap-1 rounded-md border p-0.5">
                {(["all", "physical", "virtual"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTypeFilter(t);
                      setPage(1);
                    }}
                    className={`focus-visible:ring-ring/50 rounded px-2.5 py-1 text-xs font-medium tracking-tight capitalize tabular-nums transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none ${typeFilter === t ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="border-input bg-background focus-visible:ring-ring/50 h-8 rounded-md border px-2 pr-7 text-xs font-medium tracking-tight tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <option value="modified">Sort: Modified</option>
                  <option value="name">Sort: Name</option>
                  <option value="database">Sort: Database</option>
                </select>
                <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75] opacity-60" />
              </div>
              <button
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="border-input bg-background text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 grid h-8 w-8 place-items-center rounded-md border transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                aria-label="Toggle sort direction"
              >
                <ChevronsUpDown className="h-3.5 w-3.5 stroke-[1.75]" />
              </button>
            </div>
          </div>
          <div className="border-border flex flex-wrap items-center gap-2 border-t px-3 py-2">
            <span className="text-muted-foreground hidden items-center gap-1.5 text-xs tracking-tight sm:inline-flex">
              <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-[11px] tracking-tight tabular-nums">
                virtual
              </span>{" "}
              datasets use SQL;{" "}
              <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-[11px] tracking-tight tabular-nums">
                physical
              </span>{" "}
              point at a table
            </span>
            <div className="flex items-center gap-2 sm:ml-auto">
              <div className="relative">
                <Input
                  placeholder="Filter by owner…"
                  value={owner}
                  onChange={(e) => {
                    setOwner(e.target.value);
                    setPage(1);
                  }}
                  className="focus-visible:ring-ring/50 h-7 w-[150px] text-xs tracking-tight tabular-nums focus-visible:ring-2"
                />
              </div>
              {(q || databaseFilter !== "all" || typeFilter !== "all" || owner) && (
                <button
                  onClick={() => {
                    setQ("");
                    setDatabaseFilter("all");
                    setTypeFilter("all");
                    setOwner("");
                    setPage(1);
                  }}
                  className="border-input bg-background hover:bg-accent focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium tracking-tight transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                >
                  <X className="h-3 w-3 stroke-[1.75]" />
                  Clear
                </button>
              )}
              <span className="text-muted-foreground hidden text-xs tracking-tight tabular-nums sm:inline">
                {loading ? "Loading…" : `${total} datasets`}
              </span>
            </div>
          </div>
          {selected.size > 0 && (
            <div className="border-border bg-muted/40 flex items-center gap-2 border-t px-3 py-2">
              <span className="text-xs font-medium tracking-tight tabular-nums">
                {selected.size} selected
              </span>
              <span className="bg-border h-4 w-px" />
              <Button
                variant="outline"
                size="sm"
                className="focus-visible:ring-ring/50 h-7 text-xs tracking-tight focus-visible:ring-2"
                onClick={async () => {
                  const ids = [...selected];
                  let ok = 0;
                  for (const delId of ids) {
                    const res = await fetch(`/api/datasets/${delId}`, { method: "DELETE" });
                    if (res.ok) ok += 1;
                  }
                  setSelected(new Set());
                  setReloadKey((k) => k + 1);
                  showToast(ok ? `${ok} datasets deleted` : "Could not delete. Try again.");
                }}
              >
                <Trash2 className="mr-1 h-3 w-3 stroke-[1.75]" />
                Delete
              </Button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 ml-auto text-xs font-medium tracking-tight transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="border-border bg-card mt-4 overflow-hidden rounded-lg border shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border bg-muted/40 text-muted-foreground border-b text-left text-[11px] font-medium tracking-[0.04em] uppercase tabular-nums">
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
                      className="hover:text-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1 transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      Name
                      <ChevronsUpDown className="h-3 w-3 stroke-[1.75] opacity-60" />
                    </button>
                  </th>
                  <th className="hidden px-2 py-2.5 sm:table-cell">Type</th>
                  <th className="hidden px-2 py-2.5 lg:table-cell">
                    <button
                      onClick={() => {
                        if (sortBy === "database")
                          setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        else {
                          setSortBy("database");
                          setSortDir("asc");
                        }
                      }}
                      className="hover:text-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1 transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      Source
                      <ChevronsUpDown className="h-3 w-3 stroke-[1.75] opacity-60" />
                    </button>
                  </th>
                  <th className="hidden px-2 py-2.5 xl:table-cell">Main datetime</th>
                  <th className="hidden px-2 py-2.5 md:table-cell">Columns</th>
                  <th className="hidden px-2 py-2.5 md:table-cell">Metrics</th>
                  <th className="hidden px-2 py-2.5 lg:table-cell">Created by</th>
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
                      className="hover:text-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1 transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      Modified
                      <ChevronsUpDown className="h-3 w-3 stroke-[1.75] opacity-60" />
                    </button>
                  </th>
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
                        <span className="bg-muted block h-5 w-16 rounded-full" />
                      </td>
                      <td className="hidden px-2 py-3 lg:table-cell">
                        <span className="bg-muted block h-3 w-40 rounded" />
                      </td>
                      <td className="hidden px-2 py-3 xl:table-cell">
                        <span className="bg-muted block h-3 w-20 rounded" />
                      </td>
                      <td className="hidden px-2 py-3 md:table-cell">
                        <span className="bg-muted block h-3 w-8 rounded" />
                      </td>
                      <td className="hidden px-2 py-3 md:table-cell">
                        <span className="bg-muted block h-3 w-8 rounded" />
                      </td>
                      <td className="hidden px-2 py-3 lg:table-cell">
                        <span className="bg-muted block h-3 w-20 rounded" />
                      </td>
                      <td className="hidden px-2 py-3 md:table-cell">
                        <span className="bg-muted block h-3 w-20 rounded" />
                      </td>
                      <td className="px-2 py-3">
                        <span className="bg-muted block h-3 w-6 rounded" />
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center">
                      <div className="mx-auto max-w-sm">
                        <p className="text-sm font-medium tracking-tight text-balance">
                          No datasets match your filters
                        </p>
                        <p className="text-muted-foreground mt-1 text-sm leading-relaxed text-pretty">
                          Try a different search, database, type, or owner — or create one from an
                          existing table.
                        </p>
                        <div className="mt-4 flex justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="focus-visible:ring-ring/50 tracking-tight shadow-sm focus-visible:ring-2"
                            onClick={() => {
                              setQ("");
                              setDatabaseFilter("all");
                              setTypeFilter("all");
                              setOwner("");
                              setPage(1);
                            }}
                          >
                            Clear filters
                          </Button>
                          <Button
                            size="sm"
                            onClick={openCreate}
                            className="focus-visible:ring-ring/50 tracking-tight shadow-sm focus-visible:ring-2"
                          >
                            Create dataset
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((d) => (
                    <tr
                      key={d.id}
                      className={`group hover:bg-muted/40 transition-colors duration-150 ${selected.has(d.id) ? "bg-muted/60" : ""}`}
                    >
                      <td className="px-3 py-3">
                        <Checkbox
                          checked={selected.has(d.id)}
                          onChange={(e) => {
                            const c = (e.target as HTMLInputElement).checked;
                            setSelected((prev) => {
                              const n = new Set(prev);
                              if (c) n.add(d.id);
                              else n.delete(d.id);
                              return n;
                            });
                          }}
                          aria-label={`Select ${d.name}`}
                        />
                      </td>
                      <td className="px-2 py-3">
                        <button
                          onClick={() => openEdit(d)}
                          className="focus-visible:ring-ring/50 text-left text-sm font-medium tracking-tight text-balance hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        >
                          {d.name}
                        </button>
                        <div className="text-muted-foreground hidden max-w-[22ch] truncate text-xs tracking-tight sm:block">
                          {d.description ?? "—"}
                        </div>
                        <div className="mt-1 flex gap-1 sm:hidden">
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-tight tabular-nums ${d.type === "physical" ? "bg-secondary text-secondary-foreground" : "bg-info text-info-foreground"}`}
                          >
                            {d.type}
                          </span>
                          <span className="text-muted-foreground font-mono text-[11px] tracking-tight tabular-nums">
                            {d.source}
                          </span>
                        </div>
                      </td>
                      <td className="hidden px-2 py-2.5 sm:table-cell">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium tracking-tight tabular-nums ${d.type === "physical" ? "bg-secondary text-secondary-foreground" : "bg-info text-info-foreground"}`}
                        >
                          {d.type}
                        </span>
                      </td>
                      <td className="hidden px-2 py-2.5 lg:table-cell">
                        <span
                          className="font-mono text-xs tracking-tight tabular-nums"
                          title={d.source}
                        >
                          {d.source}
                        </span>
                        <div className="text-muted-foreground text-[11px] tracking-tight tabular-nums">
                          {d.backend} · {d.schema}
                        </div>
                      </td>
                      <td className="hidden px-2 py-2.5 xl:table-cell">
                        <span className="font-mono text-xs tracking-tight tabular-nums">
                          {d.mainDatetimeColumn ?? "—"}
                        </span>
                      </td>
                      <td className="hidden px-2 py-2.5 md:table-cell">
                        <span className="text-xs font-medium tracking-tight tabular-nums">
                          {d.columns.length}
                        </span>
                        <span className="text-muted-foreground text-xs tracking-tight"> cols</span>
                      </td>
                      <td className="hidden px-2 py-2.5 md:table-cell">
                        <span className="text-xs font-medium tracking-tight tabular-nums">
                          {d.metrics.length}
                        </span>
                        <span className="text-muted-foreground text-xs tracking-tight"> mts</span>
                      </td>
                      <td className="hidden px-2 py-2.5 lg:table-cell">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="bg-secondary text-secondary-foreground grid h-5 w-5 place-items-center rounded-full text-[10px] font-medium tabular-nums">
                            {initials(d.createdBy?.name ?? "Sample")}
                          </span>
                          <span className="text-xs tracking-tight">
                            {d.createdBy?.name ?? "Sample"}
                          </span>
                        </span>
                      </td>
                      <td className="hidden px-2 py-2.5 md:table-cell">
                        <div className="text-xs tracking-tight tabular-nums">
                          {formatDate(d.modified)}
                        </div>
                        <div className="text-muted-foreground flex items-center gap-1 text-[11px] tracking-tight">
                          <Clock3 className="h-3 w-3 stroke-[1.75]" />
                          {d.modifiedBy?.name ?? "Sample"}
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <div
                          className="relative flex justify-end"
                          ref={openMenu === d.id ? menuRef : undefined}
                        >
                          <button
                            onClick={() => setOpenMenu((v) => (v === d.id ? null : d.id))}
                            className="text-muted-foreground hover:border-input hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 grid h-7 w-7 place-items-center rounded-md border border-transparent transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                            aria-label="Row actions"
                          >
                            <ChevronsUpDown className="h-3.5 w-3.5 stroke-[1.75]" />
                          </button>
                          {openMenu === d.id && (
                            <div className="border-border bg-popover animate-in fade-in slide-in-from-top-1 absolute top-8 right-0 z-20 w-56 rounded-md border p-1 shadow-xl duration-150">
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  openEdit(d);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs tracking-tight transition-colors duration-150"
                              >
                                <Pencil className="h-3.5 w-3.5 stroke-[1.75]" />
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  showToast(`Opening chart builder for ${d.name}`);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs tracking-tight transition-colors duration-150"
                              >
                                <FlaskConical className="h-3.5 w-3.5 stroke-[1.75]" />
                                Explore
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  showToast(`Preview of ${d.name}`);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs tracking-tight transition-colors duration-150"
                              >
                                <Eye className="h-3.5 w-3.5 stroke-[1.75]" />
                                View
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  refreshMeta(d);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs tracking-tight transition-colors duration-150"
                              >
                                <RefreshCw className="h-3.5 w-3.5 stroke-[1.75]" />
                                Refresh metadata
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleDuplicate(d.id);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs tracking-tight transition-colors duration-150"
                              >
                                <Copy className="h-3.5 w-3.5 stroke-[1.75]" />
                                Duplicate
                              </button>
                              <div className="bg-border my-1 h-px" />
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleDelete(d.id);
                                }}
                                className="text-destructive hover:bg-destructive hover:text-destructive-foreground flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs tracking-tight transition-colors duration-150"
                              >
                                <Trash2 className="h-3.5 w-3.5 stroke-[1.75]" />
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
            <p className="text-muted-foreground text-xs tracking-tight text-pretty tabular-nums">
              {total === 0
                ? "No results"
                : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="focus-visible:ring-ring/50 h-7 px-2 focus-visible:ring-2"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5 stroke-[1.75]" />
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
                    className={`focus-visible:ring-ring/50 grid h-7 min-w-7 place-items-center rounded-md border px-2 text-xs font-medium tracking-tight tabular-nums transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none ${n === page ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-input bg-background hover:bg-accent"}`}
                  >
                    {n}
                  </button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                className="focus-visible:ring-ring/50 h-7 px-2 focus-visible:ring-2"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                <ChevronRight className="h-3.5 w-3.5 stroke-[1.75]" />
              </Button>
            </div>
          </div>
        </div>
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed tracking-tight">
          Data via{" "}
          <code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px] tabular-nums">
            /api/datasets
          </code>{" "}
          — Postgres + Drizzle.
        </p>
      </div>

      {editorOpen && editing && (
        <div className="fixed inset-0 z-40 flex">
          <button
            aria-label="Close editor"
            onClick={() => setEditorOpen(false)}
            className="flex-1 bg-black/40 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Dataset editor"
            className="bg-card border-border flex w-full max-w-[760px] flex-col border-l shadow-xl"
          >
            <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
              <div>
                <h2 className="text-[18px] font-semibold tracking-tight text-balance">
                  {isNew ? "Create dataset" : `Edit ${editing.name}`}
                </h2>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed text-pretty">
                  Columns, metrics, and settings. Virtual datasets use SQL — physical datasets point
                  at a real table from{" "}
                  <code className="bg-muted rounded px-1 font-mono text-[11px]">liveDbs</code> (live
                  — /api/databases).
                </p>
                <p className="text-muted-foreground mt-1 font-mono text-[11px] tracking-tight tabular-nums">
                  {editing.source} · {editing.backend}
                </p>
              </div>
              <button
                onClick={() => setEditorOpen(false)}
                className="text-muted-foreground hover:bg-accent focus-visible:ring-ring/50 grid h-8 w-8 place-items-center rounded-md transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
              >
                <X className="h-3.5 w-3.5 stroke-[1.75]" />
              </button>
            </div>
            <div className="border-border flex gap-1 overflow-x-auto border-b px-2 py-2">
              {EDITOR_TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setEditorTab(t.id)}
                  className={`focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium tracking-tight whitespace-nowrap transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none ${editorTab === t.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                >
                  <t.icon className="h-3.5 w-3.5 stroke-[1.75]" />
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {isNew && (
                <p className="border-border bg-muted/40 mb-4 rounded-md border px-3 py-2 text-xs leading-relaxed tracking-tight text-pretty">
                  Preview your data first, then configure settings when ready.
                </p>
              )}
              {editorTab === "columns" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium tracking-tight tabular-nums">
                      Columns · {editing.columns.length}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="focus-visible:ring-ring/50 h-7 text-xs tracking-tight focus-visible:ring-2"
                      onClick={() =>
                        setEditing({ ...editing, columns: [...editing.columns, emptyColumn()] })
                      }
                    >
                      Add column
                    </Button>
                  </div>
                  <div className="border-border overflow-hidden rounded-md border">
                    <div className="bg-muted/40 text-muted-foreground grid grid-cols-[1.2fr_0.7fr_0.45fr_0.45fr_1fr_28px] gap-2 px-3 py-2 text-[11px] font-medium tracking-[0.04em] uppercase tabular-nums">
                      <span>Name</span>
                      <span>Type</span>
                      <span>Groupable</span>
                      <span>Filterable</span>
                      <span>Description / expression</span>
                      <span />
                    </div>
                    {editing.columns.map((c, idx) => (
                      <div
                        key={idx}
                        className="border-border grid grid-cols-[1.2fr_0.7fr_0.45fr_0.45fr_1fr_28px] items-center gap-2 border-t px-3 py-2"
                      >
                        <Input
                          value={c.name}
                          onChange={(e) => {
                            const cols = [...editing.columns];
                            cols[idx] = { ...c, name: e.target.value };
                            setEditing({ ...editing, columns: cols });
                          }}
                          placeholder="customer_id"
                          className="focus-visible:ring-ring/50 h-7 text-xs tracking-tight focus-visible:ring-2"
                        />
                        <div className="relative">
                          <select
                            value={c.type}
                            onChange={(e) => {
                              const cols = [...editing.columns];
                              cols[idx] = { ...c, type: e.target.value };
                              setEditing({ ...editing, columns: cols });
                            }}
                            className="border-input bg-background focus-visible:ring-ring/50 h-7 w-full rounded-md border px-2 pr-6 text-xs tracking-tight tabular-nums focus-visible:ring-2 focus-visible:outline-none"
                          >
                            {[
                              "INTEGER",
                              "VARCHAR",
                              "TIMESTAMP",
                              "DATE",
                              "NUMERIC",
                              "FLOAT",
                              "STRING",
                              "BOOLEAN",
                              "INT",
                              "DECIMAL",
                            ].map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3 w-3 -translate-y-1/2 stroke-[1.75] opacity-60" />
                        </div>
                        <label className="flex justify-center">
                          <Checkbox
                            checked={c.groupable}
                            onChange={(e) => {
                              const cols = [...editing.columns];
                              cols[idx] = {
                                ...c,
                                groupable: (e.target as HTMLInputElement).checked,
                              };
                              setEditing({ ...editing, columns: cols });
                            }}
                          />
                        </label>
                        <label className="flex justify-center">
                          <Checkbox
                            checked={c.filterable}
                            onChange={(e) => {
                              const cols = [...editing.columns];
                              cols[idx] = {
                                ...c,
                                filterable: (e.target as HTMLInputElement).checked,
                              };
                              setEditing({ ...editing, columns: cols });
                            }}
                          />
                        </label>
                        <Input
                          value={
                            c.expression
                              ? `${c.description ?? ""} // ${c.expression}`
                              : (c.description ?? "")
                          }
                          onChange={(e) => {
                            const cols = [...editing.columns];
                            const v = e.target.value;
                            const parts = v.split("//");
                            cols[idx] = {
                              ...c,
                              description: parts[0].trim(),
                              expression: parts[1]?.trim() || undefined,
                            };
                            setEditing({ ...editing, columns: cols });
                          }}
                          placeholder="description or 'desc // expr'"
                          className="focus-visible:ring-ring/50 h-7 text-xs tracking-tight focus-visible:ring-2"
                        />
                        <button
                          onClick={() =>
                            setEditing({
                              ...editing,
                              columns: editing.columns.filter((_, i) => i !== idx),
                            })
                          }
                          className="text-muted-foreground hover:text-destructive focus-visible:ring-ring/50 grid h-7 w-7 place-items-center rounded transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                        >
                          <Trash2 className="h-3.5 w-3.5 stroke-[1.75]" />
                        </button>
                      </div>
                    ))}
                    {editing.columns.length === 0 && (
                      <p className="text-muted-foreground px-3 py-8 text-center text-xs tracking-tight text-pretty">
                        No columns — add one.
                      </p>
                    )}
                  </div>
                  <p className="text-muted-foreground text-[11px] tracking-tight text-pretty">
                    Groupable / filterable mirror Superset. Expression is only for calculated
                    columns (e.g.{" "}
                    <code className="bg-muted rounded px-1 font-mono text-[11px] tabular-nums">
                      amount_tier
                    </code>
                    ).
                  </p>
                </div>
              )}
              {editorTab === "metrics" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium tracking-tight tabular-nums">
                      Metrics · {editing.metrics.length}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="focus-visible:ring-ring/50 h-7 text-xs tracking-tight focus-visible:ring-2"
                      onClick={() =>
                        setEditing({ ...editing, metrics: [...editing.metrics, emptyMetric()] })
                      }
                    >
                      Add metric
                    </Button>
                  </div>
                  <div className="border-border overflow-hidden rounded-md border">
                    <div className="bg-muted/40 text-muted-foreground grid grid-cols-[1fr_1.3fr_0.5fr_1fr_28px] gap-2 px-3 py-2 text-[11px] font-medium tracking-[0.04em] uppercase tabular-nums">
                      <span>Name</span>
                      <span>SQL expression</span>
                      <span>d3 format</span>
                      <span>Description / warning</span>
                      <span />
                    </div>
                    {editing.metrics.map((m, idx) => (
                      <div
                        key={idx}
                        className="border-border grid grid-cols-[1fr_1.3fr_0.5fr_1fr_28px] items-center gap-2 border-t px-3 py-2"
                      >
                        <Input
                          value={m.name}
                          onChange={(e) => {
                            const ms = [...editing.metrics];
                            ms[idx] = { ...m, name: e.target.value };
                            setEditing({ ...editing, metrics: ms });
                          }}
                          placeholder="total_revenue"
                          className="focus-visible:ring-ring/50 h-7 font-mono text-xs tracking-tight focus-visible:ring-2"
                        />
                        <Input
                          value={m.sqlExpression}
                          onChange={(e) => {
                            const ms = [...editing.metrics];
                            ms[idx] = { ...m, sqlExpression: e.target.value };
                            setEditing({ ...editing, metrics: ms });
                          }}
                          placeholder="SUM(amount)"
                          className="focus-visible:ring-ring/50 h-7 font-mono text-xs tracking-tight focus-visible:ring-2"
                        />
                        <Input
                          value={m.d3Format ?? ""}
                          onChange={(e) => {
                            const ms = [...editing.metrics];
                            ms[idx] = { ...m, d3Format: e.target.value || undefined };
                            setEditing({ ...editing, metrics: ms });
                          }}
                          placeholder="$,.2f"
                          className="focus-visible:ring-ring/50 h-7 font-mono text-xs tracking-tight focus-visible:ring-2"
                        />
                        <Input
                          value={[m.description ?? "", m.warningText ?? ""]
                            .filter(Boolean)
                            .join(" // ")}
                          onChange={(e) => {
                            const ms = [...editing.metrics];
                            const v = e.target.value;
                            const parts = v.split("//");
                            ms[idx] = {
                              ...m,
                              description: parts[0].trim() || undefined,
                              warningText: parts[1]?.trim() || undefined,
                            };
                            setEditing({ ...editing, metrics: ms });
                          }}
                          placeholder="desc // warning"
                          className="focus-visible:ring-ring/50 h-7 text-xs tracking-tight focus-visible:ring-2"
                        />
                        <button
                          onClick={() =>
                            setEditing({
                              ...editing,
                              metrics: editing.metrics.filter((_, i) => i !== idx),
                            })
                          }
                          className="text-muted-foreground hover:text-destructive focus-visible:ring-ring/50 grid h-7 w-7 place-items-center rounded transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                        >
                          <Trash2 className="h-3.5 w-3.5 stroke-[1.75]" />
                        </button>
                      </div>
                    ))}
                    {editing.metrics.length === 0 && (
                      <p className="text-muted-foreground px-3 py-8 text-center text-xs tracking-tight text-pretty">
                        No metrics — add one with a SQL expression.
                      </p>
                    )}
                  </div>
                  <p className="text-muted-foreground text-[11px] tracking-tight text-pretty">
                    SQL expression runs against the dataset's source; d3 format controls number
                    rendering.
                  </p>
                </div>
              )}
              {editorTab === "data" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium tracking-tight tabular-nums">
                      Showing {editing.sampleRows?.length ?? 0} rows from {editing.source}
                    </p>
                    <Badge
                      variant="secondary"
                      className="ml-auto font-mono text-[11px] tracking-tight tabular-nums"
                    >
                      {editing.columns.length} cols
                    </Badge>
                  </div>
                  <div className="border-border overflow-auto rounded-md border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/40 text-muted-foreground border-b text-left text-[11px] font-medium tracking-[0.04em] uppercase tabular-nums">
                          {editing.columns.slice(0, 5).map((c) => (
                            <th
                              key={c.name}
                              className="px-3 py-2 font-mono text-[11px] font-medium tracking-tight"
                            >
                              {c.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-border divide-y">
                        {(editing.sampleRows ?? []).slice(0, 6).map((r, i) => (
                          <tr key={i} className="font-mono text-[11px] tracking-tight tabular-nums">
                            {editing.columns.slice(0, 5).map((c) => (
                              <td key={c.name} className="px-3 py-1.5">
                                {String(r[c.name] ?? "—")}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {(!editing.sampleRows || editing.sampleRows.length === 0) && (
                          <tr>
                            <td
                              colSpan={Math.min(5, Math.max(1, editing.columns.length))}
                              className="text-muted-foreground px-3 py-8 text-center text-xs tracking-tight text-pretty"
                            >
                              No preview rows for this dataset yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-muted-foreground text-[11px] tracking-tight text-pretty">
                    Placeholder preview — in production this runs{" "}
                    <code className="bg-muted rounded px-1 font-mono text-[11px] tabular-nums">
                      SELECT * FROM {editing.type === "virtual" ? "(virtual SQL)" : editing.source}{" "}
                      LIMIT 5
                    </code>
                    .
                  </p>
                </div>
              )}
              {editorTab === "settings" && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium tracking-tight">Dataset name *</span>
                      <Input
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        placeholder="orders"
                        className="focus-visible:ring-ring/50 tracking-tight focus-visible:ring-2"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium tracking-tight">Type</span>
                      <div className="border-input bg-background flex gap-1 rounded-md border p-0.5">
                        {(["physical", "virtual"] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => setEditing({ ...editing, type: t })}
                            className={`focus-visible:ring-ring/50 flex-1 rounded px-2 py-1.5 text-xs font-medium tracking-tight capitalize transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none ${editing.type === t ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </label>
                  </div>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium tracking-tight">Description</span>
                    <textarea
                      value={editing.description ?? ""}
                      onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                      placeholder="What's this dataset for?"
                      rows={2}
                      className="border-input bg-background focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm tracking-tight focus-visible:ring-2 focus-visible:outline-none"
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium tracking-tight">Database *</span>
                      <div className="relative">
                        <select
                          value={editing.databaseId}
                          onChange={(e) => {
                            const db = liveDbs.find((x) => x.id === e.target.value);
                            if (db)
                              setEditing({
                                ...editing,
                                databaseId: db.id,
                                databaseName: db.name,
                                backend: db.backend,
                                schema: db.schemas[0]?.name ?? editing.schema,
                                table:
                                  editing.type === "physical"
                                    ? (db.schemas[0]?.tables[0]?.name ?? editing.table)
                                    : null,
                              });
                          }}
                          className="border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 pr-8 text-sm tracking-tight tabular-nums focus-visible:ring-2 focus-visible:outline-none"
                        >
                          {liveDbs.map((db) => (
                            <option key={db.id} value={db.id}>
                              {db.name} · {db.backend}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75] opacity-60" />
                      </div>
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium tracking-tight">Schema</span>
                      <div className="relative">
                        <select
                          value={editing.schema}
                          onChange={(e) => setEditing({ ...editing, schema: e.target.value })}
                          className="border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 pr-8 text-sm tracking-tight tabular-nums focus-visible:ring-2 focus-visible:outline-none"
                        >
                          {(liveDbs.find((x) => x.id === editing.databaseId)?.schemas ?? []).map(
                            (s) => (
                              <option key={s.name} value={s.name}>
                                {s.name}
                              </option>
                            ),
                          )}
                        </select>
                        <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75] opacity-60" />
                      </div>
                    </label>
                    {editing.type === "physical" ? (
                      <label className="space-y-1.5">
                        <span className="text-xs font-medium tracking-tight">Table</span>
                        <div className="relative">
                          <select
                            value={editing.table ?? ""}
                            onChange={(e) => setEditing({ ...editing, table: e.target.value })}
                            className="border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 pr-8 font-mono text-xs tracking-tight tabular-nums focus-visible:ring-2 focus-visible:outline-none"
                          >
                            {(
                              liveDbs
                                .find((x) => x.id === editing.databaseId)
                                ?.schemas.find((s) => s.name === editing.schema)?.tables ?? []
                            ).map((t) => (
                              <option key={t.name} value={t.name}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75] opacity-60" />
                        </div>
                      </label>
                    ) : (
                      <label className="space-y-1.5">
                        <span className="text-xs font-medium tracking-tight">
                          Table (virtual — none)
                        </span>
                        <Input
                          value="—"
                          disabled
                          className="h-9 font-mono text-xs tracking-tight tabular-nums"
                        />
                      </label>
                    )}
                  </div>
                  {editing.type === "virtual" && (
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium tracking-tight">
                        Virtual dataset SQL *
                      </span>
                      <textarea
                        value={editing.sql ?? ""}
                        onChange={(e) => setEditing({ ...editing, sql: e.target.value })}
                        placeholder="SELECT * FROM orders WHERE …"
                        rows={4}
                        className="border-input bg-background focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 font-mono text-xs tracking-tight focus-visible:ring-2 focus-visible:outline-none"
                      />
                      <span className="text-muted-foreground text-[11px] tracking-tight text-pretty">
                        Shown inspectably wherever this dataset is used.
                      </span>
                    </label>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium tracking-tight">
                        Main datetime column
                      </span>
                      <div className="relative">
                        <select
                          value={editing.mainDatetimeColumn ?? ""}
                          onChange={(e) =>
                            setEditing({ ...editing, mainDatetimeColumn: e.target.value || null })
                          }
                          className="border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 pr-8 font-mono text-xs tracking-tight tabular-nums focus-visible:ring-2 focus-visible:outline-none"
                        >
                          <option value="">— none —</option>
                          {editing.columns.map((c) => (
                            <option key={c.name} value={c.name}>
                              {c.name} · {c.type}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75] opacity-60" />
                      </div>
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium tracking-tight">Default endpoint</span>
                      <Input
                        value={editing.defaultEndpoint ?? ""}
                        onChange={(e) =>
                          setEditing({ ...editing, defaultEndpoint: e.target.value })
                        }
                        placeholder="/table/1"
                        className="focus-visible:ring-ring/50 h-9 font-mono text-xs tracking-tight tabular-nums focus-visible:ring-2"
                      />
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium tracking-tight">Time grain</span>
                      <Input
                        value={editing.timeGrain ?? ""}
                        onChange={(e) => setEditing({ ...editing, timeGrain: e.target.value })}
                        placeholder="P1D"
                        className="focus-visible:ring-ring/50 tracking-tight tabular-nums focus-visible:ring-2"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium tracking-tight">Cache timeout (s)</span>
                      <Input
                        type="number"
                        value={editing.cacheTimeout ?? ""}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            cacheTimeout: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        placeholder="86400"
                        className="focus-visible:ring-ring/50 tracking-tight tabular-nums focus-visible:ring-2"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium tracking-tight">Offset</span>
                      <Input
                        type="number"
                        value={editing.offset ?? 0}
                        onChange={(e) =>
                          setEditing({ ...editing, offset: Number(e.target.value) || 0 })
                        }
                        placeholder="0"
                        className="focus-visible:ring-ring/50 tracking-tight tabular-nums focus-visible:ring-2"
                      />
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium tracking-tight">
                        Owners (comma-separated)
                      </span>
                      <Input
                        value={editing.owners
                          .map((o) => (o as { name?: string })?.name ?? "Sample")
                          .join(", ")}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            owners: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean)
                              .map((name, i) => ({ id: i + 1, name })),
                          })
                        }
                        placeholder="Admin User, Data Analyst"
                        className="focus-visible:ring-ring/50 tracking-tight focus-visible:ring-2"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium tracking-tight">
                        Fetch values predicate
                      </span>
                      <Input
                        value={editing.fetchValuesPredicate ?? ""}
                        onChange={(e) =>
                          setEditing({ ...editing, fetchValuesPredicate: e.target.value })
                        }
                        placeholder="status = 'paid'"
                        className="focus-visible:ring-ring/50 font-mono text-xs tracking-tight focus-visible:ring-2"
                      />
                    </label>
                  </div>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium tracking-tight">
                      Template parameters (JSON)
                    </span>
                    <textarea
                      value={editing.templateParams ?? ""}
                      onChange={(e) => setEditing({ ...editing, templateParams: e.target.value })}
                      placeholder='{"time_range": "Last week"}'
                      rows={2}
                      className="border-input bg-background focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 font-mono text-xs tracking-tight focus-visible:ring-2 focus-visible:outline-none"
                    />
                  </label>
                </div>
              )}
            </div>
            <div className="border-border flex items-center gap-2 border-t px-5 py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditorOpen(false)}
                className="focus-visible:ring-ring/50 tracking-tight focus-visible:ring-2"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="focus-visible:ring-ring/50 ml-auto tracking-tight shadow-sm focus-visible:ring-2"
                disabled={saving}
              >
                {saving ? "Saving…" : isNew ? "Create dataset" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="border-border bg-card animate-in fade-in slide-in-from-bottom-1 fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-3 py-2 text-sm font-medium tracking-tight text-balance shadow-xl duration-150">
          {toast}
        </div>
      )}
    </AppShell>
  );
}
