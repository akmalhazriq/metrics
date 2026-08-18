import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Copy,
  Database,
  Download,
  Eye,
  Heart,
  MoreHorizontal,
  Pencil,
  Search,
  Star,
  Trash2,
  Upload,
  Users,
  X,
  BarChart3,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { Chart, ChartVizType } from "@/types/chart";

type ApiResponse = { data: Chart[]; total: number; page: number; pageSize: number };

const VIZ_TYPES: ChartVizType[] = [
  "Bar",
  "Line",
  "Pie",
  "Scatter",
  "Table",
  "Big Number",
  "Heatmap",
  "Area",
  "Box Plot",
  "Sunburst",
  "Sankey",
  "Gauge",
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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

function VizBadge({ type }: { type: ChartVizType }) {
  return (
    <span className="border-border bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-tight tabular-nums">
      <BarChart3 className="h-3 w-3 stroke-[1.75] opacity-70" />
      {type}
    </span>
  );
}

export default function ChartListPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [vizType, setVizType] = useState<ChartVizType | "all">("all");
  const [dataset, setDataset] = useState("");
  const [owner, setOwner] = useState("");
  const [tag, setTag] = useState("");
  const [onlyFavorite, setOnlyFavorite] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "modified" | "vizType">("modified");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [rows, setRows] = useState<Chart[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);

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
    if (vizType !== "all") params.set("vizType", vizType);
    if (dataset) params.set("dataset", dataset);
    if (owner) params.set("owner", owner);
    if (tag) params.set("tag", tag);
    if (onlyFavorite) params.set("favorite", "true");
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    fetch(`/api/charts?${params.toString()}`)
      .then((r) => r.json() as Promise<ApiResponse>)
      .then((res) => {
        if (cancelled) return;
        setRows(res.data);
        setTotal(res.total);
      })
      .catch(() => {
        if (!cancelled) showToast("We couldn't load charts. Try refreshing.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, vizType, dataset, owner, tag, onlyFavorite, sortBy, sortDir, page, pageSize]);

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someOnPageSelected = rows.some((r) => selected.has(r.id));
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const uniqueDatasets = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(r.dataset));
    return Array.from(s).slice(0, 6);
  }, [rows]);

  const handleToggleFavorite = (id: number) => {
    const apply = (list: Chart[]) =>
      list.map((d) => (d.id === id ? { ...d, favorite: !d.favorite } : d));
    setRows((prev) => apply(prev));
    showToast("Favorite updated");
  };

  const handleDelete = (id: number) => {
    setRows((prev) => prev.filter((d) => d.id !== id));
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    setTotal((t) => Math.max(0, t - 1));
    showToast("Chart deleted");
  };

  const handleDuplicate = (id: number) => {
    const src = rows.find((d) => d.id === id);
    if (!src) return;
    const dup: Chart = {
      ...src,
      id: Date.now(),
      name: `${src.name} (copy)`,
      slug: `${src.slug}-copy-${Date.now()}`,
      modified: new Date().toISOString(),
      favorite: false,
    };
    setRows((prev) => [dup, ...prev].slice(0, pageSize));
    setTotal((t) => t + 1);
    showToast("Chart duplicated");
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    const ids = selected;
    setRows((prev) => prev.filter((d) => !ids.has(d.id)));
    setTotal((t) => Math.max(0, t - ids.size));
    setSelected(new Set());
    showToast(`${ids.size} charts deleted`);
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
    a.download = `charts-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${targets.length} charts`);
  };

  const handleCreate = () => {
    const now = new Date().toISOString();
    const created: Chart = {
      id: Date.now(),
      name: "Untitled chart",
      slug: `untitled-${Date.now()}`,
      vizType: "Bar",
      dataset: "orders",
      database: "analytics",
      schema: "public",
      table: "orders",
      modified: now,
      modifiedBy: { id: 1, name: "Admin User" },
      createdBy: { id: 1, name: "Admin User" },
      owners: [{ id: 1, name: "Admin User" }],
      tags: [],
      favorite: false,
    };
    setRows((prev) => [created, ...prev].slice(0, pageSize));
    setTotal((t) => t + 1);
    setPage(1);
    showToast("Draft chart created. Open in Explore to edit it.");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        {/* Header — quiet metric: title + count + teaching line */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-semibold tracking-tight text-balance">Charts</h1>
              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
                {total}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 max-w-[56ch] text-sm leading-relaxed text-pretty">
              Every visualization in one place. Search by name, filter by type or dataset, then open
              in Explore or add to a dashboard.
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
              <Button
                variant="outline"
                size="sm"
                asChild
                className="focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-0"
              >
                <span>
                  <Upload className="mr-1.5 h-3.5 w-3.5 stroke-[1.75]" />
                  Import
                </span>
              </Button>
            </label>
            <Button
              size="sm"
              onClick={handleCreate}
              className="shadow-sm focus-visible:ring-2 focus-visible:ring-offset-0"
            >
              Create chart
            </Button>
          </div>
        </div>

        {/* Toolbar — primary search + type/sort/favorite */}
        <div className="bg-card mt-6 rounded-lg border shadow-sm">
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-[360px]">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 stroke-[1.75]" />
              <Input
                placeholder="Search by chart name…"
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
                  value={vizType}
                  onChange={(e) => {
                    setVizType(e.target.value as typeof vizType);
                    setPage(1);
                  }}
                  className="border-input bg-background focus-visible:ring-ring h-8 rounded-md border px-2 pr-7 text-xs font-medium tracking-tight tabular-nums transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                >
                  <option value="all">All types</option>
                  {VIZ_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
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
                  <option value="vizType">Sort: Type</option>
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

              <button
                type="button"
                onClick={() => setOnlyFavorite((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium tracking-tight tabular-nums transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none ${
                  onlyFavorite
                    ? "border-favorite bg-favorite text-favorite-foreground focus-visible:ring-favorite/30"
                    : "border-input bg-background text-muted-foreground hover:text-foreground focus-visible:ring-ring"
                }`}
              >
                <Star
                  className={`h-3.5 w-3.5 stroke-[1.75] ${onlyFavorite ? "fill-current" : ""}`}
                />
                Favorites
              </button>
            </div>
          </div>

          {/* Secondary filters — dataset / owner / tag / count */}
          <div className="border-border flex flex-wrap items-center gap-2 border-t px-3 py-2">
            <div className="flex items-center gap-2">
              <Database className="text-muted-foreground h-3.5 w-3.5 shrink-0 stroke-[1.75]" />
              <Input
                placeholder="Filter by dataset…"
                value={dataset}
                onChange={(e) => {
                  setDataset(e.target.value);
                  setPage(1);
                }}
                className="h-7 w-[150px] text-xs tracking-tight tabular-nums focus-visible:ring-2"
              />
              {uniqueDatasets.length > 0 && (
                <span className="text-muted-foreground hidden text-xs tracking-tight lg:inline">
                  Try:{" "}
                  {uniqueDatasets.slice(0, 3).map((n, i) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setDataset(n);
                        setPage(1);
                      }}
                      className="text-foreground focus-visible:ring-ring font-medium tracking-tight tabular-nums hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {i > 0 ? ", " : ""}
                      {n}
                    </button>
                  ))}
                </span>
              )}
            </div>

            <Input
              placeholder="Filter by owner…"
              value={owner}
              onChange={(e) => {
                setOwner(e.target.value);
                setPage(1);
              }}
              className="h-7 w-[140px] text-xs tracking-tight tabular-nums focus-visible:ring-2"
            />

            <div className="relative">
              <select
                value={tag}
                onChange={(e) => {
                  setTag(e.target.value);
                  setPage(1);
                }}
                className="border-input bg-background focus-visible:ring-ring h-7 rounded-md border px-2 pr-6 text-xs font-medium tracking-tight tabular-nums transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
              >
                <option value="">All tags</option>
                <option value="revenue">revenue</option>
                <option value="product">product</option>
                <option value="ops">ops</option>
                <option value="experiment">experiment</option>
                <option value="infra">infra</option>
                <option value="marketing">marketing</option>
              </select>
              <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75] opacity-60" />
            </div>

            <div className="ml-auto flex items-center gap-2 text-xs tabular-nums">
              <span className="text-muted-foreground tracking-tight">
                {loading ? "Loading…" : `${total} charts`}
              </span>
              {(q || vizType !== "all" || dataset || owner || tag || onlyFavorite) && (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    setVizType("all");
                    setDataset("");
                    setOwner("");
                    setTag("");
                    setOnlyFavorite(false);
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
            <div className="border-border bg-muted/40 flex flex-wrap items-center gap-2 border-t px-3 py-2">
              <span className="text-xs font-medium tracking-tight tabular-nums">
                {selected.size} selected
              </span>
              <span className="bg-border h-4 w-px" aria-hidden />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs tracking-tight"
                onClick={() => handleExport()}
              >
                <Download className="mr-1 h-3 w-3 stroke-[1.75]" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs tracking-tight"
                onClick={handleBulkDelete}
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

        {/* Table — dense tool chrome, tabular data */}
        <div className="bg-card mt-4 overflow-hidden rounded-lg border shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground border-b text-left text-[11px] font-medium tracking-[0.04em] uppercase tabular-nums">
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
                      Chart name
                      <ChevronsUpDown className="h-3 w-3 stroke-[1.75] opacity-60" />
                    </button>
                  </th>
                  <th className="hidden px-2 py-2.5 sm:table-cell">
                    <button
                      type="button"
                      onClick={() => {
                        if (sortBy === "vizType") setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        else {
                          setSortBy("vizType");
                          setSortDir("asc");
                        }
                      }}
                      className="hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      Type
                      <ChevronsUpDown className="h-3 w-3 stroke-[1.75] opacity-60" />
                    </button>
                  </th>
                  <th className="hidden px-2 py-2.5 md:table-cell">Dataset</th>
                  <th className="hidden px-2 py-2.5 lg:table-cell">Database / table</th>
                  <th className="hidden px-2 py-2.5 md:table-cell">
                    <button
                      type="button"
                      onClick={() => {
                        if (sortBy === "modified")
                          setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        else {
                          setSortBy("modified");
                          setSortDir("desc");
                        }
                      }}
                      className="hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      Modified
                      <ChevronsUpDown className="h-3 w-3 stroke-[1.75] opacity-60" />
                    </button>
                  </th>
                  <th className="hidden px-2 py-2.5 lg:table-cell">Created by</th>
                  <th className="hidden px-2 py-2.5 xl:table-cell">Owners</th>
                  <th className="hidden px-2 py-2.5 lg:table-cell">Tags</th>
                  <th className="w-10 px-2 py-2.5 text-center">
                    <Star className="mx-auto h-3.5 w-3.5 stroke-[1.75]" />
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
                        <span className="bg-muted block h-5 w-16 rounded-full" />
                      </td>
                      <td className="hidden px-2 py-3 md:table-cell">
                        <span className="bg-muted block h-3 w-20 rounded" />
                      </td>
                      <td className="hidden px-2 py-3 lg:table-cell">
                        <span className="bg-muted block h-3 w-32 rounded" />
                      </td>
                      <td className="hidden px-2 py-3 md:table-cell">
                        <span className="bg-muted block h-3 w-24 rounded" />
                      </td>
                      <td className="hidden px-2 py-3 lg:table-cell">
                        <span className="bg-muted block h-3 w-20 rounded" />
                      </td>
                      <td className="hidden px-2 py-3 xl:table-cell">
                        <span className="bg-muted block h-3 w-16 rounded" />
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
                    <td colSpan={11} className="px-6 py-16 text-center">
                      <div className="mx-auto max-w-sm">
                        <p className="text-sm font-medium tracking-tight text-balance">
                          No charts match your filters
                        </p>
                        <p className="text-muted-foreground mt-1 text-sm leading-relaxed text-pretty">
                          Try adjusting search, type, dataset, or tags. Or create a new chart in
                          Explore.
                        </p>
                        <div className="mt-4 flex justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="focus-visible:ring-2"
                            onClick={() => {
                              setQ("");
                              setVizType("all");
                              setDataset("");
                              setOwner("");
                              setTag("");
                              setOnlyFavorite(false);
                              setPage(1);
                            }}
                          >
                            Clear filters
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleCreate}
                            className="shadow-sm focus-visible:ring-2"
                          >
                            Create chart
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((c) => (
                    <tr
                      key={c.id}
                      className={`group hover:bg-muted/40 transition-colors duration-150 ${selected.has(c.id) ? "bg-muted/60" : ""}`}
                    >
                      <td className="px-3 py-3">
                        <Checkbox
                          checked={selected.has(c.id)}
                          onChange={(e) => {
                            const checked = (e.target as HTMLInputElement).checked;
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(c.id);
                              else next.delete(c.id);
                              return next;
                            });
                          }}
                          aria-label={`Select ${c.name}`}
                        />
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleFavorite(c.id)}
                            className={`hover:bg-accent focus-visible:ring-ring mt-0.5 grid h-5 w-5 place-items-center rounded transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none ${c.favorite ? "text-favorite" : "text-muted-foreground"}`}
                            aria-label={c.favorite ? "Remove favorite" : "Add favorite"}
                          >
                            <Star
                              className={`h-3.5 w-3.5 stroke-[1.75] ${c.favorite ? "fill-current" : ""}`}
                            />
                          </button>
                          <div className="min-w-0">
                            <Link
                              to={`/explore?chartId=${c.id}`}
                              className="focus-visible:ring-ring line-clamp-1 text-sm leading-tight font-medium tracking-tight text-balance hover:underline focus-visible:ring-2 focus-visible:outline-none"
                              title={c.name}
                            >
                              {c.name}
                            </Link>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              {c.certified && (
                                <span className="bg-info text-info-foreground inline-flex items-center rounded px-1 py-0.5 text-[10px] font-semibold tracking-[0.04em] uppercase tabular-nums">
                                  CERTIFIED
                                </span>
                              )}
                              <span className="text-muted-foreground hidden text-xs tracking-tight tabular-nums sm:inline">
                                /{c.slug}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1.5 sm:hidden">
                              <VizBadge type={c.vizType} />
                              <span className="text-muted-foreground text-xs tracking-tight tabular-nums">
                                {formatDate(c.modified)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-2 py-3 sm:table-cell">
                        <VizBadge type={c.vizType} />
                      </td>
                      <td className="hidden px-2 py-3 md:table-cell">
                        <span className="inline-flex items-center gap-1 text-xs tracking-tight tabular-nums">
                          <Database className="text-muted-foreground h-3 w-3 shrink-0 stroke-[1.75]" />
                          {c.dataset}
                        </span>
                      </td>
                      <td className="hidden px-2 py-3 lg:table-cell">
                        <span className="font-mono text-xs tracking-tight tabular-nums">
                          <span className="text-foreground">{c.database}</span>
                          <span className="text-muted-foreground">.{c.schema}.</span>
                          <span className="text-foreground">{c.table}</span>
                        </span>
                      </td>
                      <td className="hidden px-2 py-3 md:table-cell">
                        <div className="text-xs leading-tight tracking-tight tabular-nums">
                          <div>{formatDate(c.modified)}</div>
                          <div className="text-muted-foreground">{formatTime(c.modified)}</div>
                        </div>
                      </td>
                      <td className="hidden px-2 py-3 lg:table-cell">
                        <span className="text-muted-foreground text-xs tracking-tight">
                          {c.createdBy?.name ?? "Sample"}
                        </span>
                      </td>
                      <td className="hidden px-2 py-3 xl:table-cell">
                        <span className="inline-flex items-center">
                          {(c.owners ?? []).slice(0, 3).map((o) => (
                            <span
                              key={o.id}
                              title={o?.name ?? "Sample"}
                              className="border-card bg-muted -ml-1 grid h-6 w-6 place-items-center rounded-full border text-[10px] font-medium tracking-tight tabular-nums first:ml-0"
                            >
                              {initials(o?.name ?? "Sample")}
                            </span>
                          ))}
                          {(c.owners ?? []).length > 3 && (
                            <span className="text-muted-foreground ml-1 text-xs tracking-tight tabular-nums">
                              +{(c.owners ?? []).length - 3}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="hidden px-2 py-3 lg:table-cell">
                        <span className="flex flex-wrap gap-1">
                          {c.tags.slice(0, 2).map((t) => (
                            <Badge
                              key={t}
                              variant="secondary"
                              className="text-[11px] tracking-tight tabular-nums"
                            >
                              {t}
                            </Badge>
                          ))}
                          {c.tags.length > 2 && (
                            <span className="text-muted-foreground text-xs tracking-tight tabular-nums">
                              +{c.tags.length - 2}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(c.id)}
                          className={`hover:bg-accent focus-visible:ring-ring grid h-6 w-6 place-items-center rounded transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none ${c.favorite ? "text-favorite" : "text-muted-foreground/60 hover:text-muted-foreground"}`}
                          aria-label="Toggle favorite"
                        >
                          <Heart
                            className={`h-3.5 w-3.5 stroke-[1.75] ${c.favorite ? "text-favorite fill-current" : ""}`}
                          />
                        </button>
                      </td>
                      <td className="px-2 py-3">
                        <div
                          className="relative flex justify-end"
                          ref={openMenu === c.id ? menuRef : undefined}
                        >
                          <button
                            type="button"
                            onClick={() => setOpenMenu((v) => (v === c.id ? null : c.id))}
                            className="text-muted-foreground hover:border-input hover:bg-accent hover:text-foreground focus-visible:ring-ring grid h-7 w-7 place-items-center rounded-md border border-transparent transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                            aria-label="Row actions"
                          >
                            <MoreHorizontal className="h-4 w-4 stroke-[1.75]" />
                          </button>
                          {openMenu === c.id && (
                            <div className="bg-popover border-border animate-in fade-in slide-in-from-top-1 absolute top-8 right-0 z-20 w-48 rounded-md border p-1 shadow-xl duration-150">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenu(null);
                                  navigate(`/explore?chartId=${c.id}`);
                                }}
                                className="hover:bg-accent focus-visible:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none"
                              >
                                <Eye className="h-3.5 w-3.5 stroke-[1.75]" /> View
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenu(null);
                                  navigate(`/explore?chartId=${c.id}`);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none"
                              >
                                <Pencil className="h-3.5 w-3.5 stroke-[1.75]" /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleExport([c.id]);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none"
                              >
                                <Download className="h-3.5 w-3.5 stroke-[1.75]" /> Export
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleDuplicate(c.id);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none"
                              >
                                <Copy className="h-3.5 w-3.5 stroke-[1.75]" /> Duplicate
                              </button>
                              <div className="bg-border my-1 h-px" />
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenu(null);
                                  showToast("Change owners opens the owner picker");
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none"
                              >
                                <Users className="h-3.5 w-3.5 stroke-[1.75]" /> Change owners
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleToggleFavorite(c.id);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none"
                              >
                                <Star className="h-3.5 w-3.5 stroke-[1.75]" />{" "}
                                {c.favorite ? "Remove favorite" : "Favorite"}
                              </button>
                              <div className="bg-border my-1 h-px" />
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleDelete(c.id);
                                }}
                                className="text-destructive hover:bg-destructive hover:text-destructive-foreground flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none"
                              >
                                <Trash2 className="h-3.5 w-3.5 stroke-[1.75]" /> Delete
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

          <div className="bg-muted/20 border-border flex flex-col items-center justify-between gap-3 border-t px-3 py-3 sm:flex-row">
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
          Data layer:{" "}
          <code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px] tracking-tight tabular-nums">
            src/data/charts.ts
          </code>{" "}
          +{" "}
          <code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px] tracking-tight tabular-nums">
            routes/api/charts/index.get.ts
          </code>{" "}
          — in-memory placeholder. Mutations run client-side until a real store is chosen.
        </p>
      </div>

      {toast && (
        <div className="border-border bg-card animate-in fade-in slide-in-from-bottom-1 fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-3 py-2 text-sm font-medium tracking-tight text-balance shadow-xl duration-150">
          {toast}
        </div>
      )}
    </AppShell>
  );
}
