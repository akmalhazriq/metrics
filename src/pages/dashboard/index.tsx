import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
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
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Dashboard, DashboardStatus } from "@/types/dashboard";
import { ApiError, fetchList, mutate } from "@/lib/api";

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

  // close menu on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // fetch from API via shared typed client
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchList<Dashboard>("/api/dashboards", {
          q: q || undefined,
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
              : "Could not load dashboards";
        setError(msg);
        showToast(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [q, status, owner, tag, onlyFavorite, sortBy, sortDir, page, pageSize]);


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
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not delete dashboard";
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
        body: JSON.stringify({ title: `${src.title} (copy)`, status: "draft", description: src.description }),
      });
      if (!res.ok) throw new Error();
      const j = (await res.json()) as { data: Dashboard };
      // refetch by reloading page 1
      setPage(1);
      // optimistic prepend
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
    else if (ok && fail) showToast(`Deleted ${ok} of ${ok + fail} dashboards — ${fail} failed: ${lastErr}`);
    else if (!ok && fail) showToast(lastErr || "Delete failed");
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
      // trigger refetch via page change; also optimistic
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
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-semibold tracking-tight">Dashboards</h1>
              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                {total}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 max-w-[52ch] text-sm leading-relaxed">
              Curated views of your data. Search, filter, and bulk-manage dashboards before sharing
              with stakeholders.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="inline-flex">
              <input
                type="file"
                accept=".json,.yaml,.zip"
                className="hidden"
                onChange={() => showToast("Import is a placeholder in this phase")}
              />
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Import
                </span>
              </Button>
            </label>
            <Button size="sm" onClick={handleCreate}>
              Create dashboard
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="border-border bg-card mt-6 rounded-lg border">
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-[360px]">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search by title…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="h-8 pl-8 text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="border-input bg-background flex items-center gap-1 rounded-md border p-0.5">
                {(["all", "published", "draft", "archived"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setStatus(s);
                      setPage(1);
                    }}
                    className={`rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                      status === s
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setOnlyFavorite((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  onlyFavorite
                    ? "border-favorite bg-favorite text-favorite-foreground"
                    : "border-input bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                <Star className={`h-3.5 w-3.5 ${onlyFavorite ? "fill-current" : ""}`} />
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
                    className="border-input bg-background text-foreground h-8 rounded-md border px-2 pr-6 text-xs font-medium"
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
                  <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2" />
                </div>

                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="border-input bg-background h-8 rounded-md border px-2 pr-6 text-xs font-medium"
                  >
                    <option value="modified">Sort: Modified</option>
                    <option value="title">Sort: Title</option>
                    <option value="status">Sort: Status</option>
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
          </div>

          {/* Secondary filters row */}
          <div className="border-border flex flex-wrap items-center gap-2 border-t px-3 py-2">
            <div className="flex items-center gap-2">
              <Users className="text-muted-foreground h-3.5 w-3.5" />
              <Input
                placeholder="Filter by owner…"
                value={owner}
                onChange={(e) => {
                  setOwner(e.target.value);
                  setPage(1);
                }}
                className="h-7 w-[160px] text-xs"
              />
              {uniqueOwners.length > 0 && (
                <span className="text-muted-foreground hidden text-xs lg:inline">
                  Try:{" "}
                  {uniqueOwners.slice(0, 3).map((n, i) => (
                    <button
                      key={n}
                      onClick={() => {
                        setOwner(n);
                        setPage(1);
                      }}
                      className="text-foreground font-medium hover:underline"
                    >
                      {i > 0 ? ", " : ""}
                      {n}
                    </button>
                  ))}
                </span>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                {loading ? "Loading…" : `${total} dashboards`}
              </span>
              {(q || status !== "all" || owner || tag || onlyFavorite) && (
                <button
                  onClick={() => {
                    setQ("");
                    setStatus("all");
                    setOwner("");
                    setTag("");
                    setOnlyFavorite(false);
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

          {/* Bulk bar */}
          {selected.size > 0 && (
            <div className="border-border bg-muted/50 flex flex-wrap items-center gap-2 border-t px-3 py-2">
              <span className="text-xs font-medium">{selected.size} selected</span>
              <span className="bg-border h-4 w-px" />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleExport()}
              >
                <Download className="mr-1 h-3 w-3" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setConfirmBulk(true)}
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
                  <th className="w-8 px-3 py-2.5">
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
                  <th className="px-2 py-2.5">
                    <button
                      onClick={() => {
                        if (sortBy === "title") setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        else {
                          setSortBy("title");
                          setSortDir("asc");
                        }
                      }}
                      className="hover:text-foreground inline-flex items-center gap-1"
                    >
                      Title
                      <ChevronsUpDown className="h-3 w-3 opacity-60" />
                    </button>
                  </th>
                  <th className="hidden px-2 py-2.5 sm:table-cell">Modified by</th>
                  <th className="px-2 py-2.5">
                    <button
                      onClick={() => {
                        if (sortBy === "status") setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        else {
                          setSortBy("status");
                          setSortDir("asc");
                        }
                      }}
                      className="hover:text-foreground inline-flex items-center gap-1"
                    >
                      Status
                      <ChevronsUpDown className="h-3 w-3 opacity-60" />
                    </button>
                  </th>
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
                  <th className="hidden px-2 py-2.5 lg:table-cell">Created by</th>
                  <th className="hidden px-2 py-2.5 xl:table-cell">Owners</th>
                  <th className="hidden px-2 py-2.5 lg:table-cell">Tags</th>
                  <th className="w-10 px-2 py-2.5 text-center" title="Favorite">
                    <Star className="mx-auto h-3.5 w-3.5" />
                  </th>
                  <th className="w-10 px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-3 py-3">
                        <span className="bg-muted block h-3 w-3 rounded" />
                      </td>
                      <td className="px-2 py-3">
                        <span className="bg-muted block h-3 w-40 rounded" />
                      </td>
                      <td className="hidden px-2 py-3 sm:table-cell">
                        <span className="bg-muted block h-3 w-20 rounded" />
                      </td>
                      <td className="px-2 py-3">
                        <span className="bg-muted block h-5 w-16 rounded-full" />
                      </td>
                      <td className="hidden px-2 py-3 md:table-cell">
                        <span className="bg-muted block h-3 w-24 rounded" />
                      </td>
                      <td className="hidden px-2 py-3 lg:table-cell">
                        <span className="bg-muted block h-3 w-20 rounded" />
                      </td>
                      <td className="hidden px-2 py-3 xl:table-cell">
                        <span className="bg-muted block h-3 w-24 rounded" />
                      </td>
                      <td className="hidden px-2 py-3 lg:table-cell">
                        <span className="bg-muted block h-3 w-16 rounded" />
                      </td>
                      <td className="px-2 py-3">
                        <span className="bg-muted mx-auto block h-4 w-4 rounded" />
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
                        <p className="text-sm font-medium">No dashboards match your filters</p>
                        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
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
                          aria-label={`Select ${d.title}`}
                        />
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => handleToggleFavorite(d.id)}
                            className={`hover:bg-accent mt-0.5 grid h-5 w-5 place-items-center rounded ${
                              d.favorite ? "text-favorite" : "text-muted-foreground"
                            }`}
                            aria-label={d.favorite ? "Remove favorite" : "Add favorite"}
                          >
                            <Star className={`h-3.5 w-3.5 ${d.favorite ? "fill-current" : ""}`} />
                          </button>
                          <div className="min-w-0">
                            <Link
                              to={`/dashboard/${d.id}`}
                              className="line-clamp-1 text-sm leading-tight font-medium hover:underline"
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
                              <span className="text-muted-foreground hidden text-xs sm:inline">
                                /{d.slug}
                              </span>
                            </div>
                            {/* Mobile meta */}
                            <div className="mt-1 flex flex-wrap gap-1.5 sm:hidden">
                              <Badge variant={STATUS_VARIANT[d.status]}>
                                {STATUS_LABEL[d.status]}
                              </Badge>
                              <span className="text-muted-foreground text-xs">
                                {formatDate(d.modified)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-2 py-3 sm:table-cell">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="bg-secondary text-secondary-foreground grid h-6 w-6 place-items-center rounded-full text-[10px] font-medium">
                            {initials(d.modifiedBy?.name ?? "Sample")}
                          </span>
                          <span className="text-xs">{d.modifiedBy?.name ?? "Sample"}</span>
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
                        <div className="text-xs leading-tight">
                          <div>{formatDate(d.modified)}</div>
                          <div className="text-muted-foreground">{formatTime(d.modified)}</div>
                        </div>
                      </td>
                      <td className="hidden px-2 py-3 lg:table-cell">
                        <span className="text-muted-foreground text-xs">{d.createdBy?.name ?? "Sample"}</span>
                      </td>
                      <td className="hidden px-2 py-3 xl:table-cell">
                        <span className="inline-flex items-center">
                          {d.owners.slice(0, 3).map((o) => (
                            <span
                              key={o.id}
                              title={o?.name ?? "Sample"}
                              className="border-card bg-muted -ml-1 grid h-6 w-6 place-items-center rounded-full border text-[10px] font-medium first:ml-0"
                            >
                              {initials(o?.name ?? "Sample")}
                            </span>
                          ))}
                          {d.owners.length > 3 && (
                            <span className="text-muted-foreground ml-1 text-xs">
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
                            <span className="text-muted-foreground text-xs">
                              +{d.tags.length - 2}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <button
                          onClick={() => handleToggleFavorite(d.id)}
                          className={`hover:bg-accent grid h-6 w-6 place-items-center rounded ${d.favorite ? "text-favorite" : "text-muted-foreground/60 hover:text-muted-foreground"}`}
                          aria-label="Toggle favorite"
                        >
                          <Heart
                            className={`h-3.5 w-3.5 ${d.favorite ? "text-favorite fill-current" : ""}`}
                          />
                        </button>
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
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {openMenu === d.id && (
                            <div className="border-border bg-popover absolute top-8 right-0 z-20 w-48 rounded-md border p-1 shadow-lg">
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  navigate(`/dashboard/${d.id}`);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Eye className="h-3.5 w-3.5" /> View
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  navigate(`/dashboard/${d.id}/edit`);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleExport([d.id]);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Download className="h-3.5 w-3.5" /> Export
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleDuplicate(d.id);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Copy className="h-3.5 w-3.5" /> Duplicate
                              </button>
                              <div className="bg-border my-1 h-px" />
                              <button
                                onClick={async () => {
                                  setOpenMenu(null);
                                  try { await navigator.clipboard.writeText(`${window.location.origin}/dashboard/${d.id}`); showToast("Link copied"); } catch { showToast("Could not copy link"); }
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Share2 className="h-3.5 w-3.5" /> Share
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  showToast("Email delivery requires SMTP configuration — not available in this phase");
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Mail className="h-3.5 w-3.5" /> Email
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  showToast("Ownership transfer coming in a future update");
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Users className="h-3.5 w-3.5" /> Change owners
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleToggleFavorite(d.id);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Star className="h-3.5 w-3.5" />{" "}
                                {d.favorite ? "Remove favorite" : "Favorite"}
                              </button>
                              <div className="bg-border my-1 h-px" />
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  setConfirmRow(d);
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
                    className={`grid h-7 min-w-7 place-items-center rounded-md border px-2 text-xs font-medium ${
                      n === page
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-accent"
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
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          Data layer: <code className="bg-muted rounded px-1 py-0.5">src/data/dashboards.ts</code> +{" "}
          <code className="bg-muted rounded px-1 py-0.5">routes/api/dashboards/index.get.ts</code> —
          in-memory placeholder. Mutations (create, favorite, duplicate, delete, export) run
          client-side only until a real store is chosen.
        </p>
      </div>

      <ConfirmDialog
        open={!!confirmRow}
        onOpenChange={(o) => !o && setConfirmRow(null)}
        title={`Delete '${confirmRow?.title ?? String(confirmRow?.id ?? "")}'?`}
        description={`Delete '${confirmRow?.title ?? String(confirmRow?.id ?? "")}'? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => { if (confirmRow) return handleDelete(confirmRow); }}
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
        <div className="border-border bg-card fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border px-3 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </AppShell>
  );
}
