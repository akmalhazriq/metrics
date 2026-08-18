import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  CalendarRange,
  Download,
  Expand,
  Link2,
  Pencil,
  RefreshCw,
  Star,
  Timer,
  Sparkles,
  Send,
  Loader2,
  X,
  TrendingUp,
  AlertTriangle,
  Target,
  GitBranch,
  ChevronDown,
  ChevronUp,
  Table2,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DrillDetailModal } from "@/components/charts/drill-detail-modal";
import { fetchList } from "@/lib/api";
import type { Dashboard, DashboardLayoutCell } from "@/types/dashboard";
import type { Chart } from "@/types/chart";
import type { Dataset, DatasetColumn, DatasetSampleRow } from "@/types/dataset";
import type { ConverseResponse, Insight } from "@/types/ai";

const ChartRenderer = lazy(() => import("@/components/charts/ChartRenderer"));

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
  crossFilters: { dimension: string; value: string }[] = [],
) {
  const raw = ds.sampleRows ?? [];
  // Apply cross-filters that are relevant to this dataset (skip filters for columns this dataset lacks)
  const filtered = !crossFilters.length
    ? raw
    : raw.filter((r) =>
        crossFilters.every((f) => {
          if (!(ds.columns ?? []).some((c) => c.name === f.dimension)) return true;
          return String((r as Record<string, unknown>)[f.dimension] ?? "") === f.value;
        }),
      );
  const sample = filtered as typeof raw;
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

function ChartCell({
  chart,
  dataset,
  insight,
  highlighted,
  onInsightClick,
  crossFilters,
  onCrossFilter,
  selectedValue,
  onOpenDrill,
}: {
  chart: Chart;
  dataset: Dataset;
  insight?: Insight;
  highlighted?: boolean;
  onInsightClick?: () => void;
  crossFilters?: { chartId: number; dimension: string; value: string }[];
  onCrossFilter?: (dimension: string, value: string) => void;
  selectedValue?: string | null;
  onOpenDrill?: (payload: {
    title: string;
    subtitle?: string;
    columns: DatasetColumn[];
    rows: DatasetSampleRow[];
  }) => void;
}) {
  const dimension = useMemo(
    () => (dataset.columns ?? []).find((c) => c.groupable)?.name ?? null,
    [dataset],
  );
  const metric = useMemo(() => (dataset.metrics ?? [])[0] ?? null, [dataset]);
  // Filters from *other* charts only — this chart's own filter highlights, not filters itself
  const relevantFilters = useMemo(() => {
    if (!crossFilters?.length) return [] as { dimension: string; value: string }[];
    return crossFilters
      .filter((f) => f.chartId !== chart.id)
      .filter((f) => (dataset.columns ?? []).some((c) => c.name === f.dimension))
      .map((f) => ({ dimension: f.dimension, value: f.value }));
  }, [crossFilters, chart.id, dataset]);
  const { rows, metricLabel } = useMemo(
    () => aggregateForChart(dataset, dimension, metric?.name ?? null, 10, relevantFilters),
    [dataset, dimension, metric, relevantFilters],
  );
  const filteredRawRows = useMemo(() => {
    const raw = dataset.sampleRows ?? [];
    if (!relevantFilters.length) return raw;
    return raw.filter((r) =>
      relevantFilters.every(
        (f) => String((r as Record<string, unknown>)[f.dimension] ?? "") === f.value,
      ),
    );
  }, [dataset, relevantFilters]);
  const isBar = chart.vizType === "Bar";
  const filteredCount = filteredRawRows.length;
  const totalCount = dataset.sampleRows?.length ?? 0;
  const isFiltered = relevantFilters.length > 0 && filteredCount !== totalCount;

  const handleDrillAll = () => {
    if (!onOpenDrill) return;
    onOpenDrill({
      title: chart.name,
      subtitle: relevantFilters.length
        ? `All rows — filtered by ${relevantFilters.map((f) => `${f.dimension} = "${f.value}"`).join(" · ")} · right-click any bar for a single value`
        : `All rows from ${dataset.source} · right-click any bar to drill into a single ${dimension ?? "category"}`,
      columns: dataset.columns ?? [],
      rows: filteredRawRows,
    });
  };
  const handleDrillDetail = (payload: { dimension: string; value: string }) => {
    if (!onOpenDrill) return;
    const { dimension: d, value } = payload;
    const drillRows = filteredRawRows.filter(
      (r) => String((r as Record<string, unknown>)[d] ?? "") === value,
    );
    const crossNote = relevantFilters.length
      ? ` + ${relevantFilters.length} cross-filter${relevantFilters.length === 1 ? "" : "s"}`
      : "";
    onOpenDrill({
      title: `Rows where ${d} = "${value}"`,
      subtitle: `${drillRows.length} row${drillRows.length === 1 ? "" : "s"} from ${dataset.source}${crossNote} · ${chart.name}`,
      columns: dataset.columns,
      rows: drillRows,
    });
  };
  return (
    <div
      id={`chart-${chart.id}`}
      className={`border-border bg-card flex h-full flex-col overflow-hidden rounded-lg border shadow-sm transition-all duration-200 ${highlighted ? "ring-ai-border shadow-[0_0_0_4px_color-mix(in_oklch,var(--ai-border)_22%,transparent)] ring-2" : "hover:border-border/60"}`}
    >
      <div className="border-border flex items-center gap-2 border-b px-3 py-[9px]">
        {insight && (
          <button
            type="button"
            onClick={onInsightClick}
            title={`${insight.title} — click to view in Insights`}
            aria-label={`Insight for ${chart.name}: ${insight.title}`}
            className="border-ai-border bg-ai-muted text-ai hover:bg-ai-muted/80 focus-visible:ring-ring grid h-5 w-5 shrink-0 place-items-center rounded-full border focus-visible:ring-2 focus-visible:outline-none"
          >
            <Sparkles className="h-3 w-3 stroke-[1.75]" />
          </button>
        )}
        <h3 className="min-w-0 flex-1 truncate text-[12.5px] font-semibold tracking-tight text-balance">
          {chart.name}
        </h3>
        {isBar && (
          <button
            type="button"
            onClick={handleDrillAll}
            title="View row-level data"
            aria-label="View row-level data"
            className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring hover:border-border grid h-6 w-6 shrink-0 place-items-center rounded-md border border-transparent focus-visible:ring-2 focus-visible:outline-none"
          >
            <Table2 className="h-3.5 w-3.5 stroke-[1.75]" />
          </button>
        )}
        {isBar && dimension && (
          <span className="text-muted-foreground hidden font-mono text-[10px] tracking-wide sm:inline">
            click bar to filter
          </span>
        )}
        {isFiltered && (
          <span className="hidden rounded-full border border-amber-500/20 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-700 sm:inline dark:text-amber-300">
            filtered · {filteredCount}/{totalCount}
          </span>
        )}
        <Badge variant="secondary" className="shrink-0 font-mono text-[10px] tracking-wide">
          {chart.vizType}
        </Badge>
      </div>
      <div className="min-h-[220px] flex-1">
        <Suspense
          fallback={
            <div className="text-muted-foreground grid h-[260px] place-items-center p-4 text-xs">
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
            rawRows={filteredRawRows}
            rowLimit={10}
            onCrossFilter={
              isBar && dimension && onCrossFilter ? (v) => onCrossFilter(dimension, v) : undefined
            }
            selectedValue={isBar ? (selectedValue ?? null) : null}
            onDrillDetail={isBar && dimension ? handleDrillDetail : undefined}
          />
        </Suspense>
      </div>
      <div className="border-border bg-muted/20 flex items-center gap-1.5 border-t px-3 py-1.5">
        <span className="bg-muted rounded-full px-1.5 py-0.5 font-mono text-[10px]">
          {dataset.source}
        </span>
        <span className="text-muted-foreground hidden text-[11px] sm:inline">
          · {(dataset.metrics ?? []).length} metrics
        </span>
        {isFiltered ? (
          <span className="hidden text-[11px] text-amber-700 sm:inline dark:text-amber-300">
            · filtered by {relevantFilters.map((f) => `${f.dimension}:${f.value}`).join(", ")}
          </span>
        ) : null}
        <Link
          to={`/explore`}
          className="text-primary ml-auto hidden text-[11px] hover:underline sm:inline"
        >
          Edit in Explore →
        </Link>
      </div>
    </div>
  );
}

function CellRenderer({
  cell,
  chartMap,
  datasetMap,
  chartErrors,
  chartsLoading,
  insightMap,
  highlightedChartId,
  onBadgeClick,
  crossFilters,
  onCrossFilter,
  onOpenDrill,
}: {
  cell: DashboardLayoutCell;
  chartMap?: Map<number, Chart>;
  datasetMap?: Map<number, Dataset>;
  chartErrors?: Map<number, string>;
  chartsLoading?: boolean;
  insightMap?: Map<number, Insight>;
  highlightedChartId?: number | null;
  onBadgeClick?: (chartId: number) => void;
  crossFilters?: { chartId: number; dimension: string; value: string }[];
  onCrossFilter?: (chartId: number, dimension: string, value: string) => void;
  onOpenDrill?: (payload: {
    title: string;
    subtitle?: string;
    columns: DatasetColumn[];
    rows: DatasetSampleRow[];
  }) => void;
}) {
  if (cell.type === "divider")
    return <div className="border-border col-span-12 border-t" aria-hidden />;
  if (cell.type === "header") {
    const Tag = cell.level === 1 ? "h2" : cell.level === 3 ? "h4" : "h3";
    const size =
      cell.level === 1
        ? "text-[22px] font-semibold tracking-tight"
        : cell.level === 3
          ? "text-sm font-semibold"
          : "text-base font-semibold tracking-tight";
    return (
      <div
        className={`col-span-12 ${cell.span === 12 ? "" : cell.span === 6 ? "col-span-12 lg:col-span-6" : "col-span-12"}`}
      >
        <Tag className={size}>{cell.text}</Tag>
      </div>
    );
  }
  if (cell.type === "markdown") {
    // Minimal markdown: bold via **, code via backticks — keep token-styled, not a generic prose dump
    const html = cell.content
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(
        /`([^`]+)`/g,
        '<code class="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">$1</code>',
      );
    return (
      <div className={`col-span-12 ${cell.span === 12 ? "" : "col-span-12 lg:col-span-6"}`}>
        <div
          className="bg-muted/30 border-border text-muted-foreground rounded-md border px-3 py-2 text-xs leading-relaxed"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  }
  if (cell.type === "chart") {
    const chart = chartMap?.get(cell.chartId);
    const chartError = chartErrors?.get(cell.chartId);
    if (chartError) {
      return (
        <div
          className={`col-span-12 ${cell.span === 12 ? "" : cell.span === 6 ? "col-span-12 lg:col-span-6" : cell.span === 4 ? "col-span-12 lg:col-span-4" : "col-span-12"}`}
        >
          <div className="border-destructive/30 bg-destructive/10 grid place-items-center rounded-lg border p-8 text-center">
            <p className="text-sm font-medium">Failed to load chart {cell.chartId}</p>
            <p className="text-muted-foreground mt-1 font-mono text-[11px]">{chartError}</p>
          </div>
        </div>
      );
    }
    if (!chart) {
      if (chartsLoading) {
        return (
          <div
            className={`col-span-12 ${cell.span === 12 ? "" : cell.span === 6 ? "col-span-12 lg:col-span-6" : cell.span === 4 ? "col-span-12 lg:col-span-4" : "col-span-12"}`}
          >
            <div className="border-border bg-card h-[280px] animate-pulse rounded-lg border" />
          </div>
        );
      }
      return (
        <div
          className={`col-span-12 ${cell.span === 12 ? "" : cell.span === 6 ? "col-span-12 lg:col-span-6" : cell.span === 4 ? "col-span-12 lg:col-span-4" : "col-span-12"}`}
        >
          <div className="border-border bg-card grid place-items-center rounded-lg border p-8 text-center">
            <p className="text-sm font-medium">Chart {cell.chartId} not found</p>
            <p className="text-muted-foreground mt-1 font-mono text-[11px]">
              Check database — this id may have been removed.
            </p>
          </div>
        </div>
      );
    }
    const dataset = chart.datasetId != null ? datasetMap?.get(chart.datasetId) : undefined;
    if (!dataset) {
      if (chartsLoading) {
        return (
          <div
            className={`col-span-12 ${cell.span === 12 ? "" : cell.span === 6 ? "col-span-12 lg:col-span-6" : "col-span-12"}`}
          >
            <div className="border-border bg-card h-[280px] animate-pulse rounded-lg border" />
          </div>
        );
      }
      return (
        <div className={`col-span-12 ${cell.span === 12 ? "" : "col-span-12 lg:col-span-6"}`}>
          <div className="border-border bg-card grid place-items-center rounded-lg border p-8 text-center">
            <p className="text-sm font-medium">Dataset missing for {chart.name}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {chart.dataset} · {chart.database}.{chart.schema}
            </p>
          </div>
        </div>
      );
    }
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
    const insight = insightMap?.get(chart.id);
    const highlighted = highlightedChartId === chart.id;
    const selectedValue = crossFilters?.find((f) => f.chartId === chart.id)?.value ?? null;
    return (
      <div className={spanCls}>
        <ChartCell
          chart={chart}
          dataset={dataset}
          insight={insight}
          highlighted={highlighted}
          onInsightClick={insight ? () => onBadgeClick?.(chart.id) : undefined}
          crossFilters={crossFilters}
          selectedValue={selectedValue}
          onCrossFilter={
            onCrossFilter ? (dim, val) => onCrossFilter(chart.id, dim, val) : undefined
          }
          onOpenDrill={onOpenDrill}
        />
      </div>
    );
  }
  return null;
}

export default function DashboardViewPage() {
  const { id } = useParams<{ id: string }>();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorite, setFavorite] = useState<boolean | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<"off" | "10s" | "30s" | "60s">("off");
  const [refreshTick, setRefreshTick] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // — Conversational assistant (Dashboard) — boldest --ai surface, session memory only
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiExchanges, setAiExchanges] = useState<
    { id: number; prompt: string; response: ConverseResponse }[]
  >([]);
  const aiScrollRef = useRef<HTMLDivElement>(null);
  // Insights strip — ambient intelligence, auto-fetched, not a notification queue
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsCollapsed, setInsightsCollapsed] = useState(false);
  const [highlightedChartId, setHighlightedChartId] = useState<number | null>(null);
  const [highlightedInsightId, setHighlightedInsightId] = useState<string | null>(null);
  const insightsStripRef = useRef<HTMLDivElement>(null);

  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2200);
  };

  // Cross-filtering — dashboard-level state shared across chart cells
  const [crossFilters, setCrossFilters] = useState<
    { chartId: number; dimension: string; value: string }[]
  >([]);

  const handleCrossFilter = (chartId: number, dimension: string, value: string) => {
    setCrossFilters((prev) => {
      const existing = prev.find((f) => f.chartId === chartId);
      if (existing) {
        if (existing.value === value && existing.dimension === dimension) {
          showToast(`Filter cleared, ${dimension}: ${value}`);
          return prev.filter((f) => f.chartId !== chartId);
        }
        showToast(`Filter: ${dimension} = ${value}`);
        return prev.map((f) => (f.chartId === chartId ? { chartId, dimension, value } : f));
      }
      showToast(`Filter: ${dimension} = ${value}`);
      return [...prev, { chartId, dimension, value }];
    });
  };
  const clearCrossFilter = (chartId: number) => {
    const f = crossFilters.find((x) => x.chartId === chartId);
    if (f) showToast(`Filter cleared, ${f.dimension}: ${f.value}`);
    setCrossFilters((prev) => prev.filter((x) => x.chartId !== chartId));
  };
  const clearAllCrossFilters = () => {
    if (crossFilters.length)
      showToast(`Cleared ${crossFilters.length} filter${crossFilters.length === 1 ? "" : "s"}`);
    setCrossFilters([]);
  };

  // Drill-to-detail — row-level data behind a bar
  const [drill, setDrill] = useState<{
    open: boolean;
    title: string;
    subtitle?: string;
    columns: DatasetColumn[];
    rows: DatasetSampleRow[];
  }>({ open: false, title: "", columns: [], rows: [] });
  const openDrill = (payload: {
    title: string;
    subtitle?: string;
    columns: DatasetColumn[];
    rows: DatasetSampleRow[];
  }) => setDrill({ open: true, ...payload });
  const closeDrill = () => setDrill((d) => ({ ...d, open: false }));

  const dashboardChartIds = useMemo(() => {
    if (!dashboard) return [];
    const ids: number[] = [];
    for (const row of dashboard.layout ?? [])
      for (const c of row.cells) if (c.type === "chart") ids.push(c.chartId);
    return ids;
  }, [dashboard]);

  // Live charts + datasets for every chart cell — batch fetch via Promise.all + fetchList
  const [chartMap, setChartMap] = useState<Map<number, Chart>>(new Map());
  const [datasetMap, setDatasetMap] = useState<Map<number, Dataset>>(new Map());
  const [chartsLoading, setChartsLoading] = useState(false);
  const [chartErrors, setChartErrors] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    if (!dashboardChartIds.length) {
      setChartMap(new Map());
      setDatasetMap(new Map());
      setChartErrors(new Map());
      return;
    }
    let cancelled = false;
    setChartsLoading(true);
    setChartErrors(new Map());
    const fetchCharts = async () => {
      try {
        const results = await Promise.all(
          dashboardChartIds.map(async (cid) => {
            try {
              const res = await fetch(`/api/charts/${cid}`);
              if (!res.ok)
                throw new Error(
                  (await res.json().catch(() => null))?.message ?? `HTTP ${res.status}`,
                );
              const json = (await res.json()) as { data: Chart };
              return { cid, chart: json.data, error: null as string | null };
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : "Failed to load chart";
              return { cid, chart: null as Chart | null, error: msg };
            }
          }),
        );
        if (cancelled) return;
        const nextChartMap = new Map<number, Chart>();
        const nextErrors = new Map<number, string>();
        const datasetIds = new Set<number>();
        for (const r of results) {
          if (r.chart && !r.error) {
            nextChartMap.set(r.cid, r.chart);
            if (r.chart.datasetId != null) datasetIds.add(r.chart.datasetId);
          } else if (r.error) nextErrors.set(r.cid, r.error);
        }
        setChartMap(nextChartMap);
        setChartErrors(nextErrors);
        // Fetch datasets live (single request, then filter to needed ids)
        if (datasetIds.size) {
          try {
            const dsRes = await fetchList<Dataset>("/api/datasets", { page: 1, pageSize: 50 });
            if (cancelled) return;
            const nextDatasetMap = new Map<number, Dataset>();
            for (const ds of dsRes.data) if (datasetIds.has(ds.id)) nextDatasetMap.set(ds.id, ds);
            setDatasetMap(nextDatasetMap);
          } catch {
            if (!cancelled) setDatasetMap(new Map());
          }
        } else setDatasetMap(new Map());
      } finally {
        if (!cancelled) setChartsLoading(false);
      }
    };
    void fetchCharts();
    return () => {
      cancelled = true;
    };
  }, [dashboardChartIds]);

  const sendDashboardAi = async (override?: string) => {
    const msg = (override ?? aiInput).trim();
    if (!msg || aiBusy || !dashboard) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/converse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          context: { surface: "dashboard", dashboardId: dashboard.id, chartIds: dashboardChartIds },
        }),
      });
      const data = (await res.json()) as ConverseResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setAiExchanges((prev) => [
        ...prev.slice(-3),
        { id: Date.now(), prompt: msg, response: data },
      ]);
      setAiInput("");
      requestAnimationFrame(() =>
        aiScrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }),
      );
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : "Couldn’t reach the assistant");
    } finally {
      setAiBusy(false);
    }
  };

  const insightByChartId = useMemo(() => {
    const m = new Map<number, Insight>();
    for (const ins of insights)
      if (ins.chartId != null && !m.has(ins.chartId)) m.set(ins.chartId, ins);
    return m;
  }, [insights]);

  const handleInsightClick = (ins: Insight) => {
    if (ins.chartId == null) return;
    setHighlightedChartId(ins.chartId);
    setHighlightedInsightId(ins.id);
    const el = document.getElementById(`chart-${ins.chartId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      setHighlightedChartId(null);
      setHighlightedInsightId(null);
    }, 2000);
  };

  const handleBadgeClick = (chartId: number) => {
    setInsightsCollapsed(false);
    const ins = insights.find((i) => i.chartId === chartId);
    if (ins) setHighlightedInsightId(ins.id);
    insightsStripRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightedChartId(chartId);
    window.setTimeout(() => {
      setHighlightedChartId(null);
      setHighlightedInsightId(null);
    }, 2000);
  };

  // Auto-fetch insights when dashboard + chartIds are ready (and on refresh) — uses live datasets
  useEffect(() => {
    if (!dashboard || dashboardChartIds.length === 0) {
      setInsights([]);
      return;
    }
    if (chartsLoading || !chartMap.size) return;
    const payloadMap = new Map<
      number,
      { datasetId: number; sampleRows: Record<string, unknown>[] }
    >();
    for (const cid of dashboardChartIds) {
      const chart = chartMap.get(cid);
      if (!chart || chart.datasetId == null) continue;
      const d = datasetMap.get(chart.datasetId);
      if (!d) continue;
      if (!payloadMap.has(d.id))
        payloadMap.set(d.id, {
          datasetId: d.id,
          sampleRows: (d.sampleRows ?? []) as Record<string, unknown>[],
        });
    }
    const datasets = [...payloadMap.values()];
    if (!datasets.length) {
      setInsights([]);
      return;
    }
    setInsightsLoading(true);
    fetch("/api/ai/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dashboardId: dashboard.id, chartIds: dashboardChartIds, datasets }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ insights: Insight[] }>;
      })
      .then((data) => setInsights(data.insights ?? []))
      .catch(() => setInsights([]))
      .finally(() => setInsightsLoading(false));
  }, [dashboard, dashboardChartIds, refreshTick, chartMap, datasetMap, chartsLoading]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/dashboards/${id}`)
      .then(async (r) => {
        if (!r.ok)
          throw new Error((await r.json().catch(() => null))?.message ?? `HTTP ${r.status}`);
        return r.json() as Promise<{ data: Dashboard }>;
      })
      .then((res) => {
        if (cancelled) return;
        setDashboard(res.data);
        setFavorite(res.data.favorite);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load dashboard");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, refreshTick]);

  // auto-refresh
  useEffect(() => {
    if (autoRefresh === "off") return;
    const ms = autoRefresh === "10s" ? 10000 : autoRefresh === "30s" ? 30000 : 60000;
    const t = window.setInterval(() => setRefreshTick((x) => x + 1), ms);
    return () => window.clearInterval(t);
  }, [autoRefresh]);

  // fullscreen sync
  useEffect(() => {
    const h = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && canvasRef.current)
        await canvasRef.current.requestFullscreen();
      else if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      showToast("Fullscreen not available");
    }
  };

  const handleExport = () => {
    if (!dashboard) return;
    const blob = new Blob([JSON.stringify(dashboard, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dashboard.slug}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Dashboard JSON exported");
  };

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
          <div className="border-border bg-card rounded-lg border p-4">
            <div className="bg-muted h-5 w-48 animate-pulse rounded" />
            <div className="bg-muted mt-3 h-3 w-72 animate-pulse rounded" />
            <div className="mt-6 grid grid-cols-12 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="col-span-12 lg:col-span-6">
                  <div className="bg-muted h-[280px] animate-pulse rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !dashboard) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6">
          <div className="border-border bg-card rounded-lg border p-10 text-center">
            <p className="text-sm font-semibold">Dashboard not found</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {error ?? `No dashboard with id ${id}`}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard/list">Back to Dashboards</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/explore">Open Explore</Link>
              </Button>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const fav = favorite ?? dashboard.favorite;
  const layout = dashboard.layout ?? [];
  const hasLayout = layout.length > 0 && layout.some((r) => r.cells.length > 0);

  return (
    <AppShell>
      <div className="min-h-[calc(100vh-44px)]">
        {/* Header — clinical, dense, title-first */}
        <div className="border-border bg-card sticky top-[44px] z-20 border-b">
          <div className="mx-auto max-w-[1280px] px-4 py-3.5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="max-w-[28ch] min-w-0 truncate text-[18px] font-semibold tracking-tight text-balance sm:text-[20px] sm:tracking-tight">
                    {dashboard.title}
                  </h1>
                  {dashboard.certified && (
                    <span className="bg-info text-info-foreground rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide">
                      CERTIFIED
                    </span>
                  )}
                  <Badge
                    variant={
                      dashboard.status === "published"
                        ? "success"
                        : dashboard.status === "draft"
                          ? "warning"
                          : "muted"
                    }
                    className="tracking-wide capitalize"
                  >
                    {dashboard.status}
                  </Badge>
                  <span className="text-muted-foreground hidden font-mono text-[11px] tracking-wide sm:inline">
                    /{dashboard.slug}
                  </span>
                </div>
                {dashboard.description && (
                  <p className="text-muted-foreground mt-1.5 max-w-[64ch] text-xs leading-relaxed text-pretty">
                    {dashboard.description}
                  </p>
                )}
                <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-xs">
                  <span className="text-muted-foreground tabular-nums">
                    {formatDate(dashboard.modified)} {formatTime(dashboard.modified)} · by{" "}
                    {dashboard.modifiedBy?.name ?? "Sample"}
                  </span>
                  <span className="bg-border hidden h-3 w-px sm:inline-block" aria-hidden />
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-muted-foreground hidden text-[11px] tracking-wide sm:inline">
                      Owners
                    </span>
                    {(dashboard.owners ?? []).slice(0, 3).map((o) => (
                      <span
                        key={o.id}
                        title={o?.name ?? "Sample"}
                        className="border-card bg-muted ring-border grid h-6 w-6 place-items-center rounded-full border text-[10px] font-medium ring-1"
                      >
                        {initials(o?.name ?? "Sample")}
                      </span>
                    ))}
                    {(dashboard.owners ?? []).length > 3 && (
                      <span className="text-muted-foreground text-xs">
                        +{(dashboard.owners ?? []).length - 3}
                      </span>
                    )}
                  </span>
                  {dashboard.tags.length > 0 && (
                    <>
                      <span className="bg-border hidden h-3 w-px sm:inline-block" aria-hidden />
                      <span className="flex flex-wrap gap-1">
                        {dashboard.tags.map((t) => (
                          <Badge key={t} variant="secondary" className="text-[11px] tracking-wide">
                            {t}
                          </Badge>
                        ))}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={async () => {
                    const next = !fav;
                    try {
                      const res = await fetch(`/api/dashboards/${dashboard.id}`, {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ favorite: next }),
                      });
                      if (!res.ok) throw new Error();
                      setFavorite(next);
                      showToast(next ? "Added to favorites" : "Removed from favorites");
                    } catch {
                      showToast("Could not update favorite");
                    }
                  }}
                  className={`grid h-8 w-8 place-items-center rounded-md border text-xs ${fav ? "border-favorite bg-favorite text-favorite-foreground" : "border-input bg-background text-muted-foreground hover:text-foreground"}`}
                  aria-label="Toggle favorite"
                  title={fav ? "Favorited" : "Favorite"}
                >
                  <Star className={`h-4 w-4 ${fav ? "fill-current" : ""}`} />
                </button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    showToast("Link copied");
                  }}
                >
                  <Link2 className="mr-1 h-3.5 w-3.5" /> Share
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExport}>
                  <Download className="mr-1 h-3.5 w-3.5" /> Export
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                  <Link to={`/dashboard/${dashboard.id}/edit`}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                  </Link>
                </Button>
                <span className="bg-border mx-1 hidden h-6 w-px sm:inline-block" />
                <div className="relative">
                  <select
                    value={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.value as typeof autoRefresh)}
                    className="border-input bg-background h-8 rounded-md border pr-7 pl-7 text-xs font-medium"
                  >
                    <option value="off">No auto-refresh</option>
                    <option value="10s">Every 10s</option>
                    <option value="30s">Every 30s</option>
                    <option value="60s">Every 60s</option>
                  </select>
                  <Timer className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setRefreshTick((x) => x + 1)}
                >
                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={toggleFullscreen}
                >
                  <Expand className="mr-1 h-3.5 w-3.5" /> {isFullscreen ? "Exit" : "Fullscreen"}
                </Button>
              </div>
            </div>

            {/* Native filter bar — quiet, clinical */}
            <div className="border-border bg-muted/30 mt-3.5 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2.5">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase">
                <CalendarRange className="h-3.5 w-3.5 stroke-[1.75]" /> Filters
              </span>
              <span className="bg-border hidden h-4 w-px sm:inline-block" aria-hidden />
              <label className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground tracking-wide">Date range</span>
                <select
                  className="border-input bg-background focus-visible:ring-ring h-7 rounded-md border px-2 pr-6 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
                  defaultValue="Last 7 days"
                  onChange={() =>
                    showToast(
                      "Dashboard filters are set up in the dashboard builder. Coming in a future update.",
                    )
                  }
                >
                  <option>Last 7 days</option>
                  <option>Last 30 days</option>
                  <option>Last 90 days</option>
                  <option>Q2 2026</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground tracking-wide">Status</span>
                <select
                  className="border-input bg-background focus-visible:ring-ring h-7 rounded-md border px-2 pr-6 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
                  defaultValue="All"
                  onChange={() =>
                    showToast(
                      "Dashboard filters are set up in the dashboard builder. Coming in a future update.",
                    )
                  }
                >
                  <option>All</option>
                  <option>paid</option>
                  <option>shipped</option>
                  <option>refunded</option>
                </select>
              </label>
              <span className="text-muted-foreground ml-auto hidden max-w-[36ch] truncate text-[11px] leading-relaxed tracking-wide sm:inline">
                Click a bar on any Bar chart to cross-filter other charts · filters stay static in
                this view
              </span>
              <button
                onClick={() =>
                  showToast(
                    "Dashboard filters are set up in the dashboard builder. Coming in a future update.",
                  )
                }
                className="border-input bg-background hover:bg-accent focus-visible:ring-ring rounded-md border px-2.5 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
                type="button"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Insights strip — ambient intelligence, between header and canvas */}
        <div ref={insightsStripRef} className="mx-auto max-w-[1280px] px-4 pt-3 sm:px-6">
          <div
            className={`overflow-hidden rounded-lg border shadow-sm ${
              insightsCollapsed ? "bg-card border-ai-border/50" : "bg-ai-muted/30 border-ai-border"
            }`}
          >
            {/* Strip header — always visible, compact 32-36px when collapsed */}
            <button
              type="button"
              onClick={() => setInsightsCollapsed((v) => !v)}
              className="hover:bg-ai-muted/40 flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
              aria-expanded={!insightsCollapsed}
            >
              <span className="bg-ai text-ai-foreground grid h-6 w-6 place-items-center rounded-md">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-semibold tracking-wide">Insights</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  insights.length ? "bg-ai text-ai-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {insightsLoading ? "…" : insights.length}
              </span>
              {!insightsCollapsed && insights.length > 0 && (
                <span className="text-muted-foreground hidden text-[11px] sm:inline">
                  · {insights.length} signal{insights.length === 1 ? "" : "s"} · glanceable — not a
                  feed
                </span>
              )}
              {insightsCollapsed && !insightsLoading && insights.length > 0 && (
                <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                  — {insights[0].title}
                  {insights[0].change ? ` · ${insights[0].change.delta}` : ""}
                </span>
              )}
              {insightsCollapsed && !insightsLoading && insights.length === 0 && (
                <span className="text-muted-foreground text-xs">— stable</span>
              )}
              <span className="ml-auto grid h-6 w-6 place-items-center rounded-md border border-transparent">
                {insightsCollapsed ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronUp className="h-3.5 w-3.5" />
                )}
              </span>
            </button>

            {!insightsCollapsed && (
              <div className="border-ai-border/40 border-t px-3 py-3">
                {insightsLoading ? (
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="border-border bg-card h-[132px] min-w-[300px] animate-pulse rounded-lg border"
                      />
                    ))}
                  </div>
                ) : insights.length === 0 ? (
                  <p className="text-muted-foreground py-2 text-center text-xs">
                    No anomalies detected — data looks stable
                    <span className="bg-muted ml-2 rounded-full px-2 py-0.5 font-mono text-[10px]">
                      checked {dashboardChartIds.length} chart(s)
                    </span>
                  </p>
                ) : (
                  <div className="flex [scrollbar-width:none] gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {insights.map((ins) => {
                      const Icon =
                        ins.type === "trend"
                          ? TrendingUp
                          : ins.type === "spike" || ins.type === "drop"
                            ? AlertTriangle
                            : ins.type === "outlier"
                              ? Target
                              : GitBranch;
                      const deltaColor = ins.change?.delta?.trim().startsWith("-")
                        ? "text-destructive"
                        : "text-success";
                      const isHighlighted = highlightedInsightId === ins.id;
                      return (
                        <div
                          key={ins.id}
                          onClick={() => handleInsightClick(ins)}
                          role={ins.chartId ? "button" : undefined}
                          tabIndex={ins.chartId ? 0 : undefined}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && ins.chartId) handleInsightClick(ins);
                          }}
                          className={`group bg-card flex max-w-[340px] min-w-[300px] shrink-0 cursor-pointer flex-col rounded-lg border p-3 text-left shadow-sm transition-all duration-150 hover:shadow-md focus-visible:ring-2 focus-visible:outline-none ${isHighlighted ? "ring-ai-border ring-2" : ""}`}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${
                                ins.severity === "critical"
                                  ? "border-destructive/20 bg-destructive/10 text-destructive"
                                  : ins.severity === "warning"
                                    ? "border-warning/20 bg-warning/15 text-warning-foreground"
                                    : "border-ai-border bg-ai-muted text-ai"
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs leading-tight font-semibold">
                                {ins.title}
                              </p>
                              <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-relaxed">
                                {ins.detail}
                              </p>
                            </div>
                            {ins.change && (
                              <span
                                className={`bg-muted shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[11px] font-semibold ${deltaColor}`}
                              >
                                {ins.change.delta}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-muted-foreground font-mono text-[10px]">
                              {Math.round(ins.confidence * 100)}% confidence
                            </span>
                            {ins.chartId && (
                              <span className="text-ai ml-auto text-[11px] font-medium group-hover:underline">
                                View chart →
                              </span>
                            )}
                          </div>
                          <details
                            className="group/details mt-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <summary className="text-muted-foreground hover:text-foreground cursor-pointer list-none text-[11px] font-medium">
                              <span className="group-open/details:hidden">▸ View SQL</span>
                              <span className="hidden group-open/details:inline">▾ Hide SQL</span>
                            </summary>
                            <pre className="border-ai-border bg-editor text-editor-foreground mt-1.5 overflow-auto rounded-md border p-2 font-mono text-[11px] leading-relaxed">
                              {ins.sql}
                              {ins.tablesUsed.length
                                ? `\n-- tables: ${ins.tablesUsed.join(", ")}`
                                : ""}
                            </pre>
                          </details>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-muted-foreground mt-2 text-[11px]">
                  Ambient — regenerates on load/refresh. Click a card to highlight its chart. Not
                  dismissible; absence of signals is also information.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Cross-filter chips — visible only when active */}
        {crossFilters.length > 0 && (
          <div className="mx-auto max-w-[1280px] px-4 pt-3 sm:px-6">
            <div className="bg-card border-border flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 shadow-sm">
              <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-widest uppercase">
                <span className="bg-primary/10 text-primary grid h-5 w-5 place-items-center rounded-full">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="M3 6h18M7 12h10M10 18h4" />
                  </svg>
                </span>
                Cross-filters
              </span>
              <span className="bg-border hidden h-4 w-px sm:inline-block" />
              <span className="text-muted-foreground hidden text-[11px] sm:inline">
                Click a bar to filter other charts
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {crossFilters.map((f) => (
                  <span
                    key={`${f.chartId}-${f.dimension}`}
                    className="bg-muted border-border inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
                  >
                    <span className="font-mono text-[11px]">{f.dimension}:</span>
                    <span className="max-w-[14ch] truncate font-semibold">{f.value}</span>
                    <button
                      type="button"
                      onClick={() => clearCrossFilter(f.chartId)}
                      aria-label={`Clear ${f.dimension}: ${f.value}`}
                      className="hover:bg-muted-foreground/10 -mr-1 grid h-4 w-4 place-items-center rounded-full"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                {crossFilters.length >= 2 && (
                  <button
                    type="button"
                    onClick={clearAllCrossFilters}
                    className="border-border bg-background hover:bg-muted rounded-md border px-2.5 py-1 text-xs font-medium"
                  >
                    Clear all
                  </button>
                )}
                {crossFilters.length === 1 && (
                  <button
                    type="button"
                    onClick={clearAllCrossFilters}
                    className="text-muted-foreground hover:text-foreground text-xs font-medium hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <p className="text-muted-foreground mt-1.5 px-1 text-[11px]">
              Bar clicks filter other charts (AND logic) · same bar toggles · different bar in same
              chart replaces
            </p>
          </div>
        )}

        {/* Canvas */}
        <div
          ref={canvasRef}
          className={`mx-auto max-w-[1280px] bg-[color-mix(in_oklch,var(--background),var(--muted)_4%)] px-4 py-6 sm:px-6 ${isFullscreen ? "bg-background min-h-screen" : ""}`}
        >
          {!hasLayout ? (
            <div className="border-border bg-card rounded-lg border border-dashed p-10 text-center sm:p-14">
              <div className="mx-auto max-w-[520px]">
                <div className="bg-muted mx-auto grid h-10 w-10 place-items-center rounded-full">
                  <span className="text-muted-foreground text-sm">◌</span>
                </div>
                <h2 className="mt-4 text-base font-semibold tracking-tight">
                  This dashboard has no charts yet
                </h2>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                  Add charts from Explore or reuse ones you already saved. Layout is 12-col grid in
                  this pass — Builder (drag-and-drop) is deferred.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button asChild size="sm">
                    <Link to="/explore">Open Explore</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/chart/list">Browse Chart List</Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/dashboard/list">Back to Dashboards</Link>
                  </Button>
                </div>
                <p className="text-muted-foreground mt-4 font-mono text-[11px]">
                  Empty layout array — `Dashboard.layout` in `src/types/dashboard.ts`
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {layout.map((row) => (
                <div key={row.id} className="grid grid-cols-12 gap-4">
                  {row.cells.map((cell) => (
                    <CellRenderer
                      key={cell.id}
                      cell={cell}
                      chartMap={chartMap}
                      datasetMap={datasetMap}
                      chartErrors={chartErrors}
                      chartsLoading={chartsLoading}
                      insightMap={insightByChartId}
                      highlightedChartId={highlightedChartId}
                      onBadgeClick={handleBadgeClick}
                      crossFilters={crossFilters}
                      onCrossFilter={handleCrossFilter}
                      onOpenDrill={openDrill}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="border-border bg-card mt-6 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-[11px]">
            <span className="text-muted-foreground">
              Layout: 12-col grid · {layout.length} row(s) ·{" "}
              {layout.reduce((s, r) => s + r.cells.length, 0)} cell(s)
            </span>
            <span className="bg-border hidden h-3 w-px sm:inline-block" />
            <span className="text-muted-foreground hidden sm:inline">
              Chart cells reuse <code className="bg-muted rounded px-1">ChartRenderer</code> — Bar:
              click to cross-filter, right-click / header icon for drill-to-detail. Drill-by / tabs
              deferred.
            </span>
            <Link
              to={`/dashboard/${dashboard.id}/edit`}
              className="text-primary ml-auto text-xs hover:underline"
            >
              Edit layout →
            </Link>
          </div>

          <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
            Data layer:{" "}
            <code className="bg-muted rounded px-1">routes/api/dashboards/[id].get.ts</code> ·
            charts via <code className="bg-muted rounded px-1">GET /api/charts/:id</code> +{" "}
            <code className="bg-muted rounded px-1">GET /api/datasets</code> → aggregation of{" "}
            <code className="bg-muted rounded px-1">sampleRows</code> →{" "}
            <code className="bg-muted rounded px-1">ChartRenderer</code> (lazy). Filter bar is
            static chrome in this pass.
          </p>
        </div>

        {/* Floating AI assistant — boldest --ai surface */}
        <button
          type="button"
          onClick={() => setAiOpen(true)}
          className={`fixed right-5 bottom-5 z-30 grid h-12 w-12 place-items-center rounded-full shadow-lg transition-all hover:scale-105 active:scale-95 ${aiOpen ? "bg-ai-muted text-ai border-ai-border border" : "bg-ai text-ai-foreground shadow-[0_8px_24px_color-mix(in_oklch,var(--ai)_22%,transparent)]"}`}
          aria-label="Open dashboard assistant"
          title="Ask about this dashboard"
          style={
            aiOpen
              ? undefined
              : {
                  background:
                    "linear-gradient(135deg, var(--ai), color-mix(in oklch, var(--ai) 88%, white))",
                }
          }
        >
          <Sparkles className="h-5 w-5" />
        </button>

        {aiOpen && (
          <>
            <button
              type="button"
              aria-label="Close assistant"
              onClick={() => setAiOpen(false)}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
            />
            <div className="bg-card fixed top-0 right-0 z-40 flex h-full w-[400px] max-w-[92vw] flex-col border-l shadow-2xl">
              <div className="flex items-center gap-2 border-b px-3 py-2.5">
                <span
                  className="grid h-7 w-7 place-items-center rounded-md text-white shadow"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--ai), color-mix(in oklch, var(--ai) 72%, var(--ai-foreground)))",
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold tracking-tight">Dashboard assistant</p>
                  <p className="text-muted-foreground text-[11px] leading-none">
                    Ask about {dashboard.title} — session only
                  </p>
                </div>
                <span className="bg-ai-muted border-ai-border hidden rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wide sm:inline">
                  MOCK · real schema
                </span>
                <button
                  type="button"
                  onClick={() => setAiOpen(false)}
                  className="text-muted-foreground hover:text-foreground grid h-7 w-7 place-items-center rounded-md"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div ref={aiScrollRef} className="flex-1 overflow-auto p-3 sm:p-4">
                <div className="space-y-3">
                  {aiExchanges.length === 0 && !aiBusy && (
                    <div className="border-ai-border bg-ai-muted/30 rounded-lg border border-dashed p-3">
                      <p className="text-xs font-medium">Ask about this dashboard</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[
                          "what drove the revenue dip in March?",
                          "compare this to last quarter",
                          "what changed in this dashboard?",
                          "show me revenue by region",
                        ].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => sendDashboardAi(s)}
                            className="border-ai-border bg-card hover:bg-ai-muted rounded-full border px-2.5 py-1 text-[11px] font-medium"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                      <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
                        The assistant sees{" "}
                        <span className="font-medium">{dashboardChartIds.length} chart(s)</span> on
                        this dashboard and answers with a grounded analysis + the exact SQL. A
                        generated chart preview appears when the question implies one.
                      </p>
                    </div>
                  )}

                  {aiExchanges.slice(-4).map((ex) => {
                    const r = ex.response;
                    const cfg = r.action?.payload?.chartConfig as
                      | { vizType: string; datasetId: number; dimension: string; metric: string }
                      | undefined;
                    const genDataset = cfg
                      ? (datasetMap.get(cfg.datasetId) ?? [...datasetMap.values()][0] ?? null)
                      : null;
                    const genAgg = (() => {
                      if (!cfg || !genDataset) return null;
                      const dim = cfg.dimension;
                      const met = cfg.metric;
                      const { rows, metricLabel } = aggregateForChart(genDataset, dim, met, 8);
                      const metric = (genDataset.metrics ?? []).find((m) => m.name === met) ?? null;
                      return {
                        rows,
                        metricLabel,
                        d3Format: metric?.d3Format,
                        dataset: genDataset,
                        dimension: dim,
                      };
                    })();
                    return (
                      <div
                        key={ex.id}
                        className="border-border bg-card overflow-hidden rounded-lg border shadow-sm"
                      >
                        <div className="bg-muted/30 border-b px-3 py-2">
                          <p className="text-xs font-medium">You → {ex.prompt}</p>
                        </div>
                        <div className="space-y-2 p-3">
                          <p
                            className="text-xs leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: r.reply
                                .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                                .replace(
                                  /`([^`]+)`/g,
                                  '<code class="bg-muted rounded px-1 font-mono text-[11px]">$1</code>',
                                ),
                            }}
                          />
                          {genAgg && (
                            <div className="border-border bg-muted/20 overflow-hidden rounded-md border">
                              <div className="bg-muted/40 flex items-center gap-1.5 border-b px-2 py-1">
                                <span className="bg-ai text-ai-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">
                                  PREVIEW
                                </span>
                                <span className="text-xs font-medium">
                                  {cfg!.vizType} · {cfg!.metric} by {cfg!.dimension}
                                </span>
                                <span className="text-muted-foreground font-mono text-[10px]">
                                  · {genAgg.dataset.source}
                                </span>
                              </div>
                              <div className="h-[200px]">
                                <Suspense
                                  fallback={
                                    <div className="text-muted-foreground grid h-[200px] place-items-center text-xs">
                                      Loading chart…
                                    </div>
                                  }
                                >
                                  <ChartRenderer
                                    vizType={cfg!.vizType as Chart["vizType"]}
                                    data={genAgg.rows}
                                    metricLabel={genAgg.metricLabel}
                                    d3Format={genAgg.d3Format}
                                    dataset={genAgg.dataset}
                                    dimension={genAgg.dimension}
                                    showGrid
                                    showLegend
                                    rawRows={genAgg.dataset.sampleRows ?? []}
                                    rowLimit={8}
                                  />
                                </Suspense>
                              </div>
                            </div>
                          )}
                          {r.tablesUsed?.length ? (
                            <p className="text-muted-foreground font-mono text-[10px]">
                              tables: {r.tablesUsed.join(", ")}
                            </p>
                          ) : null}
                          {r.sql && (
                            <details className="group">
                              <summary className="text-muted-foreground hover:text-foreground cursor-pointer list-none text-[11px] font-medium">
                                <span className="group-open:hidden">▸ View SQL</span>
                                <span className="hidden group-open:inline">▾ Hide SQL</span>
                              </summary>
                              <pre className="border-ai-border bg-editor text-editor-foreground mt-1.5 overflow-auto rounded-md border p-2 font-mono text-[11px] leading-relaxed">
                                {r.sql}
                              </pre>
                            </details>
                          )}
                          <div className="flex gap-1.5 pt-1">
                            <Button
                              size="sm"
                              className="bg-ai text-ai-foreground hover:bg-ai/90 h-7 text-xs"
                              onClick={() => {
                                if (cfg)
                                  showToast(
                                    "Chart ready. Pin it via Edit layout, the canvas handles real charts.",
                                  );
                                else
                                  showToast(
                                    "Analysis noted. Run the SQL in SQL Lab to drill further.",
                                  );
                              }}
                            >
                              {cfg ? "Add to dashboard" : "Use this insight"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() =>
                                setAiExchanges((prev) => prev.filter((p) => p.id !== ex.id))
                              }
                            >
                              Dismiss
                            </Button>
                            <span className="text-muted-foreground ml-auto hidden self-center text-[10px] sm:inline">
                              Reviewable — no silent write
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {aiBusy && (
                    <div className="border-ai-border bg-ai-muted/30 flex items-center gap-2 rounded-lg border p-3 text-xs">
                      <Loader2 className="text-ai h-4 w-4 animate-spin" />
                      Analyzing dashboard…
                    </div>
                  )}
                  {aiError && (
                    <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-3 text-xs">
                      {aiError}
                    </div>
                  )}
                </div>
                <p className="text-muted-foreground mt-4 text-center text-[11px]">
                  Nothing is written until you act — every suggestion is reviewable.
                </p>
              </div>

              <div className="bg-card border-t p-3">
                <div className="flex gap-2">
                  <Input
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendDashboardAi();
                      }
                    }}
                    placeholder="Ask about this dashboard…"
                    className="h-9 flex-1 text-xs"
                    disabled={aiBusy}
                  />
                  <Button
                    size="sm"
                    className="bg-ai text-ai-foreground hover:bg-ai/90 h-9 px-3"
                    onClick={() => sendDashboardAi()}
                    disabled={aiBusy || !aiInput.trim()}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-muted-foreground mt-1.5 text-[11px]">
                  Enter to send · the assistant stays in this session only
                </p>
              </div>
            </div>
          </>
        )}

        <DrillDetailModal
          open={drill.open}
          onOpenChange={(o) => !o && closeDrill()}
          title={drill.title}
          subtitle={drill.subtitle}
          columns={drill.columns}
          rows={drill.rows}
        />

        {toast && (
          <div className="border-border bg-card fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border px-3 py-2 text-sm shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </AppShell>
  );
}
