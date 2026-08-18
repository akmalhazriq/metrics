import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Eye,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Type,
  FileText,
  BarChart3,
  LayoutGrid,
  X,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, fetchList } from "@/lib/api";
import type { Dashboard, DashboardLayoutCell, DashboardLayoutRow } from "@/types/dashboard";
import type { Chart } from "@/types/chart";
import type { Dataset } from "@/types/dataset";

const ChartRenderer = lazy(() => import("@/components/charts/ChartRenderer"));

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function inferNumericKey(ds: Dataset): string | null {
  const rows = ds.sampleRows ?? [];
  for (const col of ds.columns ?? []) {
    if (!/NUMERIC|INTEGER|FLOAT|DOUBLE|DECIMAL/i.test(col.type)) continue;
    if (rows.some((r) => typeof r[col.name] === "number")) return col.name;
  }
  for (const col of ds.columns ?? [])
    if (rows.some((r) => typeof r[col.name] === "number")) return col.name;
  return null;
}
function aggregateForChart(
  ds: Dataset,
  dimension: string | null,
  metricName: string | null,
  rowLimit: number,
) {
  const sample = ds.sampleRows ?? [];
  if (!metricName) return { rows: [] as { label: string; value: number }[], metricLabel: "—" };
  const metric = (ds.metrics ?? []).find((m) => m.name === metricName);
  const metricLabel = metric?.name ?? metricName;
  const numericKey = inferNumericKey(ds);
  const isCount = /count/i.test(metricName);
  const isAvg = /avg/i.test(metricName);
  const compute = (bucket: typeof sample) => {
    if (isCount) return bucket.length;
    if (!numericKey) return bucket.length;
    const vals = bucket.map((r) => Number(r[numericKey])).filter((n) => Number.isFinite(n));
    if (!vals.length) return 0;
    if (isAvg) return vals.reduce((a, b) => a + b, 0) / vals.length;
    return vals.reduce((a, b) => a + b, 0);
  };
  if (!dimension) {
    const v = compute(sample);
    return { rows: [{ label: "Total", value: Number(v.toFixed(2)) }], metricLabel };
  }
  const groups = new Map<string, typeof sample>();
  for (const r of sample) {
    const k = String(r[dimension] ?? "—");
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  let rows = Array.from(groups.entries()).map(([label, bucket]) => ({
    label,
    value: Number(compute(bucket).toFixed(2)),
  }));
  rows.sort((a, b) => b.value - a.value);
  rows = rows.slice(0, rowLimit);
  return { rows, metricLabel };
}

function MiniChartPreview({ chart, dataset }: { chart: Chart; dataset: Dataset }) {
  const dimension = useMemo(
    () => (dataset.columns ?? []).find((c) => c.groupable)?.name ?? null,
    [dataset],
  );
  const metric = useMemo(() => (dataset.metrics ?? [])[0] ?? null, [dataset]);
  const { rows, metricLabel } = useMemo(
    () => aggregateForChart(dataset, dimension, metric?.name ?? null, 10),
    [dataset, dimension, metric],
  );
  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border shadow-sm">
      <div className="border-border flex items-center gap-2 border-b px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-xs font-medium tracking-tight text-balance">
          {chart.name}
        </span>
        <Badge variant="secondary" className="font-mono text-[10px] tracking-wide tabular-nums">
          {chart.vizType}
        </Badge>
      </div>
      <div className="min-h-[180px]">
        <Suspense
          fallback={
            <div className="text-muted-foreground grid h-[180px] place-items-center text-xs">
              Loading chart…
            </div>
          }
        >
          <ChartRenderer
            vizType={chart.vizType}
            data={rows}
            metricLabel={metricLabel}
            d3Format={metric?.d3Format}
            dataset={dataset}
            dimension={dimension}
            showGrid
            showLegend
            rawRows={dataset.sampleRows ?? []}
            rowLimit={10}
          />
        </Suspense>
      </div>
    </div>
  );
}

export default function DashboardEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftLayout, setDraftLayout] = useState<DashboardLayoutRow[]>([]);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState("");
  const [pendingPickerRow, setPendingPickerRow] = useState<string | null>(null);
  const [pickerCharts, setPickerCharts] = useState<Chart[]>([]);
  const [pickerDatasets, setPickerDatasets] = useState<Map<number, Dataset>>(new Map());
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [editChartMap, setEditChartMap] = useState<Map<number, Chart>>(new Map());

  // Fetch charts live for picker (supports server-side search ?q=)
  useEffect(() => {
    if (!pickerOpen) return;
    let cancelled = false;
    setPickerLoading(true);
    setPickerError(null);
    const params: Record<string, string | number | undefined> = { page: 1, pageSize: 20 };
    if (pickerQ.trim()) params.q = pickerQ.trim();
    fetchList<Chart>("/api/charts", params)
      .then((res) => {
        if (cancelled) return;
        setPickerCharts(res.data);
        setEditChartMap((prev) => {
          const next = new Map(prev);
          for (const c of res.data) next.set(c.id, c);
          return next;
        });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg =
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Failed to load charts";
        setPickerError(msg);
        setPickerCharts([]);
      })
      .finally(() => {
        if (!cancelled) setPickerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pickerOpen, pickerQ]);

  // Fetch datasets live for chart previews in picker + canvas (single batch)
  useEffect(() => {
    let cancelled = false;
    fetchList<Dataset>("/api/datasets", { page: 1, pageSize: 50 })
      .then((res) => {
        if (cancelled) return;
        const m = new Map<number, Dataset>();
        for (const ds of res.data) m.set(ds.id, ds);
        setPickerDatasets(m);
      })
      .catch(() => {
        if (!cancelled) setPickerDatasets(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Ensure every chart referenced by draftLayout is cached (covers preview + edit canvas when picker hasn't loaded them)
  useEffect(() => {
    const ids = draftLayout.flatMap((r) =>
      r.cells
        .filter((c) => c.type === "chart")
        .map((c) => (c as Extract<DashboardLayoutCell, { type: "chart" }>).chartId),
    );
    const missing = ids.filter((id) => !editChartMap.has(id));
    if (!missing.length) return;
    let cancelled = false;
    Promise.all(
      missing.map(async (cid) => {
        try {
          const res = await fetch(`/api/charts/${cid}`);
          if (!res.ok) return null;
          const json = (await res.json()) as { data: Chart };
          return json.data;
        } catch {
          return null;
        }
      }),
    ).then((charts) => {
      if (cancelled) return;
      setEditChartMap((prev) => {
        const next = new Map(prev);
        for (const c0 of charts) if (c0) next.set(c0.id, c0);
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftLayout]);

  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/dashboards/${id}`)
      .then(async (r) => {
        if (!r.ok)
          throw new Error((await r.json().catch(() => null))?.message ?? `HTTP ${r.status}`);
        return r.json() as Promise<{ data: Dashboard }>;
      })
      .then((res) => {
        if (cancelled) return;
        setDashboard(res.data);
        setDraftTitle(res.data.title);
        setDraftDesc(res.data.description ?? "");
        setDraftLayout(res.data.layout ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const addHeaderRow = () => {
    const row: DashboardLayoutRow = {
      id: uid("r"),
      cells: [{ id: uid("c"), type: "header", text: "New section", level: 2, span: 12 }],
    };
    setDraftLayout((prev) => [...prev, row]);
  };
  const addMarkdownRow = () => {
    const row: DashboardLayoutRow = {
      id: uid("r"),
      cells: [
        {
          id: uid("c"),
          type: "markdown",
          content: "Add context, links, or notes for this dashboard. Use **bold** and `code`.",
          span: 12,
        },
      ],
    };
    setDraftLayout((prev) => [...prev, row]);
  };
  const addChartToNewRow = (chartId: number) => {
    const row: DashboardLayoutRow = {
      id: uid("r"),
      cells: [{ id: uid("c"), type: "chart", chartId, span: 6 }],
    };
    setDraftLayout((prev) => [...prev, row]);
    setPickerOpen(false);
  };
  const addChartToRow = (chartId: number, rowId: string) => {
    setDraftLayout((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? { ...r, cells: [...r.cells, { id: uid("c"), type: "chart", chartId, span: 6 }] }
          : r,
      ),
    );
    setPickerOpen(false);
    setPendingPickerRow(null);
  };

  const deleteCell = (rowId: string, cellId: string) => {
    setDraftLayout((prev) => {
      const next = prev
        .map((r) => (r.id === rowId ? { ...r, cells: r.cells.filter((c) => c.id !== cellId) } : r))
        .filter((r) => r.cells.length > 0);
      return next;
    });
  };
  const deleteRow = (rowId: string) => setDraftLayout((prev) => prev.filter((r) => r.id !== rowId));
  const updateSpan = (rowId: string, cellId: string, span: number) => {
    setDraftLayout((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              cells: r.cells.map((c) =>
                c.id === cellId ? ({ ...c, span } as DashboardLayoutCell) : c,
              ),
            }
          : r,
      ),
    );
  };
  const updateHeader = (rowId: string, cellId: string, text: string, level: 1 | 2 | 3) => {
    setDraftLayout((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              cells: r.cells.map((c) =>
                c.id === cellId && c.type === "header" ? { ...c, text, level } : c,
              ),
            }
          : r,
      ),
    );
  };
  const updateMarkdown = (rowId: string, cellId: string, content: string) => {
    setDraftLayout((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              cells: r.cells.map((c) =>
                c.id === cellId && c.type === "markdown" ? { ...c, content } : c,
              ),
            }
          : r,
      ),
    );
  };

  const handleSave = async () => {
    if (!dashboard) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboards/${dashboard.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle.trim() || dashboard.title,
          description: draftDesc,
          layout: draftLayout,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        data?: Dashboard;
        message?: string;
      } | null;
      if (!res.ok) throw new Error(data?.message ?? `Save failed (${res.status})`);
      setDashboard(data?.data ?? dashboard);
      showToast("Dashboard saved");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const filteredCharts = pickerCharts;

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
          <div className="border-border bg-card rounded-lg border p-4 shadow-sm">
            <div className="bg-muted h-5 w-40 animate-pulse rounded" />
            <div className="bg-muted mt-4 h-[400px] animate-pulse rounded-lg" />
          </div>
        </div>
      </AppShell>
    );
  }
  if (error || !dashboard) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6">
          <div className="border-border bg-card rounded-lg border p-10 text-center shadow-sm">
            <p className="text-sm font-semibold tracking-tight text-balance">Dashboard not found</p>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed text-pretty">
              {error ?? `No dashboard ${id}`}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 text-xs focus-visible:ring-2"
              >
                <Link to="/dashboard">Back to Dashboards</Link>
              </Button>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const layout = draftLayout;

  return (
    <AppShell>
      <div className="min-h-[calc(100vh-44px)]">
        {/* Edit header */}
        <div className="border-border bg-card sticky top-[44px] z-20 border-b shadow-sm">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
            <Link
              to={`/dashboard/${dashboard.id}`}
              aria-label="Back to dashboard"
              className="border-input bg-background text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring inline-flex h-8 w-8 place-items-center justify-center rounded-md border transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
            >
              <ArrowLeft className="h-4 w-4 stroke-[1.75]" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="placeholder:text-muted-foreground focus-visible:ring-ring min-w-[16ch] flex-1 rounded-sm bg-transparent text-[16px] font-semibold tracking-tight text-balance outline-none focus-visible:ring-2 sm:text-[18px]"
                  placeholder="Dashboard title"
                />
                <Badge
                  variant={
                    dashboard.status === "published"
                      ? "success"
                      : dashboard.status === "draft"
                        ? "warning"
                        : "secondary"
                  }
                  className="text-[11px] tracking-wide capitalize"
                >
                  {dashboard.status}
                </Badge>
                <span className="text-muted-foreground hidden font-mono text-[11px] tabular-nums sm:inline">
                  /{dashboard.slug} · {formatDate(dashboard.modified)}
                </span>
              </div>
              <input
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                placeholder="Description, shown under the title in view mode"
                className="text-muted-foreground placeholder:text-muted-foreground focus-visible:ring-ring mt-1 w-full rounded-sm bg-transparent text-xs leading-relaxed outline-none focus-visible:ring-2"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="border-input bg-muted flex rounded-md border p-1">
                <button
                  onClick={() => setMode("edit")}
                  className={`focus-visible:ring-ring inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium tracking-tight transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none ${mode === "edit" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Pencil className="h-3.5 w-3.5 stroke-[1.75]" /> Edit
                </button>
                <button
                  onClick={() => setMode("preview")}
                  className={`focus-visible:ring-ring inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium tracking-tight transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none ${mode === "preview" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Eye className="h-3.5 w-3.5 stroke-[1.75]" /> Preview
                </button>
              </div>
              <Button
                size="sm"
                className="h-8 text-xs focus-visible:ring-2"
                onClick={handleSave}
                disabled={saving}
              >
                <Save className="mr-1 h-3.5 w-3.5 stroke-[1.75]" />
                {saving ? "Saving…" : "Save Dashboard"}
              </Button>
            </div>
          </div>
        </div>

        <div className="mx-auto flex max-w-[1280px] flex-col gap-0 lg:flex-row">
          {/* Palette — only in edit mode */}
          {mode === "edit" && (
            <aside className="border-border bg-card w-full shrink-0 border-b lg:w-[260px] lg:border-r lg:border-b-0">
              <div className="sticky top-[92px] space-y-4 p-4">
                <div>
                  <p className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.09em] uppercase">
                    <LayoutGrid className="h-3.5 w-3.5 stroke-[1.75]" /> Component palette
                  </p>
                  <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed text-pretty">
                    Append rows to the 12-col grid. No drag-and-drop in this pass — add, remove, or
                    change span. Tabs &amp; dividers deferred.
                  </p>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="border-border bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium tracking-tight transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <BarChart3 className="h-3.5 w-3.5 stroke-[1.75]" /> Add chart
                  </button>
                  <button
                    onClick={addHeaderRow}
                    className="border-input bg-background hover:bg-muted focus-visible:ring-ring flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <Type className="h-3.5 w-3.5 stroke-[1.75]" /> Add header
                  </button>
                  <button
                    onClick={addMarkdownRow}
                    className="border-input bg-background hover:bg-muted focus-visible:ring-ring flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <FileText className="h-3.5 w-3.5 stroke-[1.75]" /> Add markdown
                  </button>
                </div>
                <div className="border-border bg-muted/30 rounded-lg border p-3">
                  <p className="text-xs font-semibold tracking-tight">Grid discipline</p>
                  <p className="text-muted-foreground mt-1.5 text-[11px] leading-relaxed text-pretty">
                    Edit mode shows a dashed 12-col overlay (
                    <code className="bg-background rounded border px-1 font-mono text-[11px]">
                      --border
                    </code>{" "}
                    /{" "}
                    <code className="bg-background rounded border px-1 font-mono text-[11px]">
                      --muted
                    </code>
                    ). Cells are{" "}
                    <code className="bg-background rounded border px-1 font-mono text-[11px]">
                      span 4/6/8/12
                    </code>{" "}
                    — drag &amp; resize deferred.
                  </p>
                </div>
                <div className="border-border rounded-lg border p-3">
                  <p className="text-xs font-medium tracking-tight">
                    {layout.length} row(s) · {layout.reduce((s, r) => s + r.cells.length, 0)}{" "}
                    cell(s)
                  </p>
                  <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed text-pretty">
                    <code className="bg-muted rounded border px-1 font-mono text-[11px]">
                      Dashboard.layout
                    </code>{" "}
                    →{" "}
                    <code className="bg-muted rounded border px-1 font-mono text-[11px]">
                      PUT /api/dashboards/:id
                    </code>{" "}
                    via Drizzle.
                  </p>
                  <div className="mt-3 flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 flex-1 text-xs focus-visible:ring-2"
                      onClick={() => setPickerOpen(true)}
                    >
                      <Plus className="mr-1 h-3 w-3 stroke-[1.75]" /> Chart
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs focus-visible:ring-2"
                      onClick={() => navigate(`/dashboard/${dashboard.id}`)}
                    >
                      View →
                    </Button>
                  </div>
                </div>
              </div>
            </aside>
          )}

          {/* Canvas */}
          <div className="min-w-0 flex-1">
            <div
              className={`relative mx-auto max-w-[960px] px-4 py-6 sm:px-6 ${mode === "edit" ? "bg-[color-mix(in_oklch,var(--background),var(--muted)_5%)]" : "bg-[color-mix(in_oklch,var(--background),var(--muted)_4%)]"}`}
            >
              {/* Dashed 12-col overlay — edit mode only */}
              {mode === "edit" && (
                <div
                  className="pointer-events-none absolute inset-0 hidden px-4 sm:px-6 lg:block"
                  aria-hidden
                >
                  <div className="mx-auto grid h-full max-w-[960px] grid-cols-12 gap-4 opacity-[0.18]">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div
                        key={i}
                        className="border-border border-l border-dashed first:border-l-0"
                      />
                    ))}
                  </div>
                </div>
              )}

              {layout.length === 0 ? (
                <div className="border-border bg-card relative rounded-lg border border-dashed p-10 text-center shadow-sm sm:p-14">
                  <div className="bg-muted mx-auto grid h-10 w-10 place-items-center rounded-full">
                    <span className="text-muted-foreground text-sm">◌</span>
                  </div>
                  <h2 className="mt-4 text-base font-semibold tracking-tight text-balance">
                    No rows yet
                  </h2>
                  <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed text-pretty">
                    Use the palette to add your first header, markdown, or chart. The grid is 12
                    columns — charts default to span 6.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setPickerOpen(true)}
                      className="h-8 text-xs focus-visible:ring-2"
                    >
                      <BarChart3 className="mr-1 h-3.5 w-3.5 stroke-[1.75]" /> Pick a chart
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addHeaderRow}
                      className="h-8 text-xs focus-visible:ring-2"
                    >
                      <Type className="mr-1 h-3.5 w-3.5 stroke-[1.75]" /> Add header
                    </Button>
                  </div>
                </div>
              ) : mode === "preview" ? (
                <div className="relative space-y-4">
                  {layout.map((row) => (
                    <div key={row.id} className="grid grid-cols-12 gap-4">
                      {row.cells.map((cell) => {
                        if (cell.type === "divider")
                          return (
                            <div key={cell.id} className="border-border col-span-12 border-t" />
                          );
                        if (cell.type === "header") {
                          const Tag = cell.level === 1 ? "h2" : cell.level === 3 ? "h4" : "h3";
                          const cls =
                            cell.level === 1
                              ? "text-[22px] font-semibold tracking-tight text-balance"
                              : cell.level === 3
                                ? "text-sm font-semibold tracking-tight text-balance"
                                : "text-base font-semibold tracking-tight text-balance";
                          const spanCls =
                            cell.span === 12
                              ? "col-span-12"
                              : cell.span === 6
                                ? "col-span-12 lg:col-span-6"
                                : "col-span-12";
                          return (
                            <div key={cell.id} className={spanCls}>
                              <Tag className={cls}>{cell.text}</Tag>
                            </div>
                          );
                        }
                        if (cell.type === "markdown") {
                          const html = cell.content
                            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                            .replace(
                              /`([^`]+)`/g,
                              '<code class="bg-muted rounded border px-1 py-0.5 font-mono text-[11px]">$1</code>',
                            );
                          const spanCls =
                            cell.span === 12 ? "col-span-12" : "col-span-12 lg:col-span-6";
                          return (
                            <div key={cell.id} className={spanCls}>
                              <div
                                className="bg-muted/30 border-border text-muted-foreground rounded-lg border px-3 py-2.5 text-xs leading-relaxed text-pretty"
                                dangerouslySetInnerHTML={{ __html: html }}
                              />
                            </div>
                          );
                        }
                        const chart = editChartMap.get(cell.chartId);
                        const dataset =
                          chart?.datasetId != null ? pickerDatasets.get(chart.datasetId) : null;
                        const spanCls =
                          cell.span === 12
                            ? "col-span-12"
                            : cell.span === 8
                              ? "col-span-12 lg:col-span-8"
                              : cell.span === 6
                                ? "col-span-12 lg:col-span-6"
                                : cell.span === 4
                                  ? "col-span-12 lg:col-span-4"
                                  : "col-span-12";
                        if (!chart || !dataset)
                          return (
                            <div
                              key={cell.id}
                              className={`${spanCls} border-border bg-card grid place-items-center rounded-lg border p-8 text-xs shadow-sm`}
                            >
                              Missing chart {cell.chartId}
                            </div>
                          );
                        return (
                          <div key={cell.id} className={spanCls}>
                            <MiniChartPreview chart={chart} dataset={dataset} />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="relative space-y-3">
                  {layout.map((row) => (
                    <div
                      key={row.id}
                      className="border-border bg-card/80 group relative grid grid-cols-12 gap-3 rounded-lg border border-dashed p-3 shadow-sm backdrop-blur-[1px]"
                    >
                      <div className="absolute -top-2 left-2 flex items-center gap-1">
                        <span className="bg-muted text-muted-foreground rounded-full border px-1.5 py-0.5 font-mono text-[10px] tracking-wide tabular-nums">
                          row {row.id.slice(-4)} · {row.cells.length} cell(s)
                        </span>
                        <button
                          onClick={() => deleteRow(row.id)}
                          className="border-border bg-card hover:bg-destructive hover:text-destructive-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium tracking-wide transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                        >
                          <Trash2 className="h-3 w-3 stroke-[1.75]" /> Row
                        </button>
                        <button
                          onClick={() => {
                            setPendingPickerRow(row.id);
                            setPickerOpen(true);
                          }}
                          className="border-border bg-card hover:bg-accent focus-visible:ring-ring inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium tracking-wide transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                        >
                          <Plus className="h-3 w-3 stroke-[1.75]" /> Chart to row
                        </button>
                      </div>
                      <div className="col-span-12 mt-2 grid grid-cols-12 gap-3">
                        {row.cells.map((cell) => {
                          const spanCls =
                            cell.span === 12
                              ? "col-span-12"
                              : cell.span === 8
                                ? "col-span-12 lg:col-span-8"
                                : cell.span === 6
                                  ? "col-span-12 lg:col-span-6"
                                  : cell.span === 4
                                    ? "col-span-12 lg:col-span-4"
                                    : "col-span-12";
                          return (
                            <div
                              key={cell.id}
                              className={`${spanCls} border-input bg-background relative rounded-lg border p-3 shadow-sm`}
                            >
                              <div className="mb-2.5 flex items-center gap-1.5">
                                <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px] tracking-wide tabular-nums">
                                  {cell.type}
                                </span>
                                <select
                                  value={cell.span}
                                  onChange={(e) =>
                                    updateSpan(row.id, cell.id, Number(e.target.value))
                                  }
                                  className="border-input bg-background focus-visible:ring-ring ml-auto h-6 rounded border px-1 pr-5 text-[11px] font-medium tracking-wide transition-colors focus-visible:ring-2 focus-visible:outline-none"
                                >
                                  {[4, 6, 8, 12].map((n) => (
                                    <option key={n} value={n}>
                                      span {n}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => deleteCell(row.id, cell.id)}
                                  aria-label="Delete cell"
                                  className="text-muted-foreground hover:text-destructive hover:bg-muted focus-visible:ring-ring grid h-6 w-6 place-items-center rounded-md transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                                >
                                  <Trash2 className="h-3.5 w-3.5 stroke-[1.75]" />
                                </button>
                              </div>
                              {cell.type === "header" && (
                                <div className="space-y-2">
                                  <Input
                                    value={cell.text}
                                    onChange={(e) =>
                                      updateHeader(row.id, cell.id, e.target.value, cell.level ?? 2)
                                    }
                                    className="h-7 text-xs focus-visible:ring-2"
                                    placeholder="Header text"
                                  />
                                  <select
                                    value={cell.level ?? 2}
                                    onChange={(e) =>
                                      updateHeader(
                                        row.id,
                                        cell.id,
                                        cell.text,
                                        Number(e.target.value) as 1 | 2 | 3,
                                      )
                                    }
                                    className="border-input bg-background focus-visible:ring-ring h-6 w-full rounded border px-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                                  >
                                    <option value={1}>Level 1 — large</option>
                                    <option value={2}>Level 2 — medium</option>
                                    <option value={3}>Level 3 — small</option>
                                  </select>
                                </div>
                              )}
                              {cell.type === "markdown" && (
                                <textarea
                                  value={cell.content}
                                  onChange={(e) => updateMarkdown(row.id, cell.id, e.target.value)}
                                  rows={3}
                                  className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-2 py-2 text-xs leading-relaxed focus-visible:ring-2 focus-visible:outline-none"
                                  placeholder="Markdown, **bold**, `code`"
                                />
                              )}
                              {cell.type === "chart" &&
                                (() => {
                                  const chart = editChartMap.get(cell.chartId);
                                  const dataset =
                                    chart?.datasetId != null
                                      ? pickerDatasets.get(chart.datasetId)
                                      : null;
                                  if (!chart || !dataset)
                                    return (
                                      <p className="text-muted-foreground text-xs leading-relaxed">
                                        Chart {cell.chartId} not found
                                      </p>
                                    );
                                  return (
                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="min-w-0 flex-1 truncate text-xs font-medium tracking-tight text-balance">
                                          {chart.name}
                                        </span>
                                        <Badge
                                          variant="secondary"
                                          className="font-mono text-[10px] tracking-wide tabular-nums"
                                        >
                                          {chart.vizType}
                                        </Badge>
                                      </div>
                                      <p className="text-muted-foreground font-mono text-[11px] tabular-nums">
                                        {dataset.source} · {chart.dataset}
                                      </p>
                                      <div className="origin-top-left scale-[0.92]">
                                        <MiniChartPreview chart={chart} dataset={dataset} />
                                      </div>
                                    </div>
                                  );
                                })()}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs focus-visible:ring-2"
                      onClick={() => setPickerOpen(true)}
                    >
                      <BarChart3 className="mr-1 h-3 w-3 stroke-[1.75]" /> Append chart row
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs focus-visible:ring-2"
                      onClick={addHeaderRow}
                    >
                      <Type className="mr-1 h-3 w-3 stroke-[1.75]" /> Append header
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs focus-visible:ring-2"
                      onClick={addMarkdownRow}
                    >
                      <FileText className="mr-1 h-3 w-3 stroke-[1.75]" /> Append markdown
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chart picker slide-over */}
        {pickerOpen && (
          <div className="fixed inset-0 z-40 flex justify-end">
            <button
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => {
                setPickerOpen(false);
                setPendingPickerRow(null);
              }}
              aria-label="Close picker"
            />
            <div className="border-border bg-card relative flex h-full w-full max-w-[420px] flex-col border-l shadow-xl">
              <div className="border-border flex items-center gap-2 border-b px-4 py-3">
                <h2 className="text-sm font-semibold tracking-tight text-balance">Chart picker</h2>
                <span className="bg-muted rounded-full px-2 py-0.5 font-mono text-[11px] tracking-wide tabular-nums">
                  {pendingPickerRow ? `→ row ${pendingPickerRow.slice(-4)}` : "append row"}
                </span>
                <button
                  onClick={() => {
                    setPickerOpen(false);
                    setPendingPickerRow(null);
                  }}
                  aria-label="Close"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring ml-auto grid h-7 w-7 place-items-center rounded-md transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                >
                  <X className="h-4 w-4 stroke-[1.75]" />
                </button>
              </div>
              <div className="p-3">
                <div className="relative">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 stroke-[1.75]" />
                  <Input
                    value={pickerQ}
                    onChange={(e) => setPickerQ(e.target.value)}
                    placeholder="Search charts by name, viz, dataset…"
                    className="h-8 pl-8 text-xs focus-visible:ring-2"
                  />
                </div>
                <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed text-pretty">
                  Source:{" "}
                  <code className="bg-muted rounded border px-1 font-mono text-[11px]">
                    GET /api/charts
                  </code>{" "}
                  +{" "}
                  <code className="bg-muted rounded border px-1 font-mono text-[11px]">
                    GET /api/datasets
                  </code>{" "}
                  — live via Drizzle.
                </p>
              </div>
              <div className="flex-1 space-y-2 overflow-auto p-3">
                {pickerLoading ? (
                  <p className="text-muted-foreground p-6 text-center text-xs leading-relaxed">
                    Loading charts…
                  </p>
                ) : pickerError ? (
                  <p className="text-destructive p-6 text-center text-xs leading-relaxed font-medium">
                    {pickerError}
                  </p>
                ) : filteredCharts.length === 0 ? (
                  <p className="text-muted-foreground p-6 text-center text-xs leading-relaxed text-pretty">
                    No charts match “{pickerQ}”.
                  </p>
                ) : (
                  filteredCharts.map((c) => {
                    const ds = c.datasetId != null ? pickerDatasets.get(c.datasetId) : undefined;
                    return (
                      <button
                        key={c.id}
                        onClick={() =>
                          pendingPickerRow
                            ? addChartToRow(c.id, pendingPickerRow)
                            : addChartToNewRow(c.id)
                        }
                        className="border-border hover:bg-muted/60 focus-visible:ring-ring flex w-full flex-col gap-1 rounded-lg border p-3 text-left shadow-sm transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs leading-tight font-medium tracking-tight text-balance">
                            {c.name}
                          </span>
                          <Badge
                            variant="secondary"
                            className="ml-auto font-mono text-[10px] tracking-wide tabular-nums"
                          >
                            {c.vizType}
                          </Badge>
                        </span>
                        <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
                          {c.dataset} · {c.database}.{c.schema} · by {c.createdBy?.name ?? "Sample"}
                        </span>
                        <span className="text-muted-foreground text-[11px]">
                          {ds
                            ? `${ds.columns.length} cols · ${ds.metrics.length} metrics`
                            : "No dataset"}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              <div className="border-border flex items-center gap-2 border-t px-4 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs focus-visible:ring-2"
                  onClick={() => {
                    setPickerOpen(false);
                    setPendingPickerRow(null);
                  }}
                >
                  Cancel
                </Button>
                <Link
                  to="/explore"
                  className="text-primary focus-visible:ring-ring ml-auto rounded-sm text-xs font-medium tracking-tight underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  Create new chart in Explore →
                </Link>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className="border-border bg-card fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-3.5 py-2.5 text-sm font-medium shadow-xl">
            {toast}
          </div>
        )}
      </div>
    </AppShell>
  );
}
