import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Copy,
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
  Database,
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
    <span className="border-border bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium">
      <BarChart3 className="h-3 w-3 opacity-70" />
      {type}
    </span>
  );
}

export default function ChartListPage() {
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
  const [localRows, setLocalRows] = useState<Chart[] | null>(null);
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
        let data = res.data;
        if (localRows) {
          const localMap = new Map(localRows.map((d) => [d.id, d]));
          data = data.map((d) => localMap.get(d.id) ?? d);
          const existingIds = new Set(localRows.map((d) => d.id));
          data = data.filter((d) => existingIds.has(d.id));
        }
        setRows(data);
        setTotal(res.total);
      })
      .catch(() => {
        if (!cancelled) showToast("Could not load charts");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, vizType, dataset, owner, tag, onlyFavorite, sortBy, sortDir, page, pageSize, localRows]);

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
    setLocalRows((prev) => (prev ? apply(prev) : null));
    if (!localRows) {
      setLocalRows(
        (prev) => prev ?? rows.map((d) => (d.id === id ? { ...d, favorite: !d.favorite } : d)),
      );
    }
    showToast("Favorite updated");
  };

  const handleDelete = (id: number) => {
    setRows((prev) => prev.filter((d) => d.id !== id));
    setLocalRows((prev) =>
      prev ? prev.filter((d) => d.id !== id) : rows.filter((d) => d.id !== id),
    );
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
    setLocalRows((prev) => (prev ? [dup, ...prev] : [dup, ...rows]));
    setTotal((t) => t + 1);
    showToast("Chart duplicated");
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    const ids = selected;
    setRows((prev) => prev.filter((d) => !ids.has(d.id)));
    setLocalRows((prev) =>
      prev ? prev.filter((d) => !ids.has(d.id)) : rows.filter((d) => !ids.has(d.id)),
    );
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
      modifiedBy: { id: 1, name: "Akmal Hazriq" },
      createdBy: { id: 1, name: "Akmal Hazriq" },
      owners: [{ id: 1, name: "Akmal Hazriq" }],
      tags: [],
      favorite: false,
    };
    setRows((prev) => [created, ...prev].slice(0, pageSize));
    setLocalRows((prev) => (prev ? [created, ...prev] : [created, ...rows]));
    setTotal((t) => t + 1);
    setPage(1);
    showToast("Draft chart created — open in Explore");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-semibold tracking-tight">Charts</h1>
              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                {total}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 max-w-[56ch] text-sm leading-relaxed">
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
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Import
                </span>
              </Button>
            </label>
            <Button size="sm" onClick={handleCreate}>
              Create chart
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-card mt-6 rounded-lg border">
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-[360px]">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search by chart name…"
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
                  value={vizType}
                  onChange={(e) => {
                    setVizType(e.target.value as typeof vizType);
                    setPage(1);
                  }}
                  className="border-input bg-background h-8 rounded-md border px-2 pr-6 text-xs font-medium"
                >
                  <option value="all">All types</option>
                  {VIZ_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
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
                  <option value="vizType">Sort: Type</option>
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
            </div>
          </div>

          {/* Secondary filters */}
          <div className="border-border flex flex-wrap items-center gap-2 border-t px-3 py-2">
            <div className="flex items-center gap-2">
              <Database className="text-muted-foreground h-3.5 w-3.5" />
              <Input
                placeholder="Filter by dataset…"
                value={dataset}
                onChange={(e) => {
                  setDataset(e.target.value);
                  setPage(1);
                }}
                className="h-7 w-[150px] text-xs"
              />
              {uniqueDatasets.length > 0 && (
                <span className="text-muted-foreground hidden text-xs lg:inline">
                  Try:{" "}
                  {uniqueDatasets.slice(0, 3).map((n, i) => (
                    <button
                      key={n}
                      onClick={() => {
                        setDataset(n);
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

            <Input
              placeholder="Filter by owner…"
              value={owner}
              onChange={(e) => {
                setOwner(e.target.value);
                setPage(1);
              }}
              className="h-7 w-[140px] text-xs"
            />

            <div className="relative">
              <select
                value={tag}
                onChange={(e) => {
                  setTag(e.target.value);
                  setPage(1);
                }}
                className="border-input bg-background h-7 rounded-md border px-2 pr-6 text-xs font-medium"
              >
                <option value="">All tags</option>
                <option value="revenue">revenue</option>
                <option value="product">product</option>
                <option value="ops">ops</option>
                <option value="experiment">experiment</option>
                <option value="infra">infra</option>
                <option value="marketing">marketing</option>
              </select>
              <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2" />
            </div>

            <div className="ml-auto flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                {loading ? "Loading…" : `${total} charts`}
              </span>
              {(q || vizType !== "all" || dataset || owner || tag || onlyFavorite) && (
                <button
                  onClick={() => {
                    setQ("");
                    setVizType("all");
                    setDataset("");
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
                onClick={handleBulkDelete}
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
        <div className="bg-card mt-4 overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground border-b text-left text-xs font-medium tracking-wide">
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
                        if (sortBy === "name") setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        else {
                          setSortBy("name");
                          setSortDir("asc");
                        }
                      }}
                      className="hover:text-foreground inline-flex items-center gap-1"
                    >
                      Chart name
                      <ChevronsUpDown className="h-3 w-3 opacity-60" />
                    </button>
                  </th>
                  <th className="hidden px-2 py-2.5 sm:table-cell">
                    <button
                      onClick={() => {
                        if (sortBy === "vizType") setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        else {
                          setSortBy("vizType");
                          setSortDir("asc");
                        }
                      }}
                      className="hover:text-foreground inline-flex items-center gap-1"
                    >
                      Type
                      <ChevronsUpDown className="h-3 w-3 opacity-60" />
                    </button>
                  </th>
                  <th className="hidden px-2 py-2.5 md:table-cell">Dataset</th>
                  <th className="hidden px-2 py-2.5 lg:table-cell">Database / table</th>
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
                  <th className="w-10 px-2 py-2.5 text-center">
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
                        <p className="text-sm font-medium">No charts match your filters</p>
                        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                          Try adjusting search, type, dataset, or tags. Or create a new chart in
                          Explore.
                        </p>
                        <div className="mt-4 flex justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
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
                          <Button size="sm" onClick={handleCreate}>
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
                      className={`hover:bg-muted/40 group ${selected.has(c.id) ? "bg-muted/60" : ""}`}
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
                            onClick={() => handleToggleFavorite(c.id)}
                            className={`hover:bg-accent mt-0.5 grid h-5 w-5 place-items-center rounded ${c.favorite ? "text-favorite" : "text-muted-foreground"}`}
                            aria-label={c.favorite ? "Remove favorite" : "Add favorite"}
                          >
                            <Star className={`h-3.5 w-3.5 ${c.favorite ? "fill-current" : ""}`} />
                          </button>
                          <div className="min-w-0">
                            <Link
                              to={`/explore?chart=${c.id}`}
                              className="line-clamp-1 text-sm leading-tight font-medium hover:underline"
                              title={c.name}
                            >
                              {c.name}
                            </Link>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              {c.certified && (
                                <span className="bg-info text-info-foreground inline-flex items-center rounded px-1 py-0.5 text-[10px] font-semibold tracking-wide">
                                  CERTIFIED
                                </span>
                              )}
                              <span className="text-muted-foreground hidden text-xs sm:inline">
                                /{c.slug}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1.5 sm:hidden">
                              <VizBadge type={c.vizType} />
                              <span className="text-muted-foreground text-xs">
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
                        <span className="inline-flex items-center gap-1 text-xs">
                          <Database className="text-muted-foreground h-3 w-3" />
                          {c.dataset}
                        </span>
                      </td>
                      <td className="hidden px-2 py-3 lg:table-cell">
                        <span className="font-mono text-xs tracking-tight">
                          <span className="text-foreground">{c.database}</span>
                          <span className="text-muted-foreground">.{c.schema}.</span>
                          <span className="text-foreground">{c.table}</span>
                        </span>
                      </td>
                      <td className="hidden px-2 py-3 md:table-cell">
                        <div className="text-xs leading-tight">
                          <div>{formatDate(c.modified)}</div>
                          <div className="text-muted-foreground">{formatTime(c.modified)}</div>
                        </div>
                      </td>
                      <td className="hidden px-2 py-3 lg:table-cell">
                        <span className="text-muted-foreground text-xs">{c.createdBy.name}</span>
                      </td>
                      <td className="hidden px-2 py-3 xl:table-cell">
                        <span className="inline-flex items-center">
                          {c.owners.slice(0, 3).map((o) => (
                            <span
                              key={o.id}
                              title={o.name}
                              className="border-card bg-muted -ml-1 grid h-6 w-6 place-items-center rounded-full border text-[10px] font-medium first:ml-0"
                            >
                              {initials(o.name)}
                            </span>
                          ))}
                          {c.owners.length > 3 && (
                            <span className="text-muted-foreground ml-1 text-xs">
                              +{c.owners.length - 3}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="hidden px-2 py-3 lg:table-cell">
                        <span className="flex flex-wrap gap-1">
                          {c.tags.slice(0, 2).map((t) => (
                            <Badge key={t} variant="secondary" className="text-[11px]">
                              {t}
                            </Badge>
                          ))}
                          {c.tags.length > 2 && (
                            <span className="text-muted-foreground text-xs">
                              +{c.tags.length - 2}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <button
                          onClick={() => handleToggleFavorite(c.id)}
                          className={`hover:bg-accent grid h-6 w-6 place-items-center rounded ${c.favorite ? "text-favorite" : "text-muted-foreground/60 hover:text-muted-foreground"}`}
                          aria-label="Toggle favorite"
                        >
                          <Heart
                            className={`h-3.5 w-3.5 ${c.favorite ? "text-favorite fill-current" : ""}`}
                          />
                        </button>
                      </td>
                      <td className="px-2 py-3">
                        <div
                          className="relative flex justify-end"
                          ref={openMenu === c.id ? menuRef : undefined}
                        >
                          <button
                            onClick={() => setOpenMenu((v) => (v === c.id ? null : c.id))}
                            className="text-muted-foreground hover:border-input hover:bg-accent hover:text-foreground grid h-7 w-7 place-items-center rounded-md border border-transparent"
                            aria-label="Row actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {openMenu === c.id && (
                            <div className="bg-popover border-border absolute top-8 right-0 z-20 w-48 rounded-md border p-1 shadow-lg">
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  showToast("View — opens chart preview");
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Eye className="h-3.5 w-3.5" /> View
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  showToast("Edit — opens Explore");
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleExport([c.id]);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Download className="h-3.5 w-3.5" /> Export
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleDuplicate(c.id);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Copy className="h-3.5 w-3.5" /> Duplicate
                              </button>
                              <div className="bg-border my-1 h-px" />
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  showToast("Change owners — opens owner picker");
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Users className="h-3.5 w-3.5" /> Change owners
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleToggleFavorite(c.id);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Star className="h-3.5 w-3.5" />{" "}
                                {c.favorite ? "Remove favorite" : "Favorite"}
                              </button>
                              <div className="bg-border my-1 h-px" />
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleDelete(c.id);
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

          <div className="bg-muted/20 border-border flex flex-col items-center justify-between gap-3 border-t px-3 py-3 sm:flex-row">
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
          Data layer: <code className="bg-muted rounded px-1 py-0.5">src/data/charts.ts</code> +{" "}
          <code className="bg-muted rounded px-1 py-0.5">routes/api/charts/index.get.ts</code> —
          in-memory placeholder. Mutations run client-side until a real store is chosen.
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
