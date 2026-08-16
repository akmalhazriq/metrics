import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Database,
  Eye,
  Pencil,
  PlugZap,
  ScanSearch,
  Search,
  Shield,
  Trash2,
  X,
  Clock3,
  Settings2,
  Gauge,
  FlaskConical,
  Lock,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { seedDatabases } from "@/data/databases";
import type { DatabaseBackend, DatabaseConnection } from "@/types/database";

type ApiResponse = { data: DatabaseConnection[]; total: number; page: number; pageSize: number };

const BACKENDS: (DatabaseBackend | "all")[] = [
  "all",
  "Postgres",
  "BigQuery",
  "Snowflake",
  "MySQL",
  "Presto",
  "Redshift",
  "Trino",
  "SQLite",
];

const BACKEND_BADGE: Record<DatabaseBackend, string> = {
  Postgres: "bg-info text-info-foreground",
  BigQuery: "bg-warning text-warning-foreground",
  Snowflake: "bg-primary text-primary-foreground",
  MySQL: "bg-success text-success-foreground",
  Presto: "bg-secondary text-secondary-foreground",
  Redshift: "bg-destructive text-destructive-foreground",
  Trino: "bg-muted text-muted-foreground border",
  SQLite: "bg-muted text-muted-foreground border",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function BoolDot({ value, label }: { value: boolean; label: string }) {
  return (
    <span
      title={`${label}: ${value ? "yes" : "no"}`}
      className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-medium ${value ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}
    >
      {value ? "● Yes" : "○ No"}
    </span>
  );
}

// ---- Editor types ----
type EditorTab = "connection" | "performance" | "sqllab" | "security" | "advanced";

const EDITOR_TABS: { id: EditorTab; label: string; icon: typeof Database }[] = [
  { id: "connection", label: "Connection", icon: PlugZap },
  { id: "performance", label: "Performance", icon: Gauge },
  { id: "sqllab", label: "SQL Lab", icon: FlaskConical },
  { id: "security", label: "Security", icon: Shield },
  { id: "advanced", label: "Advanced", icon: Settings2 },
];

function emptyConnection(): DatabaseConnection {
  const now = new Date().toISOString();
  return {
    id: `db_${Date.now()}`,
    name: "",
    backend: "Postgres",
    sqlalchemyUri: "",
    serverCert: "",
    extraParams: "",
    impersonateUser: false,
    exposedInSqlLab: true,
    allowDML: false,
    allowCTA: false,
    allowCsvUpload: false,
    allowRunSync: true,
    secureExtra: "",
    encryptedExtra: "",
    cacheEnabled: false,
    cacheTimeout: null,
    asyncExecution: false,
    concurrency: null,
    forceSqlLab: false,
    templateParams: "",
    queryTimeout: null,
    maxRows: null,
    defaultSchema: "",
    defaultLimit: null,
    owners: [{ id: 1, name: "Akmal Hazriq" }],
    version: "",
    schemaCacheEnabled: false,
    sshTunnelEnabled: false,
    sshTunnelHost: "",
    sshTunnelPort: null,
    modifiedBy: { id: 1, name: "Akmal Hazriq" },
    modified: now,
    schemas: [{ name: "public", tables: [] }],
  };
}

export default function DatabaseListPage() {
  // toolbar
  const [q, setQ] = useState("");
  const [backend, setBackend] = useState<DatabaseBackend | "all">("all");
  const [sortBy, setSortBy] = useState<"name" | "backend" | "modified">("modified");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  // data
  const [rows, setRows] = useState<DatabaseConnection[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [localRows, setLocalRows] = useState<DatabaseConnection[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab>("connection");
  const [editing, setEditing] = useState<DatabaseConnection | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [testing, setTesting] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

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

  // Lock body scroll when editor open
  useEffect(() => {
    if (editorOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [editorOpen]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (backend !== "all") params.set("backend", backend);
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    fetch(`/api/databases?${params.toString()}`)
      .then((r) => r.json() as Promise<ApiResponse>)
      .then((res) => {
        if (cancelled) return;
        let data = res.data;
        if (localRows) {
          const map = new Map(localRows.map((d) => [d.id, d]));
          // overlay edits for visible rows
          data = data.map((d) => map.get(d.id) ?? d);
          // deletions: keep only ids still in localRows
          const ids = new Set(localRows.map((d) => d.id));
          data = data.filter((d) => ids.has(d.id));
          // inserts from localRows that match filters but not in page: include if not already
          // simple: if localRows has items not in server data that pass filter, inject at top
          const serverIds = new Set(data.map((d) => d.id));
          const extras = localRows.filter(
            (d) => !serverIds.has(d.id) && (!q || d.name.toLowerCase().includes(q.toLowerCase())),
          );
          if (extras.length)
            data = [...extras.slice(0, pageSize - data.length), ...data].slice(0, pageSize);
        }
        setRows(data);
        setTotal(
          localRows
            ? localRows.filter(
                (d) =>
                  (!q || d.name.toLowerCase().includes(q.toLowerCase())) &&
                  (backend === "all" || d.backend === backend),
              ).length
            : res.total,
        );
      })
      .catch(() => {
        // fallback to client-side seed if API not ready (e.g. direct file open)
        if (!cancelled) {
          let data = [...seedDatabases];
          if (q) data = data.filter((d) => d.name.toLowerCase().includes(q.toLowerCase()));
          if (backend !== "all") data = data.filter((d) => d.backend === backend);
          data.sort((a, b) => {
            const dir = sortDir === "asc" ? 1 : -1;
            if (sortBy === "name") return dir * a.name.localeCompare(b.name);
            if (sortBy === "backend") return dir * a.backend.localeCompare(b.backend);
            return dir * a.modified.localeCompare(b.modified);
          });
          const totalFallback = data.length;
          const start = (page - 1) * pageSize;
          setRows(data.slice(start, start + pageSize));
          setTotal(totalFallback);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, backend, sortBy, sortDir, page, pageSize, localRows]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const handleDelete = (id: string) => {
    setRows((prev) => prev.filter((d) => d.id !== id));
    setLocalRows((prev) => {
      const base = prev ?? seedDatabases;
      return base.filter((d) => d.id !== id);
    });
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    setTotal((t) => Math.max(0, t - 1));
    showToast("Database deleted");
  };

  const handleTestConnection = async (db: DatabaseConnection) => {
    setTesting(true);
    await new Promise((r) => setTimeout(r, 900));
    setTesting(false);
    const ok = !!db.sqlalchemyUri.trim();
    showToast(
      ok
        ? `Connection to "${db.name}" succeeded — ${db.schemas.reduce((n, s) => n + s.tables.length, 0)} tables reachable`
        : `Connection failed — SQLAlchemy URI is empty`,
    );
  };

  const handleScan = async (db: DatabaseConnection) => {
    setScanResult(null);
    await new Promise((r) => setTimeout(r, 600));
    const schemas = db.schemas.length;
    const tables = db.schemas.reduce((n, s) => n + s.tables.length, 0);
    setScanResult(`${schemas} schemas · ${tables} tables`);
    showToast(`Scanned ${db.name}: ${schemas} schemas, ${tables} tables`);
    window.setTimeout(() => setScanResult(null), 3000);
  };

  const openCreate = () => {
    setEditing(emptyConnection());
    setIsNew(true);
    setEditorTab("connection");
    setEditorOpen(true);
  };

  const openEdit = (db: DatabaseConnection) => {
    setEditing({ ...db, owners: [...db.owners] });
    setIsNew(false);
    setEditorTab("connection");
    setEditorOpen(true);
  };

  const handleSave = () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      showToast("Database name is required");
      return;
    }
    if (!editing.sqlalchemyUri.trim()) {
      showToast("SQLAlchemy URI is required");
      return;
    }
    const now = new Date().toISOString();
    const saved: DatabaseConnection = {
      ...editing,
      id: isNew
        ? editing.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .slice(0, 24) || `db_${Date.now()}`
        : editing.id,
      name: editing.name.trim(),
      sqlalchemyUri: editing.sqlalchemyUri.trim(),
      modified: now,
      modifiedBy: { id: 1, name: "Akmal Hazriq" },
    };
    if (isNew) {
      setLocalRows((prev) => {
        const base = prev ?? seedDatabases;
        // avoid duplicate id
        if (base.some((d) => d.id === saved.id))
          saved.id = `${saved.id}_${Date.now().toString(36).slice(-4)}`;
        return [saved, ...base];
      });
      setTotal((t) => t + 1);
      setPage(1);
      showToast(`Database "${saved.name}" created`);
    } else {
      setRows((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
      setLocalRows((prev) => {
        const base = prev ?? seedDatabases;
        return base.map((d) => (d.id === saved.id ? saved : d));
      });
      showToast(`Database "${saved.name}" saved`);
    }
    setEditorOpen(false);
    setEditing(null);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="bg-muted text-muted-foreground grid h-7 w-7 place-items-center rounded-md">
                <Database className="h-4 w-4" />
              </div>
              <h1 className="text-[22px] font-semibold tracking-tight">Databases</h1>
              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                {total}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 max-w-[60ch] text-sm leading-relaxed">
              Connections that back SQL Lab and datasets. Test, scan, and configure exposure before
              sharing with editors.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={openCreate}>
              <Database className="mr-1.5 h-3.5 w-3.5" />
              Add database
            </Button>
          </div>
        </div>

        {/* Toolbar */}
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
                  value={backend}
                  onChange={(e) => {
                    setBackend(e.target.value as typeof backend);
                    setPage(1);
                  }}
                  className="border-input bg-background h-8 rounded-md border px-2 pr-6 text-xs font-medium"
                >
                  <option value="all">All backends</option>
                  {BACKENDS.filter((b) => b !== "all").map((b) => (
                    <option key={b} value={b}>
                      {b}
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
                  <option value="backend">Sort: Backend</option>
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
            <span className="text-muted-foreground hidden items-center gap-1.5 text-xs sm:inline-flex">
              <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-[11px]">exposed</span>{" "}
              = appears in SQL Lab selector
            </span>
            <div className="ml-auto flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                {loading ? "Loading…" : `${total} connections`}
              </span>
              {(q || backend !== "all") && (
                <button
                  onClick={() => {
                    setQ("");
                    setBackend("all");
                    setPage(1);
                  }}
                  className="border-input bg-background hover:bg-accent inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium"
                >
                  <X className="h-3 w-3" />
                  Clear filters
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
                onClick={() => {
                  const ids = selected;
                  setLocalRows((prev) => {
                    const base = prev ?? seedDatabases;
                    return base.filter((d) => !ids.has(d.id));
                  });
                  setRows((prev) => prev.filter((d) => !ids.has(d.id)));
                  setTotal((t) => Math.max(0, t - ids.size));
                  setSelected(new Set());
                  showToast(`${ids.size} databases deleted`);
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
                        const checked = (e.target as HTMLInputElement).checked;
                        setSelected((prev) => {
                          const next = new Set(prev);
                          rows.forEach((r) => {
                            if (checked) next.add(r.id);
                            else next.delete(r.id);
                          });
                          return next;
                        });
                      }}
                      aria-label="Select all on page"
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
                      Database
                      <ChevronsUpDown className="h-3 w-3 opacity-60" />
                    </button>
                  </th>
                  <th className="hidden px-2 py-2.5 sm:table-cell">
                    <button
                      onClick={() => {
                        if (sortBy === "backend") setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        else {
                          setSortBy("backend");
                          setSortDir("asc");
                        }
                      }}
                      className="hover:text-foreground inline-flex items-center gap-1"
                    >
                      Backend
                      <ChevronsUpDown className="h-3 w-3 opacity-60" />
                    </button>
                  </th>
                  <th className="hidden px-2 py-2.5 lg:table-cell">Exposed in SQL Lab</th>
                  <th className="hidden px-2 py-2.5 lg:table-cell">Allow run sync</th>
                  <th className="hidden px-2 py-2.5 xl:table-cell">Allow DML</th>
                  <th className="hidden px-2 py-2.5 xl:table-cell">Allow CSV upload</th>
                  <th className="hidden px-2 py-2.5 md:table-cell">Modified by</th>
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
                        <span className="bg-muted block h-5 w-20 rounded-full" />
                      </td>
                      <td className="hidden px-2 py-3 lg:table-cell">
                        <span className="bg-muted block h-5 w-12 rounded-full" />
                      </td>
                      <td className="hidden px-2 py-3 lg:table-cell">
                        <span className="bg-muted block h-5 w-12 rounded-full" />
                      </td>
                      <td className="hidden px-2 py-3 xl:table-cell">
                        <span className="bg-muted block h-5 w-12 rounded-full" />
                      </td>
                      <td className="hidden px-2 py-3 xl:table-cell">
                        <span className="bg-muted block h-5 w-12 rounded-full" />
                      </td>
                      <td className="hidden px-2 py-3 md:table-cell">
                        <span className="bg-muted block h-3 w-24 rounded" />
                      </td>
                      <td className="px-2 py-3">
                        <span className="bg-muted block h-3 w-6 rounded" />
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center">
                      <div className="mx-auto max-w-sm">
                        <p className="text-sm font-medium">No databases match your filters</p>
                        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                          Try a different search or backend filter, or add a new connection.
                        </p>
                        <div className="mt-4 flex justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setQ("");
                              setBackend("all");
                              setPage(1);
                            }}
                          >
                            Clear filters
                          </Button>
                          <Button size="sm" onClick={openCreate}>
                            Add database
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((d) => (
                    <tr
                      key={d.id}
                      className={`group hover:bg-muted/40 ${selected.has(d.id) ? "bg-muted/60" : ""}`}
                    >
                      <td className="px-3 py-3">
                        <Checkbox
                          checked={selected.has(d.id)}
                          onChange={(e) => {
                            const checked = (e.target as HTMLInputElement).checked;
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(d.id);
                              else next.delete(d.id);
                              return next;
                            });
                          }}
                          aria-label={`Select ${d.name}`}
                        />
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <span className="bg-muted grid h-6 w-6 place-items-center rounded-md">
                            <Database className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0">
                            <button
                              onClick={() => openEdit(d)}
                              className="text-left text-sm font-medium hover:underline"
                              title={d.name}
                            >
                              {d.name}
                            </button>
                            <div
                              className="text-muted-foreground hidden max-w-[28ch] truncate font-mono text-[11px] sm:block"
                              title={d.sqlalchemyUri}
                            >
                              {d.sqlalchemyUri}
                            </div>
                            <div className="mt-1 flex gap-1 sm:hidden">
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${BACKEND_BADGE[d.backend]}`}
                              >
                                {d.backend}
                              </span>
                              {d.exposedInSqlLab && (
                                <span className="bg-success text-success-foreground rounded-full px-1.5 py-0.5 text-[10px]">
                                  SQL Lab
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-2 py-2.5 sm:table-cell">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${BACKEND_BADGE[d.backend]}`}
                        >
                          {d.backend}
                        </span>
                      </td>
                      <td className="hidden px-2 py-2.5 lg:table-cell">
                        <BoolDot value={d.exposedInSqlLab} label="Exposed" />
                      </td>
                      <td className="hidden px-2 py-2.5 lg:table-cell">
                        <BoolDot value={d.allowRunSync} label="Run sync" />
                      </td>
                      <td className="hidden px-2 py-2.5 xl:table-cell">
                        <BoolDot value={d.allowDML} label="DML" />
                      </td>
                      <td className="hidden px-2 py-2.5 xl:table-cell">
                        <BoolDot value={d.allowCsvUpload} label="CSV" />
                      </td>
                      <td className="hidden px-2 py-2.5 md:table-cell">
                        <div className="flex items-center gap-2">
                          <span className="bg-secondary text-secondary-foreground grid h-6 w-6 place-items-center rounded-full text-[10px] font-medium">
                            {initials(d.modifiedBy.name)}
                          </span>
                          <div className="leading-tight">
                            <div className="text-xs">{d.modifiedBy.name}</div>
                            <div className="text-muted-foreground text-[11px]">
                              {formatDate(d.modified)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <div
                          className="relative flex justify-end"
                          ref={openMenu === d.id ? menuRef : undefined}
                        >
                          <button
                            onClick={() => setOpenMenu((v) => (v === d.id ? null : d.id))}
                            className="text-muted-foreground hover:border-input hover:bg-accent hover:text-foreground grid h-7 w-7 place-items-center rounded-md border border-transparent"
                            aria-label="Row actions"
                          >
                            <Eye className="h-4 w-4 sm:hidden" />
                            <span className="hidden sm:inline">
                              <ChevronsUpDown className="h-4 w-4" />
                            </span>
                          </button>
                          {openMenu === d.id && (
                            <div className="border-border bg-popover absolute top-8 right-0 z-20 w-56 rounded-md border p-1 shadow-lg">
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  openEdit(d);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </button>
                              <button
                                onClick={async () => {
                                  setOpenMenu(null);
                                  await handleTestConnection(d);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <PlugZap className="h-3.5 w-3.5" /> Test connection
                              </button>
                              <button
                                onClick={async () => {
                                  setOpenMenu(null);
                                  await handleScan(d);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <ScanSearch className="h-3.5 w-3.5" /> Scan schemas/tables
                              </button>
                              <div className="bg-border my-1 h-px" />
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleDelete(d.id);
                                }}
                                className="text-destructive hover:bg-destructive hover:text-destructive-foreground flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </button>
                              {scanResult && openMenu === d.id && (
                                <div className="text-muted-foreground bg-muted mt-1 rounded px-2 py-1.5 text-[11px]">
                                  {scanResult}
                                </div>
                              )}
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

          {/* Pagination */}
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
          Data layer: <code className="bg-muted rounded px-1 py-0.5">src/data/databases.ts</code>{" "}
          (canonical) +{" "}
          <code className="bg-muted rounded px-1 py-0.5">routes/api/databases/index.get.ts</code> —
          same source <code className="bg-muted rounded px-1 py-0.5">src/data/sqllab.ts</code>{" "}
          projects for SQL Lab. Mutations run client-side until a store is chosen.
        </p>
      </div>

      {/* Editor — slide-over */}
      {editorOpen && editing && (
        <div className="fixed inset-0 z-40 flex">
          <button
            aria-label="Close editor"
            onClick={() => setEditorOpen(false)}
            className="bg-foreground/20 flex-1 backdrop-blur-sm"
          />
          <div className="bg-card border-border flex w-full max-w-[640px] flex-col border-l shadow-xl">
            {/* header */}
            <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
              <div>
                <h2 className="text-[18px] font-semibold tracking-tight">
                  {isNew ? "Add database" : `Edit ${editing.name}`}
                </h2>
                <p className="text-muted-foreground mt-1 max-w-[44ch] text-xs leading-relaxed">
                  Configure the connection, performance, and SQL Lab behavior. Nothing is persisted
                  beyond this session — flagged as placeholder.
                </p>
              </div>
              <button
                onClick={() => setEditorOpen(false)}
                className="text-muted-foreground hover:bg-accent grid h-8 w-8 place-items-center rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* tabs */}
            <div className="border-border flex gap-1 overflow-x-auto border-b px-2 py-2">
              {EDITOR_TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setEditorTab(t.id)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${editorTab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {editorTab === "connection" && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium">Database name *</span>
                      <Input
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        placeholder="analytics"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium">Backend</span>
                      <div className="relative">
                        <select
                          value={editing.backend}
                          onChange={(e) =>
                            setEditing({ ...editing, backend: e.target.value as DatabaseBackend })
                          }
                          className="border-input bg-background h-9 w-full rounded-md border px-3 pr-8 text-sm"
                        >
                          {BACKENDS.filter((b) => b !== "all").map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2" />
                      </div>
                    </label>
                  </div>

                  <label className="space-y-1.5">
                    <span className="text-xs font-medium">SQLAlchemy URI *</span>
                    <Input
                      value={editing.sqlalchemyUri}
                      onChange={(e) => setEditing({ ...editing, sqlalchemyUri: e.target.value })}
                      placeholder="postgresql://user:***@host:5432/db"
                      className="font-mono text-xs"
                    />
                    <span className="text-muted-foreground text-[11px]">
                      Stored server-side only in the next phase — never exposed via VITE_*
                    </span>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-xs font-medium">Server certificate</span>
                    <textarea
                      value={editing.serverCert ?? ""}
                      onChange={(e) => setEditing({ ...editing, serverCert: e.target.value })}
                      placeholder="-----BEGIN CERTIFICATE-----"
                      rows={3}
                      className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-xs"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium">Extra params (JSON)</span>
                      <textarea
                        value={editing.extraParams ?? ""}
                        onChange={(e) => setEditing({ ...editing, extraParams: e.target.value })}
                        placeholder='{"connect_timeout": 10}'
                        rows={2}
                        className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-xs"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium">Secure extra</span>
                      <textarea
                        value={editing.secureExtra ?? ""}
                        onChange={(e) => setEditing({ ...editing, secureExtra: e.target.value })}
                        placeholder="server-side only"
                        rows={2}
                        className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-xs"
                      />
                    </label>
                  </div>

                  <label className="space-y-1.5">
                    <span className="text-xs font-medium">Encrypted extra</span>
                    <textarea
                      value={editing.encryptedExtra ?? ""}
                      onChange={(e) => setEditing({ ...editing, encryptedExtra: e.target.value })}
                      placeholder='{"key_path": "…"}'
                      rows={2}
                      className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-xs"
                    />
                  </label>

                  <div className="border-border rounded-lg border p-3">
                    <p className="text-xs font-medium">Access flags</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {[
                        { k: "exposedInSqlLab" as const, label: "Expose in SQL Lab" },
                        { k: "allowDML" as const, label: "Allow DML" },
                        { k: "allowCTA" as const, label: "Allow CTA" },
                        { k: "allowCsvUpload" as const, label: "Allow CSV upload" },
                        { k: "allowRunSync" as const, label: "Allow run sync" },
                        { k: "impersonateUser" as const, label: "Impersonate user" },
                      ].map((f) => (
                        <label key={f.k} className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={editing[f.k]}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                [f.k]: (e.target as HTMLInputElement).checked,
                              })
                            }
                          />
                          {f.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {editorTab === "performance" && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <Checkbox
                        checked={editing.cacheEnabled}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            cacheEnabled: (e.target as HTMLInputElement).checked,
                          })
                        }
                      />
                      Query cache
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium">Cache timeout (seconds)</span>
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
                      />
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <Checkbox
                        checked={editing.asyncExecution}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            asyncExecution: (e.target as HTMLInputElement).checked,
                          })
                        }
                      />
                      Asynchronous execution
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium">Concurrency</span>
                      <Input
                        type="number"
                        value={editing.concurrency ?? ""}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            concurrency: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        placeholder="4"
                      />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-medium">
                    <Checkbox
                      checked={editing.forceSqlLab}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          forceSqlLab: (e.target as HTMLInputElement).checked,
                        })
                      }
                    />
                    Force SQL Lab
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium">Template parameters (JSON)</span>
                    <textarea
                      value={editing.templateParams ?? ""}
                      onChange={(e) => setEditing({ ...editing, templateParams: e.target.value })}
                      placeholder='{"schema": "public"}'
                      rows={3}
                      className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-xs"
                    />
                  </label>
                </div>
              )}

              {editorTab === "sqllab" && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium">Query timeout (seconds)</span>
                      <Input
                        type="number"
                        value={editing.queryTimeout ?? ""}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            queryTimeout: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        placeholder="300"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium">Max rows</span>
                      <Input
                        type="number"
                        value={editing.maxRows ?? ""}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            maxRows: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        placeholder="100000"
                      />
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium">Default schema</span>
                      <Input
                        value={editing.defaultSchema ?? ""}
                        onChange={(e) => setEditing({ ...editing, defaultSchema: e.target.value })}
                        placeholder="public"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium">Default limit</span>
                      <Input
                        type="number"
                        value={editing.defaultLimit ?? ""}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            defaultLimit: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        placeholder="1000"
                      />
                    </label>
                  </div>
                  <div className="bg-muted/40 border-border rounded-md border p-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium">
                      <Clock3 className="h-3.5 w-3.5" /> Run sync vs async
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                      When "Allow run sync" is off and "Asynchronous execution" is on, SQL Lab will
                      poll for results. Used by BigQuery/Presto in the seed data.
                    </p>
                  </div>
                </div>
              )}

              {editorTab === "security" && (
                <div className="space-y-4">
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium">Owners (comma-separated)</span>
                    <Input
                      value={editing.owners.map((o) => o.name).join(", ")}
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
                      placeholder="Akmal Hazriq, Mira Chen"
                    />
                    <span className="text-muted-foreground text-[11px]">
                      Placeholder — in spec, owners gate visibility and row-level security.
                    </span>
                  </label>
                  <div className="border-border bg-muted/30 rounded-md border p-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium">
                      <Lock className="h-3.5 w-3.5" /> Row-level security
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                      Superset's RLS filters live under Admin — this editor only assigns owners.
                    </p>
                  </div>
                </div>
              )}

              {editorTab === "advanced" && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium">Version</span>
                      <Input
                        value={editing.version ?? ""}
                        onChange={(e) => setEditing({ ...editing, version: e.target.value })}
                        placeholder="15.3"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <Checkbox
                        checked={editing.schemaCacheEnabled}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            schemaCacheEnabled: (e.target as HTMLInputElement).checked,
                          })
                        }
                      />
                      Schema cache
                    </label>
                  </div>
                  <div className="border-border rounded-lg border p-3">
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <Checkbox
                        checked={editing.sshTunnelEnabled}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            sshTunnelEnabled: (e.target as HTMLInputElement).checked,
                          })
                        }
                      />
                      SSH tunnel
                    </label>
                    {editing.sshTunnelEnabled && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1.5">
                          <span className="text-xs font-medium">Host</span>
                          <Input
                            value={editing.sshTunnelHost ?? ""}
                            onChange={(e) =>
                              setEditing({ ...editing, sshTunnelHost: e.target.value })
                            }
                            placeholder="bastion.internal"
                            className="font-mono text-xs"
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-xs font-medium">Port</span>
                          <Input
                            type="number"
                            value={editing.sshTunnelPort ?? ""}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                sshTunnelPort:
                                  e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                            placeholder="22"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                  {editing.schemas.length > 0 && (
                    <div>
                      <p className="text-xs font-medium">
                        Schemas in seed ({editing.schemas.length})
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {editing.schemas.map((s) => (
                          <Badge key={s.name} variant="secondary" className="font-mono text-[11px]">
                            {s.name} · {s.tables.length} tables
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-border flex items-center gap-2 border-t px-5 py-4">
              <Button variant="outline" size="sm" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={testing}
                onClick={async () => {
                  if (!editing) return;
                  setTesting(true);
                  await new Promise((r) => setTimeout(r, 700));
                  setTesting(false);
                  showToast(
                    editing.sqlalchemyUri.trim()
                      ? "Test connection — success (placeholder)"
                      : "Test connection — missing URI",
                  );
                }}
              >
                <PlugZap className="mr-1.5 h-3.5 w-3.5" />
                {testing ? "Testing…" : "Test connection"}
              </Button>
              <Button size="sm" onClick={handleSave} className="ml-auto">
                {isNew ? "Create database" : "Save changes"}
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
