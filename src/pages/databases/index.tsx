import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clock3,
  Database,
  FlaskConical,
  Gauge,
  Lock,
  MoreHorizontal,
  Pencil,
  PlugZap,
  ScanSearch,
  Search,
  Settings2,
  Shield,
  Trash2,
  X,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
      className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-tight tabular-nums ${value ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}
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
    owners: [{ id: 1, name: "Admin User" }],
    version: "",
    schemaCacheEnabled: false,
    sshTunnelEnabled: false,
    sshTunnelHost: "",
    sshTunnelPort: null,
    modifiedBy: { id: 1, name: "Admin User" },
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
  const [toast, setToast] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);

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
        setRows(res.data);
        setTotal(res.total);
      })
      .catch(() => {
        if (!cancelled) showToast("We couldn't load databases. Try refreshing.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, backend, sortBy, sortDir, page, pageSize, reloadKey]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/databases/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        const msg =
          (j as { statusMessage?: string; message?: string })?.statusMessage ??
          (j as { message?: string })?.message ??
          `Delete failed (${res.status})`;
        throw new Error(msg);
      }
      showToast("Database deleted");
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

  const handleTestConnection = async (db: DatabaseConnection) => {
    setTesting(true);
    try {
      const res = await fetch("/api/databases/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ databaseId: db.id }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        message?: string;
        latencyMs?: number;
        backend?: string;
      };
      showToast(j.message ?? (j.ok ? "Connection succeeded" : "Connection failed"));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Test did not work. Try again.");
    } finally {
      setTesting(false);
    }
  };

  const handleScan = async (db: DatabaseConnection) => {
    setScanResult(null);
    try {
      const res = await fetch(`/api/databases/${db.id}/scan`, { method: "POST" });
      const j = (await res.json()) as { schemas: number; tables: number };
      if (!res.ok) throw new Error((j as unknown as { message?: string }).message ?? "Scan failed");
      setScanResult(`${j.schemas} schemas · ${j.tables} tables`);
      showToast(`Scanned ${db.name}: ${j.schemas} schemas, ${j.tables} tables`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Scan failed");
    }
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

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      showToast("Database name is required");
      return;
    }
    if (!editing.sqlalchemyUri.trim()) {
      showToast("SQLAlchemy URI is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: editing.name.trim(),
        backend: editing.backend,
        sqlalchemyUri: editing.sqlalchemyUri.trim(),
        serverCert: editing.serverCert,
        extraParams: editing.extraParams,
        impersonateUser: editing.impersonateUser,
        exposedInSqlLab: editing.exposedInSqlLab,
        allowDML: editing.allowDML,
        allowCTA: editing.allowCTA,
        allowCsvUpload: editing.allowCsvUpload,
        allowRunSync: editing.allowRunSync,
        secureExtra: editing.secureExtra,
        encryptedExtra: editing.encryptedExtra,
        cacheEnabled: editing.cacheEnabled,
        cacheTimeout: editing.cacheTimeout,
        asyncExecution: editing.asyncExecution,
        concurrency: editing.concurrency,
        forceSqlLab: editing.forceSqlLab,
        templateParams: editing.templateParams,
        queryTimeout: editing.queryTimeout,
        maxRows: editing.maxRows,
        defaultSchema: editing.defaultSchema,
        defaultLimit: editing.defaultLimit,
        version: editing.version,
        schemaCacheEnabled: editing.schemaCacheEnabled,
        sshTunnelEnabled: editing.sshTunnelEnabled,
        sshTunnelHost: editing.sshTunnelHost,
        sshTunnelPort: editing.sshTunnelPort,
        schemas: editing.schemas,
      };
      let res: Response;
      if (isNew) {
        res = await fetch("/api/databases", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(isNew ? payload : { ...payload, id: editing.id }),
        });
      } else {
        res = await fetch(`/api/databases/${editing.id}`, {
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
      const j = (await res.json()) as { name?: string };
      showToast(
        isNew
          ? `Database "${j.name ?? payload.name}" created`
          : `Database "${j.name ?? payload.name}" saved`,
      );
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

  return (
    <AppShell>
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        {/* Header — quiet metric */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="bg-muted text-muted-foreground grid h-7 w-7 place-items-center rounded-md">
                <Database className="h-4 w-4 stroke-[1.75]" />
              </div>
              <h1 className="text-[22px] font-semibold tracking-tight text-balance">Databases</h1>
              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
                {total}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 max-w-[60ch] text-sm leading-relaxed text-pretty">
              Connections that back SQL Lab and datasets. Test, scan, and configure exposure before
              sharing with editors.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={openCreate}
              className="shadow-sm focus-visible:ring-2 focus-visible:ring-offset-0"
            >
              <Database className="mr-1.5 h-3.5 w-3.5 stroke-[1.75]" />
              Add database
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="border-border bg-card mt-6 rounded-lg border shadow-sm">
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-[360px]">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 stroke-[1.75]" />
              <Input
                placeholder="Search by name…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="h-8 pr-3 pl-8 text-sm tracking-tight focus-visible:ring-2"
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
                  className="border-input bg-background focus-visible:ring-ring h-8 rounded-md border px-2 pr-7 text-xs font-medium tracking-tight tabular-nums transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                >
                  <option value="all">All backends</option>
                  {BACKENDS.filter((b) => b !== "all").map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75] opacity-60" />
              </div>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="border-input bg-background focus-visible:ring-ring h-8 rounded-md border px-2 pr-7 text-xs font-medium tracking-tight tabular-nums transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                >
                  <option value="modified">Sort: Modified</option>
                  <option value="name">Sort: Name</option>
                  <option value="backend">Sort: Backend</option>
                </select>
                <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75] opacity-60" />
              </div>
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="border-input bg-background text-muted-foreground hover:text-foreground focus-visible:ring-ring grid h-8 w-8 place-items-center rounded-md border transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                aria-label="Toggle sort direction"
              >
                <ChevronsUpDown className="h-4 w-4 stroke-[1.75]" />
              </button>
            </div>
          </div>

          <div className="border-border flex flex-wrap items-center gap-2 border-t px-3 py-2">
            <span className="text-muted-foreground hidden items-center gap-1.5 text-xs tracking-tight sm:inline-flex">
              <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-[11px] tracking-tight tabular-nums">
                exposed
              </span>{" "}
              = appears in SQL Lab selector
            </span>
            <div className="ml-auto flex items-center gap-2 text-xs tabular-nums">
              <span className="text-muted-foreground tracking-tight">
                {loading ? "Loading…" : `${total} connections`}
              </span>
              {(q || backend !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    setBackend("all");
                    setPage(1);
                  }}
                  className="border-input bg-background hover:bg-accent focus-visible:ring-ring inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium tracking-tight transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                >
                  <X className="h-3 w-3 stroke-[1.75]" />
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {selected.size > 0 && (
            <div className="border-border bg-muted/40 flex items-center gap-2 border-t px-3 py-2">
              <span className="text-xs font-medium tracking-tight tabular-nums">
                {selected.size} selected
              </span>
              <span className="bg-border h-4 w-px" aria-hidden />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs tracking-tight"
                onClick={async () => {
                  const ids = [...selected];
                  let ok = 0;
                  let lastErr = "";
                  for (const delId of ids) {
                    const res = await fetch(`/api/databases/${delId}`, { method: "DELETE" });
                    if (res.ok) ok += 1;
                    else {
                      const j = await res.json().catch(() => null);
                      lastErr = (j as { statusMessage?: string })?.statusMessage ?? "";
                    }
                  }
                  setSelected(new Set());
                  setReloadKey((k) => k + 1);
                  showToast(
                    ok ? `${ok} databases deleted` : lastErr || "Could not delete. Try again.",
                  );
                }}
              >
                <Trash2 className="mr-1 h-3 w-3 stroke-[1.75]" />
                Delete
              </Button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring ml-auto text-xs font-medium tracking-tight transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>

        {/* Table */}
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
                      type="button"
                      onClick={() => {
                        if (sortBy === "name") setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        else {
                          setSortBy("name");
                          setSortDir("asc");
                        }
                      }}
                      className="hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      Database
                      <ChevronsUpDown className="h-3 w-3 stroke-[1.75] opacity-60" />
                    </button>
                  </th>
                  <th className="hidden px-2 py-2.5 sm:table-cell">
                    <button
                      type="button"
                      onClick={() => {
                        if (sortBy === "backend") setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        else {
                          setSortBy("backend");
                          setSortDir("asc");
                        }
                      }}
                      className="hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      Backend
                      <ChevronsUpDown className="h-3 w-3 stroke-[1.75] opacity-60" />
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
                        <p className="text-sm font-medium tracking-tight text-balance">
                          No databases match your filters
                        </p>
                        <p className="text-muted-foreground mt-1 text-sm leading-relaxed text-pretty">
                          Try a different search or backend filter, or add a new connection.
                        </p>
                        <div className="mt-4 flex justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="focus-visible:ring-2"
                            onClick={() => {
                              setQ("");
                              setBackend("all");
                              setPage(1);
                            }}
                          >
                            Clear filters
                          </Button>
                          <Button
                            size="sm"
                            onClick={openCreate}
                            className="shadow-sm focus-visible:ring-2"
                          >
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
                      className={`group hover:bg-muted/40 transition-colors duration-150 ${selected.has(d.id) ? "bg-muted/60" : ""}`}
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
                            <Database className="h-3.5 w-3.5 stroke-[1.75]" />
                          </span>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => openEdit(d)}
                              className="focus-visible:ring-ring text-left text-sm font-medium tracking-tight text-balance hover:underline focus-visible:ring-2 focus-visible:outline-none"
                              title={d.name}
                            >
                              {d.name}
                            </button>
                            <div
                              className="text-muted-foreground hidden max-w-[28ch] truncate font-mono text-[11px] tracking-tight tabular-nums sm:block"
                              title={d.sqlalchemyUri}
                            >
                              {d.sqlalchemyUri}
                            </div>
                            <div className="mt-1 flex gap-1 sm:hidden">
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-tight tabular-nums ${BACKEND_BADGE[d.backend]}`}
                              >
                                {d.backend}
                              </span>
                              {d.exposedInSqlLab && (
                                <span className="bg-success text-success-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-tight">
                                  SQL Lab
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-2 py-2.5 sm:table-cell">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium tracking-tight tabular-nums ${BACKEND_BADGE[d.backend]}`}
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
                          <span className="bg-secondary text-secondary-foreground grid h-6 w-6 place-items-center rounded-full text-[10px] font-medium tracking-tight tabular-nums">
                            {initials(d.modifiedBy?.name ?? "Sample")}
                          </span>
                          <div className="leading-tight">
                            <div className="text-xs tracking-tight">
                              {d.modifiedBy?.name ?? "Sample"}
                            </div>
                            <div className="text-muted-foreground text-[11px] tracking-tight tabular-nums">
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
                            type="button"
                            onClick={() => setOpenMenu((v) => (v === d.id ? null : d.id))}
                            className="text-muted-foreground hover:border-input hover:bg-accent hover:text-foreground focus-visible:ring-ring grid h-7 w-7 place-items-center rounded-md border border-transparent transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                            aria-label="Row actions"
                          >
                            <MoreHorizontal className="h-4 w-4 stroke-[1.75]" />
                          </button>
                          {openMenu === d.id && (
                            <div className="border-border bg-popover animate-in fade-in slide-in-from-top-1 absolute top-8 right-0 z-20 w-56 rounded-md border p-1 shadow-xl duration-150">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenu(null);
                                  openEdit(d);
                                }}
                                className="hover:bg-accent focus-visible:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none"
                              >
                                <Pencil className="h-3.5 w-3.5 stroke-[1.75]" /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  setOpenMenu(null);
                                  await handleTestConnection(d);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none"
                              >
                                <PlugZap className="h-3.5 w-3.5 stroke-[1.75]" /> Test connection
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  setOpenMenu(null);
                                  await handleScan(d);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none"
                              >
                                <ScanSearch className="h-3.5 w-3.5 stroke-[1.75]" /> Scan
                                schemas/tables
                              </button>
                              <div className="bg-border my-1 h-px" />
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleDelete(d.id);
                                }}
                                className="text-destructive hover:bg-destructive hover:text-destructive-foreground flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none"
                              >
                                <Trash2 className="h-3.5 w-3.5 stroke-[1.75]" /> Delete
                              </button>
                              {scanResult && openMenu === d.id && (
                                <div className="text-muted-foreground bg-muted mt-1 rounded px-2 py-1.5 text-[11px] tracking-tight tabular-nums">
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
            <p className="text-muted-foreground text-xs tracking-tight text-pretty tabular-nums">
              {total === 0
                ? "No results"
                : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 focus-visible:ring-2"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4 stroke-[1.75]" />
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
                    type="button"
                    onClick={() => setPage(n)}
                    className={`grid h-7 min-w-7 place-items-center rounded-md border px-2 text-xs font-medium tracking-tight tabular-nums transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none ${n === page ? "border-primary bg-primary text-primary-foreground focus-visible:ring-primary/30" : "border-input bg-background hover:bg-accent focus-visible:ring-ring"}`}
                  >
                    {n}
                  </button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 focus-visible:ring-2"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                <ChevronRight className="h-4 w-4 stroke-[1.75]" />
              </Button>
            </div>
          </div>
        </div>

        <p className="text-muted-foreground mt-3 text-xs leading-relaxed text-pretty">
          Data via{" "}
          <code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px] tracking-tight tabular-nums">
            /api/databases
          </code>{" "}
          — Postgres + Drizzle.
        </p>
      </div>

      {/* Editor — slide-over */}
      {editorOpen && editing && (
        <div className="fixed inset-0 z-40 flex">
          <button
            type="button"
            aria-label="Close editor"
            onClick={() => setEditorOpen(false)}
            className="bg-foreground/20 flex-1 backdrop-blur-sm"
          />
          <div className="bg-card border-border flex w-full max-w-[640px] flex-col border-l shadow-xl">
            {/* header */}
            <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
              <div>
                <h2 className="text-[18px] font-semibold tracking-tight text-balance">
                  {isNew ? "Add database" : `Edit ${editing.name}`}
                </h2>
                <p className="text-muted-foreground mt-1 max-w-[44ch] text-xs leading-relaxed text-pretty">
                  Configure the connection, performance, and SQL Lab behavior. Nothing is persisted
                  beyond this session — flagged as placeholder.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="text-muted-foreground hover:bg-accent focus-visible:ring-ring grid h-8 w-8 place-items-center rounded-md transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
              >
                <X className="h-4 w-4 stroke-[1.75]" />
              </button>
            </div>

            {/* tabs */}
            <div className="border-border flex gap-1 overflow-x-auto border-b px-2 py-2">
              {EDITOR_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setEditorTab(t.id)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium tracking-tight whitespace-nowrap transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none ${editorTab === t.id ? "bg-primary text-primary-foreground focus-visible:ring-primary/30" : "text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring"}`}
                >
                  <t.icon className="h-3.5 w-3.5 stroke-[1.75]" />
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {editorTab === "connection" && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium tracking-tight">Database name *</span>
                      <Input
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        placeholder="analytics"
                        className="focus-visible:ring-2"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium tracking-tight">Backend</span>
                      <div className="relative">
                        <select
                          value={editing.backend}
                          onChange={(e) =>
                            setEditing({ ...editing, backend: e.target.value as DatabaseBackend })
                          }
                          className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 pr-8 text-sm tracking-tight tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none"
                        >
                          {BACKENDS.filter((b) => b !== "all").map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 stroke-[1.75] opacity-60" />
                      </div>
                    </label>
                  </div>

                  <label className="space-y-1.5">
                    <span className="text-xs font-medium tracking-tight">SQLAlchemy URI *</span>
                    <Input
                      value={editing.sqlalchemyUri}
                      onChange={(e) => setEditing({ ...editing, sqlalchemyUri: e.target.value })}
                      placeholder="postgresql://user:***@host:5432/db"
                      className="font-mono text-xs tracking-tight tabular-nums focus-visible:ring-2"
                    />
                    <span className="text-muted-foreground text-[11px] tracking-tight text-pretty">
                      Stored server-side only in the next phase — never exposed via VITE_*
                    </span>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-xs font-medium tracking-tight">Server certificate</span>
                    <textarea
                      value={editing.serverCert ?? ""}
                      onChange={(e) => setEditing({ ...editing, serverCert: e.target.value })}
                      placeholder="-----BEGIN CERTIFICATE-----"
                      rows={3}
                      className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 font-mono text-xs tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium tracking-tight">
                        Extra params (JSON)
                      </span>
                      <textarea
                        value={editing.extraParams ?? ""}
                        onChange={(e) => setEditing({ ...editing, extraParams: e.target.value })}
                        placeholder='{"connect_timeout": 10}'
                        rows={2}
                        className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 font-mono text-xs tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium tracking-tight">Secure extra</span>
                      <textarea
                        value={editing.secureExtra ?? ""}
                        onChange={(e) => setEditing({ ...editing, secureExtra: e.target.value })}
                        placeholder="server-side only"
                        rows={2}
                        className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 font-mono text-xs tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      />
                    </label>
                  </div>

                  <label className="space-y-1.5">
                    <span className="text-xs font-medium tracking-tight">Encrypted extra</span>
                    <textarea
                      value={editing.encryptedExtra ?? ""}
                      onChange={(e) => setEditing({ ...editing, encryptedExtra: e.target.value })}
                      placeholder='{"key_path": "…"}'
                      rows={2}
                      className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 font-mono text-xs tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    />
                  </label>

                  <div className="border-border rounded-lg border p-3">
                    <p className="text-xs font-medium tracking-tight">Access flags</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {[
                        { k: "exposedInSqlLab" as const, label: "Expose in SQL Lab" },
                        { k: "allowDML" as const, label: "Allow DML" },
                        { k: "allowCTA" as const, label: "Allow CTA" },
                        { k: "allowCsvUpload" as const, label: "Allow CSV upload" },
                        { k: "allowRunSync" as const, label: "Allow run sync" },
                        { k: "impersonateUser" as const, label: "Impersonate user" },
                      ].map((f) => (
                        <label key={f.k} className="flex items-center gap-2 text-xs tracking-tight">
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
                    <label className="flex items-center gap-2 text-xs font-medium tracking-tight">
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
                      <span className="text-xs font-medium tracking-tight">
                        Cache timeout (seconds)
                      </span>
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
                        className="tabular-nums focus-visible:ring-2"
                      />
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-xs font-medium tracking-tight">
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
                      <span className="text-xs font-medium tracking-tight">Concurrency</span>
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
                        className="tabular-nums focus-visible:ring-2"
                      />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-medium tracking-tight">
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
                    <span className="text-xs font-medium tracking-tight">
                      Template parameters (JSON)
                    </span>
                    <textarea
                      value={editing.templateParams ?? ""}
                      onChange={(e) => setEditing({ ...editing, templateParams: e.target.value })}
                      placeholder='{"schema": "public"}'
                      rows={3}
                      className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 font-mono text-xs tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    />
                  </label>
                </div>
              )}

              {editorTab === "sqllab" && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium tracking-tight">
                        Query timeout (seconds)
                      </span>
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
                        className="tabular-nums focus-visible:ring-2"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium tracking-tight">Max rows</span>
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
                        className="tabular-nums focus-visible:ring-2"
                      />
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium tracking-tight">Default schema</span>
                      <Input
                        value={editing.defaultSchema ?? ""}
                        onChange={(e) => setEditing({ ...editing, defaultSchema: e.target.value })}
                        placeholder="public"
                        className="font-mono text-xs tracking-tight focus-visible:ring-2"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium tracking-tight">Default limit</span>
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
                        className="tabular-nums focus-visible:ring-2"
                      />
                    </label>
                  </div>
                  <div className="bg-muted/40 border-border rounded-md border p-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium tracking-tight">
                      <Clock3 className="h-3.5 w-3.5 stroke-[1.75]" /> Run sync vs async
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs leading-relaxed text-pretty">
                      When "Allow run sync" is off and "Asynchronous execution" is on, SQL Lab will
                      poll for results. Used by BigQuery/Presto in the seed data.
                    </p>
                  </div>
                </div>
              )}

              {editorTab === "security" && (
                <div className="space-y-4">
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
                      className="focus-visible:ring-2"
                    />
                    <span className="text-muted-foreground text-[11px] tracking-tight text-pretty">
                      Placeholder — in spec, owners gate visibility and row-level security.
                    </span>
                  </label>
                  <div className="border-border bg-muted/30 rounded-md border p-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium tracking-tight">
                      <Lock className="h-3.5 w-3.5 stroke-[1.75]" /> Row-level security
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs leading-relaxed text-pretty">
                      Superset's RLS filters live under Admin — this editor only assigns owners.
                    </p>
                  </div>
                </div>
              )}

              {editorTab === "advanced" && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium tracking-tight">Version</span>
                      <Input
                        value={editing.version ?? ""}
                        onChange={(e) => setEditing({ ...editing, version: e.target.value })}
                        placeholder="15.3"
                        className="font-mono text-xs tracking-tight tabular-nums focus-visible:ring-2"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium tracking-tight">
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
                    <label className="flex items-center gap-2 text-xs font-medium tracking-tight">
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
                          <span className="text-xs font-medium tracking-tight">Host</span>
                          <Input
                            value={editing.sshTunnelHost ?? ""}
                            onChange={(e) =>
                              setEditing({ ...editing, sshTunnelHost: e.target.value })
                            }
                            placeholder="bastion.internal"
                            className="font-mono text-xs tracking-tight focus-visible:ring-2"
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-xs font-medium tracking-tight">Port</span>
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
                            className="tabular-nums focus-visible:ring-2"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                  {editing.schemas.length > 0 && (
                    <div>
                      <p className="text-xs font-medium tracking-tight">
                        Schemas in seed ({editing.schemas.length})
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {editing.schemas.map((s) => (
                          <Badge
                            key={s.name}
                            variant="secondary"
                            className="font-mono text-[11px] tracking-tight tabular-nums"
                          >
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditorOpen(false)}
                className="focus-visible:ring-2"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={testing}
                className="focus-visible:ring-2"
                onClick={async () => {
                  if (!editing) return;
                  if (!editing.sqlalchemyUri.trim()) {
                    showToast("Test connection: missing URI");
                    return;
                  }
                  setTesting(true);
                  try {
                    const res = await fetch("/api/databases/test", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify(
                        isNew
                          ? { backend: editing.backend, sqlalchemyUri: editing.sqlalchemyUri }
                          : { databaseId: editing.id },
                      ),
                    });
                    const j = (await res.json()) as { message?: string; ok?: boolean };
                    showToast(
                      j.message ??
                        (j.ok ? "Connection succeeded" : "Test did not work. Try again."),
                    );
                  } catch (e) {
                    showToast(e instanceof Error ? e.message : "Test did not work. Try again.");
                  } finally {
                    setTesting(false);
                  }
                }}
              >
                <PlugZap className="mr-1.5 h-3.5 w-3.5 stroke-[1.75]" />
                {testing ? "Testing…" : "Test connection"}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="ml-auto shadow-sm focus-visible:ring-2"
                disabled={saving}
              >
                {saving ? "Saving…" : isNew ? "Create database" : "Save changes"}
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
