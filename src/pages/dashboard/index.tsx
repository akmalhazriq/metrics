import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  Eye,
  Heart,
  Mail,
  MoreHorizontal,
  Pencil,
  Search,
  Share2,
  Star,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { ApiError, fetchList, mutate } from "@/lib/api";
import type { Dashboard, DashboardStatus } from "@/types/dashboard";

const STATUS_LABEL: Record<DashboardStatus, string> = {
  published: "Published",
  draft: "Draft",
  archived: "Archived",
};

const STATUS_VARIANT: Record<DashboardStatus, "success" | "warning" | "muted"> = {
  published: "success",
  draft: "warning",
  archived: "muted",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function DashboardListPage() {
  const navigate = useNavigate();
  // --- filters / sort / pagination ---
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState<DashboardStatus | "all">("all");
  const [owner, setOwner] = useState("");
  const [tag, setTag] = useState("");
  const [onlyFavorite, setOnlyFavorite] = useState(false);
  const [sortBy, setSortBy] = useState<"title" | "modified" | "status">("modified");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  // --- data ---
  const [rows, setRows] = useState<Dashboard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [confirmRow, setConfirmRow] = useState<Dashboard | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  // close menu on outside click + Escape
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // debounce search input (input stays immediate, API call waits 300ms)
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  // fetch from API via shared typed client
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchList<Dashboard>("/api/dashboards", {
          q: debouncedQ || undefined,
          status: status !== "all" ? status : undefined,
          owner: owner || undefined,
          tag: tag || undefined,
          favorite: onlyFavorite || undefined,
          sortBy,
          sortDir,
          page,
          pageSize,
        });
        if (cancelled) return;
        setRows(res.data);
        setTotal(res.total);
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "We couldn't load dashboards. Try refreshing.";
        setError(msg);
        showToast(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [debouncedQ, status, owner, tag, onlyFavorite, sortBy, sortDir, page, pageSize]);

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someOnPageSelected = rows.some((r) => selected.has(r.id));

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const uniqueOwners = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => (r.owners ?? []).forEach((o) => s.add(o?.name ?? "Sample")));
    return Array.from(s).slice(0, 8);
  }, [rows]);

  const handleToggleFavorite = async (id: number) => {
    const prev = rows.find((d) => d.id === id);
    const nextFav = !prev?.favorite;
    setRows((list) => list.map((d) => (d.id === id ? { ...d, favorite: nextFav } : d)));
    try {
      const res = await fetch(`/api/dashboards/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: nextFav }),
      });
      if (!res.ok) throw new Error();
      const j = (await res.json()) as { favorite: boolean };
      setRows((list) => list.map((d) => (d.id === id ? { ...d, favorite: j.favorite } : d)));
      showToast(j.favorite ? "Added to favorites" : "Removed from favorites");
    } catch {
      setRows((list) => list.map((d) => (d.id === id ? { ...d, favorite: !nextFav } : d)));
      showToast("Could not update favorite");
    }
  };

  const handleDelete = async (row: Dashboard) => {
    try {
      await mutate(`/api/dashboards/${row.id}`, "DELETE");
      setRows((prev) => prev.filter((d) => d.id !== row.id));
      setSelected((prev) => {
        const n = new Set(prev);
        n.delete(row.id);
        return n;
      });
      setTotal((t) => Math.max(0, t - 1));
      showToast("Dashboard deleted");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not delete dashboard";
      showToast(msg);
    }
  };

  const handleDuplicate = async (id: number) => {
    const src = rows.find((d) => d.id === id);
    if (!src) return;
    try {
      const res = await fetch("/api/dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${src.title} (copy)`,
          status: "draft",
          description: src.description,
        }),
      });
      if (!res.ok) throw new Error();
      const j = (await res.json()) as { data: Dashboard };
      setPage(1);
      const created: Dashboard = {
        id: j.data.id,
        title: j.data.title,
        slug: j.data.slug,
        status: j.data.status as Dashboard["status"],
        modifiedBy: { id: 1, name: "Admin User" },
        modified: new Date().toISOString(),
        createdBy: { id: 1, name: "Admin User" },
        owners: [{ id: 1, name: "Admin User" }],
        tags: [],
        favorite: false,
        description: src.description,
        layout: src.layout,
      };
      setRows((prev) => [created, ...prev].slice(0, pageSize));
      setTotal((t) => t + 1);
      showToast("Dashboard duplicated as draft");
    } catch {
      showToast("Could not duplicate dashboard");
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    const ids = [...selected];
    let ok = 0;
    let fail = 0;
    let lastErr = "";
    for (const id of ids) {
      try {
        await mutate(`/api/dashboards/${id}`, "DELETE");
        ok++;
      } catch (e) {
        fail++;
        lastErr = e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
      }
    }
    if (ok) {
      setRows((prev) => prev.filter((d) => !selected.has(d.id)));
      setTotal((t) => Math.max(0, t - ok));
    }
    if (ok && !fail) showToast(`Deleted ${ok} dashboards`);
    else if (ok && fail)
      showToast(`Deleted ${ok} of ${ok + fail} dashboards. ${fail} failed: ${lastErr}`);
    else if (!ok && fail) showToast(lastErr || "Could not delete. Try again.");
    setSelected(new Set());
  };

  const handleExport = (ids?: number[]) => {
    const targets = ids
      ? rows.filter((d) => ids.includes(d.id))
      : rows.filter((d) => selected.has(d.id));
    if (targets.length === 0) {
      showToast("Nothing to export");
      return;
    }
    const blob = new Blob([JSON.stringify(targets, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dashboards-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${targets.length} dashboards`);
  };

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled dashboard" }),
      });
      if (!res.ok) throw new Error();
      const j = (await res.json()) as { data: Dashboard };
      setPage(1);
      setRows((prev) => {
        const created: Dashboard = {
          id: j.data.id,
          title: j.data.title,
          slug: j.data.slug,
          status: j.data.status as Dashboard["status"],
          modifiedBy: { id: 1, name: "Admin User" },
          modified: new Date().toISOString(),
          createdBy: { id: 1, name: "Admin User" },
          owners: [{ id: 1, name: "Admin User" }],
          tags: [],
          favorite: false,
        };
        return [created, ...prev].slice(0, pageSize);
      });
      setTotal((t) => t + 1);
      showToast("Draft dashboard created");
    } catch {
      showToast("Could not create dashboard");
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        {/* Header — clinical, dashboard-count as coherence signal */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[22px] font-semibold tracking-tight text-balance">Dashboards</h1>
              <span
                aria-label={`${total} dashboards`}
                className="bg-muted text-muted-foreground inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-medium tabular-nums"
              >
                {total}
              </span>
            </div>
            <p className="text-muted-foreground mt-1.5 max-w-[52ch] text-sm leading-relaxed text-pretty">
              Curated views of your data. Search, filter, and bulk-manage dashboards before sharing
              with stakeholders.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled
              title="ZIP/JSON import requires file storage — configure in Settings"
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden />
              Import
            </Button>
            <Button size="sm" onClick={handleCreate} className="gap-1.5 shadow-sm">
              Create dashboard
            </Button>
          </div>
        </div>

        {/* Toolbar — restrained, density-first */}
        <div className="border-border bg-card mt-6 overflow-hidden rounded-lg border shadow-sm">
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-[360px]">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 stroke-[1.75]"
                aria-hidden
              />
              <Input
                id="dashboard-search"
                data-list-search
                placeholder="Search by title…"
                title="Search ( / )"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="placeholder:text-muted-foreground/70 h-8 pl-8 text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Filter by status"
                className="border-input bg-background inline-flex items-center gap-0.5 rounded-md border p-0.5"
              >
                {(["all", "published", "draft", "archived"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={status === s}
                    onClick={() => {
                      setStatus(s);
                      setPage(1);
                    }}
                    className={`focus-visible:ring-ring rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none motion-reduce:transition-none ${
                      status === s
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground active:bg-accent/80"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <button
                type="button"
                aria-pressed={onlyFavorite}
                onClick={() => setOnlyFavorite((v) => !v)}
                className={`focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none motion-reduce:transition-none ${
                  onlyFavorite
                    ? "border-favorite bg-favorite text-favorite-foreground shadow-sm"
                    : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground active:bg-accent/80"
                }`}
              >
                <Star
                  className={`h-3.5 w-3.5 stroke-[1.75] ${onlyFavorite ? "fill-current" : ""}`}
                  aria-hidden
                />
                Favorites
              </button>

              <div className="hidden items-center gap-2 sm:flex">
                <div className="relative">
                  <select
                    value={tag}
                    onChange={(e) => {
                      setTag(e.target.value);
                      setPage(1);
                    }}
                    aria-label="Filter by tag"
                    className="border-input bg-background text-foreground focus-visible:ring-ring h-8 rounded-md border px-2.5 pr-7 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <option value="">All tags</option>
                    <option value="kpi">kpi</option>
                    <option value="revenue">revenue</option>
                    <option value="product">product</option>
                    <option value="ops">ops</option>
                    <option value="marketing">marketing</option>
                    <option value="infra">infra</option>
                    <option value="experiment">experiment</option>
                  </select>
                  <ChevronDown
                    className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75]"
                    aria-hidden
                  />
                </div>

                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value as typeof sortBy);
                      setSortDir("desc");
                    }}
                    aria-label="Sort by"
                    className="border-input bg-background focus-visible:ring-ring h-8 rounded-md border px-2.5 pr-7 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <option value="modified">Sort: Modified</option>
                    <option value="title">Sort: Title</option>
                    <option value="status">Sort: Status</option>
                  </select>
                  <ChevronDown
                    className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75]"
                    aria-hidden
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                  className="border-input bg-background text-muted-foreground hover:text-foreground hover:bg-accent active:bg-accent/80 focus-visible:ring-ring grid h-8 w-8 place-items-center rounded-md border transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                  aria-label={`Sort ${sortDir === "asc" ? "ascending" : "descending"} — click to toggle`}
                  title={
                    sortDir === "asc"
                      ? "Ascending — click for descending"
                      : "Descending — click for ascending"
                  }
                >
                  {sortDir === "asc" ? (
                    <ChevronUp className="h-4 w-4 stroke-[1.75]" aria-hidden />
                  ) : (
                    <ChevronDown className="h-4 w-4 stroke-[1.75]" aria-hidden />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Secondary filters row — quiet, low contrast */}
          <div className="border-border bg-muted/20 flex flex-wrap items-center gap-2 border-t px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Users className="text-muted-foreground h-3.5 w-3.5 stroke-[1.75]" aria-hidden />
              <Input
                placeholder="Filter by owner…"
                value={owner}
                onChange={(e) => {
                  setOwner(e.target.value);
                  setPage(1);
                }}
                className="placeholder:text-muted-foreground/70 h-7 w-[160px] text-xs"
                aria-label="Filter by owner"
              />
              {uniqueOwners.length > 0 && (
                <span className="text-muted-foreground hidden text-xs lg:inline">
                  Try:{" "}
                  {uniqueOwners.slice(0, 3).map((n, i) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setOwner(n);
                        setPage(1);
                      }}
                      className="text-foreground focus-visible:ring-ring rounded-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                    >
                      {i > 0 ? ", " : ""}
                      {n}
                    </button>
                  ))}
                </span>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2 text-xs">
              <span className="text-muted-foreground tabular-nums" aria-live="polite">
                {loading ? "Loading…" : `${total} dashboards`}
              </span>
              {(q || status !== "all" || owner || tag || onlyFavorite) && (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    setStatus("all");
                    setOwner("");
                    setTag("");
                    setOnlyFavorite(false);
                    setPage(1);
                  }}
                  className="border-input bg-background hover:bg-accent active:bg-accent/80 focus-visible:ring-ring inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                >
                  <X className="h-3 w-3 stroke-[1.75]" aria-hidden />
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Bulk bar — always rendered when rows exist; actions gate on selection */}
          {rows.length > 0 && (
            <div className="border-border bg-muted/40 flex flex-wrap items-center gap-2 border-t px-3 py-2">
              <span className="text-xs font-medium tabular-nums" aria-live="polite">
                {selected.size === 0 ? "No selection" : `${selected.size} selected`}
              </span>
              <span className="bg-border h-4 w-px" aria-hidden />
              <Button
                variant="secondary"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={selected.size === 0}
                onClick={() => handleExport()}
              >
                <Download className="h-3 w-3 stroke-[1.75]" aria-hidden />
                Export
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={selected.size === 0}
                onClick={() => setConfirmBulk(true)}
              >
                <Trash2 className="h-3 w-3 stroke-[1.75]" aria-hidden />
                Delete
              </Button>
              {allOnPageSelected && total > rows.length && (
                <button
                  type="button"
                  onClick={() =>
                    showToast(
                      `All ${total} matching filters selected. Bulk actions will apply to them.`,
                    )
                  }
                  className="text-primary hover:bg-accent active:bg-accent/80 focus-visible:ring-ring ml-1 rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                >
                  Select all {total} matching filter
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                disabled={selected.size === 0}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring ml-auto text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 motion-reduce:transition-none"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive mt-4 rounded-md border px-3 py-2.5 text-xs leading-relaxed"
          >
            {error}
          </div>
        )}

        {/* Table — dense, tool-grade; horizontal scroll on narrow */}
        <div className="border-border bg-card mt-4 overflow-hidden rounded-lg border shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border bg-muted/40 text-muted-foreground border-b text-left text-xs font-medium tracking-wide">
                  <th scope="col" className="w-8 px-3 py-2.5">
                    <Checkbox
                      checked={allOnPageSelected}
                      indeterminate={!allOnPageSelected && someOnPageSelected}
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
                  <th
                    scope="col"
                    aria-sort={
                      sortBy === "title" ? (sortDir === "asc" ? "ascending" : "descending") : "none"
                    }
                    className="px-2 py-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (sortBy !== "title") {
                          setSortBy("title");
                          setSortDir("desc");
                        } else if (sortDir === "desc") {
                          setSortDir("asc");
                        } else {
                          setSortBy("modified");
                          setSortDir("desc");
                        }
                      }}
                      className="hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                      aria-label={`Sort by title ${sortBy === "title" ? (sortDir === "asc" ? "ascending" : "descending") : ""}`.trim()}
                    >
                      Title
                      {sortBy === "title" ? (
                        sortDir === "asc" ? (
                          <ChevronUp className="h-3 w-3 stroke-[1.75]" aria-hidden />
                        ) : (
                          <ChevronDown className="h-3 w-3 stroke-[1.75]" aria-hidden />
                        )
                      ) : (
                        <ChevronDown className="h-3 w-3 stroke-[1.75] opacity-30" aria-hidden />
                      )}
                    </button>
                  </th>
                  <th scope="col" className="hidden px-2 py-2.5 sm:table-cell">
                    Modified by
                  </th>
                  <th
                    scope="col"
                    aria-sort={
                      sortBy === "status"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className="px-2 py-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (sortBy !== "status") {
                          setSortBy("status");
                          setSortDir("desc");
                        } else if (sortDir === "desc") {
                          setSortDir("asc");
                        } else {
                          setSortBy("modified");
                          setSortDir("desc");
                        }
                      }}
                      className="hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                      aria-label={`Sort by status ${sortBy === "status" ? (sortDir === "asc" ? "ascending" : "descending") : ""}`.trim()}
                    >
                      Status
                      {sortBy === "status" ? (
                        sortDir === "asc" ? (
                          <ChevronUp className="h-3 w-3 stroke-[1.75]" aria-hidden />
                        ) : (
                          <ChevronDown className="h-3 w-3 stroke-[1.75]" aria-hidden />
                        )
                      ) : (
                        <ChevronDown className="h-3 w-3 stroke-[1.75] opacity-30" aria-hidden />
                      )}
                    </button>
                  </th>
                  <th
                    scope="col"
                    aria-sort={
                      sortBy === "modified"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className="hidden px-2 py-2.5 md:table-cell"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (sortBy !== "modified") {
                          setSortBy("modified");
                          setSortDir("desc");
                        } else if (sortDir === "desc") {
                          setSortDir("asc");
                        } else {
                          setSortDir("desc");
                        }
                      }}
                      className="hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                      aria-label={`Sort by modified ${sortBy === "modified" ? (sortDir === "asc" ? "ascending" : "descending") : ""}`.trim()}
                    >
                      Modified
                      {sortBy === "modified" ? (
                        sortDir === "asc" ? (
                          <ChevronUp className="h-3 w-3 stroke-[1.75]" aria-hidden />
                        ) : (
                          <ChevronDown className="h-3 w-3 stroke-[1.75]" aria-hidden />
                        )
                      ) : (
                        <ChevronDown className="h-3 w-3 stroke-[1.75] opacity-30" aria-hidden />
                      )}
                    </button>
                  </th>
                  <th scope="col" className="hidden px-2 py-2.5 lg:table-cell">
                    Created by
                  </th>
                  <th scope="col" className="hidden px-2 py-2.5 xl:table-cell">
                    Owners
                  </th>
                  <th scope="col" className="hidden px-2 py-2.5 lg:table-cell">
                    Tags
                  </th>
                  <th scope="col" className="w-10 px-2 py-2.5 text-center" title="Favorite">
                    <Star className="mx-auto h-3.5 w-3.5 stroke-[1.75]" aria-hidden />
                  </th>
                  <th scope="col" className="w-10 px-2 py-2.5" aria-hidden />
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse motion-reduce:animate-none" aria-hidden>
                      <td className="px-3 py-3">
                        <span className="bg-muted block h-3 w-3 rounded-sm" />
                      </td>
                      <td className="px-2 py-3">
                        <span className="bg-muted block h-3 w-40 rounded-sm" />
                      </td>
                      <td className="hidden px-2 py-3 sm:table-cell">
                        <span className="bg-muted block h-3 w-20 rounded-sm" />
                      </td>
                      <td className="px-2 py-3">
                        <span className="bg-muted block h-5 w-16 rounded-full" />
                      </td>
                      <td className="hidden px-2 py-3 md:table-cell">
                        <span className="bg-muted block h-3 w-24 rounded-sm" />
                      </td>
                      <td className="hidden px-2 py-3 lg:table-cell">
                        <span className="bg-muted block h-3 w-20 rounded-sm" />
                      </td>
                      <td className="hidden px-2 py-3 xl:table-cell">
                        <span className="bg-muted block h-3 w-24 rounded-sm" />
                      </td>
                      <td className="hidden px-2 py-3 lg:table-cell">
                        <span className="bg-muted block h-3 w-16 rounded-sm" />
                      </td>
                      <td className="px-2 py-3">
                        <span className="bg-muted mx-auto block h-4 w-4 rounded-sm" />
                      </td>
                      <td className="px-2 py-3">
                        <span className="bg-muted block h-3 w-6 rounded-sm" />
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center">
                      <div className="mx-auto max-w-sm">
                        <p className="text-sm font-medium tracking-tight text-balance">
                          No dashboards match your filters
                        </p>
                        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed text-pretty">
                          Try adjusting search, status, owner, or tags. Or create a new dashboard
                          from scratch.
                        </p>
                        <div className="mt-4 flex justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setQ("");
                              setStatus("all");
                              setOwner("");
                              setTag("");
                              setOnlyFavorite(false);
                              setPage(1);
                            }}
                          >
                            Clear filters
                          </Button>
                          <Button size="sm" onClick={handleCreate}>
                            Create dashboard
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((d) => (
                    <tr
                      key={d.id}
                      className={`group transition-colors duration-150 motion-reduce:transition-none ${selected.has(d.id) ? "bg-muted/60" : "hover:bg-muted/40"}`}
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
                          aria-label={`Select ${d.title}`}
                        />
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleFavorite(d.id)}
                            className={`hover:bg-accent active:bg-accent/80 focus-visible:ring-ring mt-0.5 grid h-5 w-5 place-items-center rounded transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none ${d.favorite ? "text-favorite" : "text-muted-foreground"}`}
                            aria-label={d.favorite ? "Remove favorite" : "Add favorite"}
                            aria-pressed={!!d.favorite}
                          >
                            <Star
                              className={`h-3.5 w-3.5 stroke-[1.75] ${d.favorite ? "fill-current" : ""}`}
                              aria-hidden
                            />
                          </button>
                          <div className="min-w-0">
                            <Link
                              to={`/dashboard/${d.id}`}
                              className="focus-visible:ring-ring line-clamp-1 rounded-sm text-sm leading-tight font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                              title={d.title}
                            >
                              {d.title}
                            </Link>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              {d.certified && (
                                <span className="bg-info text-info-foreground inline-flex items-center rounded px-1 py-0.5 text-[10px] font-semibold tracking-wide">
                                  CERTIFIED
                                </span>
                              )}
                              <span className="text-muted-foreground hidden truncate font-mono text-[11px] sm:inline">
                                /{d.slug}
                              </span>
                            </div>
                            {/* Mobile meta */}
                            <div className="mt-1 flex flex-wrap gap-1.5 sm:hidden">
                              <Badge variant={STATUS_VARIANT[d.status]}>
                                {STATUS_LABEL[d.status]}
                              </Badge>
                              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                                {formatDate(d.modified)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-2 py-3 sm:table-cell">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="bg-secondary text-secondary-foreground grid h-6 w-6 place-items-center rounded-full text-[10px] font-medium tabular-nums">
                            {initials(d.modifiedBy?.name ?? "Sample")}
                          </span>
                          <span className="text-xs tracking-tight">
                            {d.modifiedBy?.name ?? "Sample"}
                          </span>
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <Badge variant={STATUS_VARIANT[d.status]} className="hidden sm:inline-flex">
                          {STATUS_LABEL[d.status]}
                        </Badge>
                        <span className="text-muted-foreground text-xs sm:hidden">
                          {STATUS_LABEL[d.status]}
                        </span>
                      </td>
                      <td className="hidden px-2 py-3 md:table-cell">
                        <div className="text-xs leading-tight tabular-nums">
                          <div>{formatDate(d.modified)}</div>
                          <div className="text-muted-foreground font-mono text-[11px]">
                            {formatTime(d.modified)}
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-2 py-3 lg:table-cell">
                        <span className="text-muted-foreground text-xs tracking-tight">
                          {d.createdBy?.name ?? "Sample"}
                        </span>
                      </td>
                      <td className="hidden px-2 py-3 xl:table-cell">
                        <span className="inline-flex items-center">
                          {d.owners.slice(0, 3).map((o) => (
                            <span
                              key={o.id}
                              title={o?.name ?? "Sample"}
                              className="border-card bg-muted -ml-1 grid h-6 w-6 place-items-center rounded-full border text-[10px] font-medium tabular-nums first:ml-0"
                            >
                              {initials(o?.name ?? "Sample")}
                            </span>
                          ))}
                          {d.owners.length > 3 && (
                            <span className="text-muted-foreground ml-1 text-xs tabular-nums">
                              +{d.owners.length - 3}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="hidden px-2 py-3 lg:table-cell">
                        <span className="flex flex-wrap gap-1">
                          {d.tags.slice(0, 2).map((t) => (
                            <Badge key={t} variant="secondary" className="text-[11px]">
                              {t}
                            </Badge>
                          ))}
                          {d.tags.length > 2 && (
                            <span className="text-muted-foreground text-xs tabular-nums">
                              +{d.tags.length - 2}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(d.id)}
                          className={`hover:bg-accent active:bg-accent/80 focus-visible:ring-ring grid h-6 w-6 place-items-center rounded transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none ${d.favorite ? "text-favorite" : "text-muted-foreground/60 hover:text-muted-foreground"}`}
                          aria-label="Toggle favorite"
                          aria-pressed={!!d.favorite}
                        >
                          <Heart
                            className={`h-3.5 w-3.5 stroke-[1.75] ${d.favorite ? "text-favorite fill-current" : ""}`}
                            aria-hidden
                          />
                        </button>
                      </td>
                      <td className="px-2 py-3">
                        <div
                          className="relative flex justify-end"
                          ref={openMenu === d.id ? menuRef : undefined}
                        >
                          <button
                            type="button"
                            onClick={() => setOpenMenu((v) => (v === d.id ? null : d.id))}
                            className="text-muted-foreground hover:border-input hover:bg-accent hover:text-foreground active:bg-accent/80 focus-visible:ring-ring grid h-7 w-7 place-items-center rounded-md border border-transparent transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                            aria-label={`Row actions for ${d.title}`}
                            aria-expanded={openMenu === d.id}
                            aria-haspopup="menu"
                          >
                            <MoreHorizontal className="h-4 w-4 stroke-[1.75]" aria-hidden />
                          </button>
                          {openMenu === d.id && (
                            <div
                              role="menu"
                              className="border-border bg-popover animate-in fade-in slide-in-from-top-1 absolute top-8 right-0 z-20 w-48 rounded-md border p-1 shadow-lg duration-150 motion-reduce:animate-none"
                            >
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenu(null);
                                  navigate(`/dashboard/${d.id}`);
                                }}
                                className="hover:bg-accent focus-visible:bg-accent active:bg-accent/80 focus-visible:ring-ring flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                              >
                                <Eye className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden /> View
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenu(null);
                                  navigate(`/dashboard/${d.id}/edit`);
                                }}
                                className="hover:bg-accent focus-visible:bg-accent active:bg-accent/80 focus-visible:ring-ring flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                              >
                                <Pencil className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden /> Edit
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleExport([d.id]);
                                }}
                                className="hover:bg-accent focus-visible:bg-accent active:bg-accent/80 focus-visible:ring-ring flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                              >
                                <Download className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden />{" "}
                                Export
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenu(null);
                                  void handleDuplicate(d.id);
                                }}
                                className="hover:bg-accent focus-visible:bg-accent active:bg-accent/80 focus-visible:ring-ring flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                              >
                                <Copy className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden /> Duplicate
                              </button>
                              <div className="bg-border my-1 h-px" aria-hidden />
                              <button
                                type="button"
                                role="menuitem"
                                onClick={async () => {
                                  setOpenMenu(null);
                                  try {
                                    await navigator.clipboard.writeText(
                                      `${window.location.origin}/dashboard/${d.id}`,
                                    );
                                    showToast("Link copied");
                                  } catch {
                                    showToast("Could not copy link");
                                  }
                                }}
                                className="hover:bg-accent focus-visible:bg-accent active:bg-accent/80 focus-visible:ring-ring flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                              >
                                <Share2 className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden /> Share
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenu(null);
                                  showToast(
                                    "Email delivery needs SMTP setup. Not available in this phase.",
                                  );
                                }}
                                className="hover:bg-accent focus-visible:bg-accent active:bg-accent/80 focus-visible:ring-ring flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                              >
                                <Mail className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden /> Email
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenu(null);
                                  showToast("Ownership transfer coming in a future update");
                                }}
                                className="hover:bg-accent focus-visible:bg-accent active:bg-accent/80 focus-visible:ring-ring flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                              >
                                <Users className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden /> Change
                                owners
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenu(null);
                                  void handleToggleFavorite(d.id);
                                }}
                                className="hover:bg-accent focus-visible:bg-accent active:bg-accent/80 focus-visible:ring-ring flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                              >
                                <Star className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden />{" "}
                                {d.favorite ? "Remove favorite" : "Favorite"}
                              </button>
                              <div className="bg-border my-1 h-px" aria-hidden />
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenu(null);
                                  setConfirmRow(d);
                                }}
                                className="text-destructive hover:bg-destructive hover:text-destructive-foreground focus-visible:bg-destructive focus-visible:text-destructive-foreground active:bg-destructive/90 focus-visible:ring-ring flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                              >
                                <Trash2 className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden /> Delete
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

          {/* Pagination — monospace + subtle muted ring */}
          <div className="border-border bg-muted/20 flex flex-col items-center justify-between gap-3 border-t px-3 py-3 sm:flex-row">
            <p className="text-muted-foreground font-mono text-xs tabular-nums">
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
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4 stroke-[1.75]" aria-hidden />
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
                    aria-current={n === page ? "page" : undefined}
                    aria-label={`Page ${n}${n === page ? ", current page" : ""}`}
                    onClick={() => setPage(n)}
                    className={`focus-visible:ring-ring grid h-7 min-w-7 place-items-center rounded-md border px-2 font-mono text-xs font-medium tabular-nums transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none ${
                      n === page
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-input bg-background hover:bg-accent active:bg-accent/80"
                    }`}
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
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4 stroke-[1.75]" aria-hidden />
              </Button>
            </div>
          </div>
        </div>

        <p className="text-muted-foreground mt-3 font-mono text-[11px] leading-relaxed">
          Data layer: <code className="bg-muted rounded px-1 py-0.5">routes/api/dashboards</code> ·
          Drizzle + Postgres — mutations write through the API (create, favorite, duplicate, delete,
          export). No local seed fallback.
        </p>
      </div>

      <ConfirmDialog
        open={!!confirmRow}
        onOpenChange={(o) => !o && setConfirmRow(null)}
        title={`Delete '${confirmRow?.title ?? String(confirmRow?.id ?? "")}'?`}
        description={`Delete '${confirmRow?.title ?? String(confirmRow?.id ?? "")}'? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (confirmRow) return handleDelete(confirmRow);
        }}
      />
      <ConfirmDialog
        open={confirmBulk}
        onOpenChange={setConfirmBulk}
        title={`Delete ${selected.size} dashboards?`}
        description={`Delete ${selected.size} dashboards? This cannot be undone.`}
        confirmLabel={`Delete ${selected.size}`}
        variant="destructive"
        onConfirm={handleBulkDelete}
      />
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="border-border bg-card animate-in fade-in slide-in-from-bottom-1 fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border px-3 py-2 text-sm shadow-lg duration-200 motion-reduce:animate-none"
        >
          {toast}
        </div>
      )}
    </AppShell>
  );
}
