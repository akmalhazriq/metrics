import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  BarChart3,
  LineChart as LineIcon,
  Table2,
  Hash,
  PieChart,
  ScatterChart,
  Save,
  Play,
  Eye,
  Code2,
  Settings2,
  Database,
  ChevronDown,
  X,
  Layers,
  Palette,
  Sparkles,
  MessageSquare,
  Send,
  Loader2,
} from "lucide-react";

import type { ConverseResponse } from "@/types/ai";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, fetchList } from "@/lib/api";
import type { ChartVizType } from "@/types/chart";
import type { Dataset } from "@/types/dataset";

const ChartRenderer = lazy(() => import("@/components/charts/ChartRenderer"));

// -- PIVOT NOTE (2026-08-16): Swapped recharts 3.x → @tanstack/charts 0.14.0 per
//    the TanStack request. TanStack's marks-and-channels API is now the single
//    chart grammar: Bar/Line/Area use barY/lineY/areaY, Scatter uses dot,
//    Heatmap uses cell+rect, Box Plot uses boxY. Table/Big Number are Superset
//    widgets rendered as table/card inside the same ChartRenderer so the center
//    panel always consumes one component. The package is @tanstack/charts with
//    React adapter @tanstack/charts/react (peers react 19 already satisfied).
//    Recharts was uninstalled; `chart-1..5` OKLCH tokens still own every fill,
//    grid uses var(--border), ticks/tooltips use card/border/foreground tokens.

type ExploreViz = ChartVizType;
// Implemented via TanStack marks today: cartesian + rect + box. Table/Big Number are widget renders inside the same renderer.
// Remaining viz types are honest deferreds with reasons in ChartRenderer, not silent placeholders.
const SUPPORTED: ExploreViz[] = [
  "Bar",
  "Line",
  "Area",
  "Scatter",
  "Heatmap",
  "Box Plot",
  "Table",
  "Big Number",
];
const ALL_VIZ: ExploreViz[] = [
  "Bar",
  "Line",
  "Area",
  "Scatter",
  "Table",
  "Big Number",
  "Heatmap",
  "Box Plot",
  "Pie",
  "Donut",
  "Treemap",
  "Violin",
  "Sunburst",
  "Sankey",
  "Gauge",
];

const VIZ_ICON: Record<string, React.ElementType> = {
  Bar: BarChart3,
  Line: LineIcon,
  Area: LineIcon,
  Scatter: ScatterChart,
  Table: Table2,
  "Big Number": Hash,
  Heatmap: Layers,
  "Box Plot": BarChart3,
  Pie: PieChart,
  Donut: PieChart,
  Treemap: Layers,
  Violin: BarChart3,
  Sunburst: PieChart,
  Sankey: ScatterChart,
  Gauge: Palette,
};

function inferNumericKey(ds: Dataset): string | null {
  const rows = ds.sampleRows ?? [];
  for (const col of ds.columns ?? []) {
    if (!/NUMERIC|INTEGER|FLOAT|DOUBLE|DECIMAL/i.test(col.type)) continue;
    if (rows.some((r) => typeof r[col.name] === "number")) return col.name;
  }
  for (const col of ds.columns ?? []) {
    if (rows.some((r) => typeof r[col.name] === "number")) return col.name;
  }
  return null;
}

function aggregateForChart(
  ds: Dataset,
  dimension: string | null,
  metricName: string | null,
  rowLimit: number,
): { rows: { label: string; value: number }[]; bigNumber: number | null; metricLabel: string } {
  const sample = ds.sampleRows ?? [];
  if (!metricName) return { rows: [], bigNumber: null, metricLabel: "—" };
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
    return {
      rows: [{ label: "Total", value: Number(v.toFixed(2)) }],
      bigNumber: Number(v.toFixed(2)),
      metricLabel,
    };
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
  const bigNumber = Number(compute(sample).toFixed(2));
  return { rows, bigNumber, metricLabel };
}

function formatNumber(n: number, d3Format?: string) {
  if (!Number.isFinite(n)) return "—";
  if (d3Format?.includes("%")) return `${(n * 100).toFixed(2)}%`;
  if (d3Format?.includes("$"))
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (d3Format === ",.0f") return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(Number(n.toFixed(2)));
}

function buildSql(
  ds: Dataset,
  dimension: string | null,
  metricName: string | null,
  rowLimit: number,
) {
  const metric = (ds.metrics ?? []).find((m) => m.name === metricName);
  const expr = metric?.sqlExpression ?? (metricName ? metricName : "*");
  const dim = dimension ? `${dimension}, ` : "";
  const grp = dimension ? `GROUP BY ${dimension}\n` : "";
  const order = metricName ? `ORDER BY ${metricName} DESC\n` : "";
  return `SELECT\n  ${dim}${expr} AS ${metricName ?? "value"}\nFROM ${ds.source}\n${grp}${order}LIMIT ${rowLimit};`;
}

export default function ExplorePage() {
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetsLoading, setDatasetsLoading] = useState(true);
  const [datasetsError, setDatasetsError] = useState<string | null>(null);
  const [datasetId, setDatasetId] = useState<number | null>(null);
  const ds: Dataset | null = useMemo(() => {
    if (!datasets.length) return null;
    return datasets.find((d) => d.id === datasetId) ?? datasets[0] ?? null;
  }, [datasets, datasetId]);

  useEffect(() => {
    let cancelled = false;
    setDatasetsLoading(true);
    setDatasetsError(null);
    fetchList<Dataset>("/api/datasets", { page: 1, pageSize: 50 })
      .then((res) => {
        if (cancelled) return;
        setDatasets(res.data);
        if (res.data.length && datasetId == null) setDatasetId(res.data[0].id);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg =
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Failed to load datasets";
        setDatasetsError(msg);
      })
      .finally(() => {
        if (!cancelled) setDatasetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const groupableCols = useMemo(() => ds?.columns?.filter((c) => c.groupable) ?? [], [ds]);
  const [vizType, setVizType] = useState<ExploreViz>("Bar");
  const [dimension, setDimension] = useState<string | null>(() => groupableCols[0]?.name ?? null);
  const [metricName, setMetricName] = useState<string | null>(() => ds?.metrics?.[0]?.name ?? null);
  const [rowLimit, setRowLimit] = useState(10);
  const [filterText, setFilterText] = useState("");
  const [activeTab, setActiveTab] = useState<"Data" | "Customize" | "Query" | "Results">("Data");
  const [showLegend, setShowLegend] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  // — Conversational BI (Explore) — copilot panel, never auto-applies; session only
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiExchanges, setAiExchanges] = useState<
    { id: number; prompt: string; response: ConverseResponse }[]
  >([]);
  const aiScrollRef = useRef<HTMLDivElement>(null);

  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2600);
  };

  // Hydrate from ?chartId= (Chart List → Explore) — fetch real chart and populate vizType/datasetId from live datasets.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("chartId") ?? params.get("chart");
    const id = raw ? Number(raw) : NaN;
    if (!Number.isFinite(id)) return;
    let cancelled = false;
    fetch(`/api/charts/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{
          data: { id: number; vizType: string; datasetId: number | null; name: string };
        }>;
      })
      .then((res) => {
        if (cancelled) return;
        const d = res.data;
        if (d.vizType) {
          if ((SUPPORTED as string[]).includes(d.vizType)) setVizType(d.vizType as ExploreViz);
          else setVizType(d.vizType as ExploreViz);
        }
        if (d.datasetId != null) {
          setDatasetId(d.datasetId);
          const next = datasets.find((x) => x.id === d.datasetId);
          if (next) {
            setDimension(next.columns?.find((c) => c.groupable)?.name ?? null);
            setMetricName(next.metrics?.[0]?.name ?? null);
          }
        }
        showToast(`Loaded "${d.name}". Review and hit Save.`);
      })
      .catch(() => {
        if (!cancelled) showToast("We couldn't load that chart. Check the link and try again.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // hydrates once; dataset resolution re-attempts via datasets sync below

  // Keep dimension/metric in sync when live datasets finally arrive after hydration
  useEffect(() => {
    if (!datasets.length || datasetId == null) return;
    const next = datasets.find((x) => x.id === datasetId);
    if (!next) return;
    // If dimension/metric still null (hydration happened before datasets loaded), populate
    if (dimension == null && metricName == null) {
      setDimension(next.columns?.find((c) => c.groupable)?.name ?? null);
      setMetricName(next.metrics?.[0]?.name ?? null);
    }
  }, [datasets, datasetId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDatasetChange = (id: number) => {
    setDatasetId(id);
    const next = datasets.find((d) => d.id === id);
    if (!next) return;
    setDimension(next.columns?.find((c) => c.groupable)?.name ?? null);
    setMetricName(next.metrics?.[0]?.name ?? null);
  };

  const sendAi = async (override?: string) => {
    const msg = (override ?? aiInput).trim();
    if (!msg || aiBusy || !ds) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/converse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          context: {
            surface: "explore",
            datasetId: ds.id,
            vizType,
            currentQuery: sql ?? "",
          },
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

  const applyExchange = (ex: { prompt: string; response: ConverseResponse }) => {
    const a = ex.response.action;
    if (!a) {
      showToast("Nothing to apply. This was just an explanation.");
      return;
    }
    if (a.type === "modify_chart") {
      if (a.payload.vizType) {
        const v = a.payload.vizType as ExploreViz;
        if ((SUPPORTED as string[]).includes(v)) setVizType(v);
        else showToast(`${v} is deferred, shown as preview only`);
      }
      if (a.payload.dimensions?.[0]) setDimension(a.payload.dimensions[0]);
      if (a.payload.metrics?.[0]) setMetricName(a.payload.metrics[0]);
      showToast("Applied to chart. Review the preview.");
    } else if (a.type === "filter") {
      const f = a.payload.filters?.[0];
      if (f) {
        setFilterText(`${f.column} = ${f.value}`);
        showToast(`Filter applied: ${f.column} = ${f.value}`);
      }
    } else if (a.type === "generate_chart") {
      const cfg = a.payload.chartConfig;
      if (cfg) {
        if ((SUPPORTED as string[]).includes(cfg.vizType)) setVizType(cfg.vizType as ExploreViz);
        if (cfg.dimension) setDimension(cfg.dimension);
        if (cfg.metric) setMetricName(cfg.metric);
        if (ds && cfg.datasetId !== ds.id) {
          const target = datasets.find((d) => d.id === cfg.datasetId);
          if (target) onDatasetChange(target.id);
        }
        showToast("New chart applied. Inspect the preview.");
      }
    } else {
      showToast("That was an explanation, so no chart change to apply.");
    }
  };

  const {
    rows: chartRows,
    bigNumber,
    metricLabel,
  } = useMemo(
    () =>
      ds
        ? aggregateForChart(ds, dimension, metricName, rowLimit)
        : { rows: [] as { label: string; value: number }[], bigNumber: null, metricLabel: "—" },
    [ds, dimension, metricName, rowLimit],
  );

  const filteredRows = useMemo(() => {
    if (!ds) return [];
    if (!filterText.trim()) return ds.sampleRows ?? [];
    const q = filterText.toLowerCase();
    return (ds.sampleRows ?? []).filter((r) => JSON.stringify(r).toLowerCase().includes(q));
  }, [ds, filterText]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- AI panel captures `sql` forward; compiler can't prove memo stability
  const sql = useMemo(
    () => (ds ? buildSql(ds, dimension, metricName, rowLimit) : "-- loading dataset…"),
    [ds, dimension, metricName, rowLimit],
  );
  const selectedMetric = ds
    ? ((ds.metrics ?? []).find((m) => m.name === metricName) ?? null)
    : null;

  const onSave = async () => {
    if (!ds) {
      showToast("No dataset loaded, so we cannot save.");
      return;
    }
    if (!saveName.trim()) {
      showToast("Chart name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/charts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveName.trim(),
          vizType,
          datasetId: ds.id,
          description: saveDesc.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        chart?: { id: number; slug: string; name: string };
        message?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.message || data.error || "Could not save. Try again.");
      showToast(`Saved. "${data.chart?.name ?? saveName}" is now in Chart List.`);
      setShowSave(false);
      setSaveName("");
      setSaveDesc("");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="flex min-h-[calc(100vh-44px)] flex-col">
        {/* Subheader — sits directly under AppShell's 44px sidebar header; z-20 keeps it below modals/drawers */}
        <div className="border-border bg-card sticky top-[44px] z-20 border-b shadow-sm">
          <div className="flex flex-wrap items-center gap-3 px-3 py-2 sm:px-4">
            <div className="flex items-center gap-2">
              <span
                className="bg-primary text-primary-foreground grid h-7 w-7 place-items-center rounded-md"
                aria-hidden
              >
                <BarChart3 className="h-4 w-4 stroke-[1.75]" aria-hidden />
              </span>
              <h1 className="text-sm font-semibold tracking-tight text-balance">Explore</h1>
              <span className="bg-info text-info-foreground hidden rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide sm:inline">
                TANSTACK
              </span>
            </div>
            <span className="bg-border hidden h-4 w-px self-center sm:inline-block" aria-hidden />
            <label className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground hidden text-[11px] font-medium tracking-wide sm:inline">
                Dataset
              </span>
              <div className="relative">
                <select
                  value={datasetId ?? ""}
                  onChange={(e) => onDatasetChange(Number(e.target.value))}
                  aria-label="Dataset"
                  className="border-input bg-background hover:border-border focus-visible:ring-ring active:bg-muted/40 h-8 rounded-md border pr-7 pl-2 text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 motion-reduce:transition-none"
                  disabled={datasetsLoading || !!datasetsError}
                >
                  {datasetsLoading ? (
                    <option>Loading…</option>
                  ) : datasetsError ? (
                    <option>— error —</option>
                  ) : datasets.length === 0 ? (
                    <option>No datasets</option>
                  ) : (
                    datasets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} · {d.source}
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown
                  className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75]"
                  aria-hidden
                />
              </div>
            </label>
            <span className="bg-border hidden h-4 w-px self-center sm:inline-block" aria-hidden />
            <label className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground hidden text-[11px] font-medium tracking-wide sm:inline">
                Chart
              </span>
              <div className="relative">
                <select
                  value={vizType}
                  onChange={(e) => setVizType(e.target.value as ExploreViz)}
                  aria-label="Chart type"
                  className="border-input bg-background hover:border-border focus-visible:ring-ring active:bg-muted/40 h-8 rounded-md border pr-7 pl-2 text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                >
                  {ALL_VIZ.map((v) => (
                    <option key={v} value={v}>
                      {v}
                      {(SUPPORTED as string[]).includes(v) ? "" : " — deferred"}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75]"
                  aria-hidden
                />
              </div>
            </label>

            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAiOpen((v) => !v)}
                className={`focus-visible:ring-ring inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none active:opacity-90 motion-reduce:transition-none ${aiOpen ? "border-ai bg-ai text-ai-foreground shadow-sm" : "border-ai-border bg-ai-muted text-ai hover:bg-ai-muted/80"}`}
                aria-expanded={aiOpen}
                aria-label="Toggle conversational assistant"
                title={aiOpen ? "Close assistant" : "Ask about this chart"}
              >
                <Sparkles className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden />
                <span className="hidden sm:inline">{aiOpen ? "Close AI" : "Ask AI"}</span>
                <MessageSquare
                  className="hidden h-3 w-3 stroke-[1.75] opacity-60 sm:inline"
                  aria-hidden
                />
              </button>
              <Button
                variant="outline"
                size="sm"
                className="active:bg-accent/80 h-8 text-xs focus-visible:ring-2 motion-reduce:transition-none"
                onClick={() => showToast("Preview is live, no extra query needed.")}
              >
                <Play className="mr-1 h-3.5 w-3.5 stroke-[1.75]" aria-hidden />
                Run
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs focus-visible:ring-2 active:opacity-90 motion-reduce:transition-none"
                onClick={() => setShowSave(true)}
              >
                <Save className="mr-1 h-3.5 w-3.5 stroke-[1.75]" aria-hidden />
                Save chart
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground hidden border-t px-4 py-2 text-[11px] leading-relaxed text-pretty sm:block">
            {datasetsError ? (
              <span className="text-destructive font-medium">
                Failed to load datasets: {datasetsError}
              </span>
            ) : datasetsLoading ? (
              <span>Loading datasets…</span>
            ) : ds ? (
              <>
                Preview is a{" "}
                <span className="text-foreground font-medium">
                  client-side aggregation of {ds.name}&apos;s sampleRows
                </span>{" "}
                ({ds.sampleRows?.length ?? 0} rows) — not a mock image. TanStack Charts renders the
                same{" "}
                <code className="bg-muted rounded px-1 font-mono text-[11px]">ChartRenderer</code>{" "}
                that Dashboard View reuses.
              </>
            ) : (
              <span>No dataset available.</span>
            )}
          </p>
        </div>

        <div className="relative flex flex-1 flex-col lg:flex-row">
          <aside className="border-border bg-card w-full shrink-0 border-b lg:w-[280px] lg:border-r lg:border-b-0">
            <div className="space-y-5 p-4">
              <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.09em] uppercase select-none">
                <Database className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden />
                Data controls
                <span className="font-mono font-normal tracking-normal normal-case opacity-70">
                  · DatasetColumn / Metric
                </span>
              </div>

              <div className="space-y-5">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium tracking-tight">Dimension</span>
                  <div className="relative">
                    <select
                      value={dimension ?? ""}
                      onChange={(e) => setDimension(e.target.value || null)}
                      aria-label="Dimension"
                      className="border-input bg-background hover:border-border focus-visible:ring-ring active:bg-muted/40 h-8 w-full rounded-md border px-2 pr-7 text-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                    >
                      <option value="">(no grouping — total)</option>
                      {groupableCols.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} · {c.type}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75]"
                      aria-hidden
                    />
                  </div>
                  <span className="text-muted-foreground text-[11px] leading-relaxed">
                    {groupableCols.length} groupable · from{" "}
                    <code className="bg-muted rounded px-1 font-mono text-[11px]">
                      {ds?.name ?? "—"}
                    </code>
                  </span>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-medium tracking-tight">Metric</span>
                  <div className="relative">
                    <select
                      value={metricName ?? ""}
                      onChange={(e) => setMetricName(e.target.value || null)}
                      aria-label="Metric"
                      className="border-input bg-background hover:border-border focus-visible:ring-ring active:bg-muted/40 h-8 w-full rounded-md border px-2 pr-7 text-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                    >
                      {(ds?.metrics ?? []).map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.name} — {m.sqlExpression}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75]"
                      aria-hidden
                    />
                  </div>
                  {selectedMetric?.description && (
                    <span className="text-muted-foreground block text-[11px] leading-relaxed text-pretty">
                      {selectedMetric.description}
                    </span>
                  )}
                  {selectedMetric?.d3Format && (
                    <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-[11px]">
                      d3: {selectedMetric.d3Format}
                    </span>
                  )}
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-medium tracking-tight">Filters</span>
                  <Input
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Filter sample rows (e.g. paid, 42)…"
                    aria-label="Filter sample rows"
                    className="placeholder:text-muted-foreground/70 h-8 text-xs focus-visible:ring-2"
                  />
                  <span className="text-muted-foreground text-[11px] leading-relaxed">
                    Simple text match over sampleRows — filtered instantly.
                  </span>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium tracking-tight">Sort</span>
                    <div className="border-input bg-muted text-muted-foreground rounded-md border px-2.5 py-2 text-xs">
                      Metric desc
                    </div>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium tracking-tight">Row limit</span>
                    <div className="relative">
                      <select
                        value={rowLimit}
                        onChange={(e) => setRowLimit(Number(e.target.value))}
                        aria-label="Row limit"
                        className="border-input bg-background hover:border-border focus-visible:ring-ring active:bg-muted/40 h-8 w-full rounded-md border px-2 pr-6 text-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                      >
                        {[5, 10, 25, 50].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2 stroke-[1.75]"
                        aria-hidden
                      />
                    </div>
                  </label>
                </div>

                <div className="space-y-2.5">
                  <span className="text-xs font-medium tracking-tight">Visualization</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ALL_VIZ.slice(0, 8).map((v) => {
                      const active = vizType === v;
                      const ok = (SUPPORTED as string[]).includes(v);
                      const Icon = VIZ_ICON[v] ?? BarChart3;
                      return (
                        <button
                          key={v}
                          onClick={() => setVizType(v)}
                          aria-pressed={active}
                          aria-label={ok ? v : `${v} — deferred`}
                          className={`focus-visible:ring-ring flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-[11px] font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none active:opacity-90 motion-reduce:transition-none ${active ? "border-primary bg-primary text-primary-foreground shadow-sm" : ok ? "border-input bg-card hover:bg-muted/60 hover:border-border active:bg-accent/60" : "border-input bg-muted/40 text-muted-foreground hover:bg-muted/60 active:bg-accent/40"}`}
                          title={ok ? v : `${v} — deferred (see ChartRenderer)`}
                          type="button"
                        >
                          <Icon className="h-4 w-4 stroke-[1.75]" aria-hidden />
                          <span className="leading-none tracking-tight">{v}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ALL_VIZ.slice(8).map((v) => {
                      const active = vizType === v;
                      const Icon = VIZ_ICON[v] ?? BarChart3;
                      return (
                        <button
                          key={v}
                          onClick={() => setVizType(v)}
                          aria-pressed={active}
                          aria-label={`${v} — deferred`}
                          className={`focus-visible:ring-ring flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-[11px] font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none active:opacity-90 motion-reduce:transition-none ${active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-input bg-muted/40 text-muted-foreground hover:bg-muted/60 active:bg-accent/40"}`}
                          title={`${v} — deferred (see ChartRenderer)`}
                          type="button"
                        >
                          <Icon className="h-4 w-4 stroke-[1.75]" aria-hidden />
                          <span className="leading-none tracking-tight">{v}</span>
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-muted-foreground block text-[11px] leading-relaxed text-pretty">
                    8 live via TanStack (Bar / Line / Area / Scatter / Heatmap / Box Plot + Table /
                    Big Number) · rest deferred with reason.
                  </span>
                </div>

                <div className="border-border bg-muted/30 rounded-lg border p-3">
                  {datasetsError ? (
                    <p className="text-destructive text-xs font-medium">
                      Failed to load datasets: {datasetsError}
                    </p>
                  ) : datasetsLoading ? (
                    <p className="text-muted-foreground text-xs">Loading dataset…</p>
                  ) : ds ? (
                    <>
                      <p className="text-xs font-medium tracking-tight text-balance">{ds.name}</p>
                      <p className="text-muted-foreground mt-1 font-mono text-[11px]">
                        {ds.source} · {ds.type}
                      </p>
                      <p className="text-muted-foreground mt-1 text-[11px] tabular-nums">
                        {ds.columns.length} cols · {ds.metrics.length} metrics ·{" "}
                        {ds.sampleRows?.length ?? 0} sample rows
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-xs">No dataset</p>
                  )}
                  <Link
                    to="/tablemodelview/list"
                    className="text-primary focus-visible:ring-ring mt-2 inline-flex items-center gap-1 rounded-sm text-xs font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none active:opacity-80"
                  >
                    Edit dataset →
                  </Link>
                </div>
              </div>
            </div>
          </aside>

          <section className="bg-background min-w-0 flex-1" aria-label="Chart preview">
            <div className="border-border flex items-center gap-2 border-b px-3 py-2.5 sm:px-4">
              <Eye
                className="text-muted-foreground h-3.5 w-3.5 shrink-0 stroke-[1.75]"
                aria-hidden
              />
              <span className="text-xs font-semibold tracking-tight">Preview</span>
              <span className="bg-border hidden h-3 w-px self-center sm:inline-block" aria-hidden />
              <span className="text-muted-foreground hidden truncate text-xs sm:inline">
                {datasetsLoading
                  ? "Loading dataset…"
                  : datasetsError
                    ? "— error —"
                    : ds
                      ? `${ds.name} · ${vizType} ${dimension ? `by ${dimension}` : "(total)"} · ${metricLabel}${filterText ? ` · filtered` : ""}`
                      : "No dataset"}{" "}
                · <span className="font-mono text-[11px]">ChartRenderer</span>
              </span>
              <Link
                to="/chart/list"
                className="text-primary focus-visible:ring-ring ml-auto hidden rounded-sm text-xs font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none active:opacity-80 sm:inline"
              >
                Chart List →
              </Link>
            </div>

            <div className="p-4">
              {datasetsLoading ? (
                <div className="border-border bg-card grid h-[360px] place-items-center rounded-lg border p-4 sm:h-[400px]">
                  <div className="flex flex-col items-center gap-3" aria-hidden>
                    <div className="bg-muted h-8 w-32 animate-pulse rounded-md" />
                    <div className="bg-muted h-3 w-48 animate-pulse rounded" />
                  </div>
                  <span className="sr-only">Loading dataset…</span>
                </div>
              ) : datasetsError ? (
                <div className="border-destructive/30 bg-destructive/10 grid h-[360px] place-items-center rounded-lg border p-4 text-center sm:h-[400px]">
                  <p className="text-destructive text-xs font-medium">
                    Failed to load dataset: {datasetsError}
                  </p>
                </div>
              ) : !ds ? (
                <div className="border-border bg-card grid h-[360px] place-items-center rounded-lg border p-4 text-center sm:h-[400px]">
                  <p className="text-muted-foreground text-xs">No dataset available.</p>
                </div>
              ) : (
                <div className="border-border bg-card min-h-[360px] overflow-hidden rounded-lg border shadow-sm">
                  <Suspense
                    fallback={
                      <div className="grid h-[360px] place-items-center sm:h-[400px]">
                        <p className="text-muted-foreground text-xs">Loading chart…</p>
                      </div>
                    }
                  >
                    <ChartRenderer
                      vizType={vizType}
                      data={chartRows}
                      metricLabel={metricLabel}
                      d3Format={selectedMetric?.d3Format}
                      dataset={ds}
                      dimension={dimension}
                      showGrid={showGrid}
                      showLegend={showLegend}
                      rawRows={filterText ? filteredRows : (ds.sampleRows ?? [])}
                      rowLimit={rowLimit}
                    />
                  </Suspense>
                  <div className="border-border bg-muted/20 flex flex-wrap items-center gap-2 border-t px-3 py-2.5 text-[11px]">
                    <span className="bg-muted rounded-full px-2 py-0.5 font-mono text-xs">
                      {ds.name}
                    </span>
                    <span
                      className="bg-border hidden h-3 w-px self-center sm:inline-block"
                      aria-hidden
                    />
                    <span className="text-muted-foreground leading-relaxed">
                      {vizType === "Table" || vizType === "Big Number"
                        ? `${ds.sampleRows?.length ?? 0} sample rows`
                        : `${chartRows.length} bucket${chartRows.length === 1 ? "" : "s"} · ${ds.sampleRows?.length ?? 0} sample rows`}{" "}
                      · from{" "}
                      <code className="bg-muted rounded px-1 font-mono text-[11px]">
                        {ds.source}
                      </code>{" "}
                      · TanStack{" "}
                      <code className="bg-muted rounded px-1 font-mono text-[11px]">
                        ChartRenderer
                      </code>
                    </span>
                  </div>
                </div>
              )}

              <p className="text-muted-foreground mt-3 text-[11px] leading-relaxed text-pretty">
                Preview runs in the browser against{" "}
                <code className="bg-muted rounded px-1 font-mono text-[11px]">sampleRows</code>{" "}
                (DatasetColumn / DatasetMetric from{" "}
                <code className="bg-muted rounded px-1 font-mono text-[11px]">
                  src/types/dataset.ts
                </code>
                ) and{" "}
                <code className="bg-muted rounded px-1 font-mono text-[11px]">
                  src/components/charts/ChartRenderer.tsx
                </code>
                . TanStack chunk is lazy-loaded via{" "}
                <code className="bg-muted rounded px-1 font-mono text-[11px]">React.lazy</code> /{" "}
                <code className="bg-muted rounded px-1 font-mono text-[11px]">Suspense</code> so it
                doesn&apos;t bloat the initial load.
                {bigNumber != null && vizType !== "Table" && vizType !== "Big Number" && (
                  <span className="font-mono text-[11px] tabular-nums">
                    {" "}
                    · total {metricLabel}: {formatNumber(bigNumber, selectedMetric?.d3Format)}
                  </span>
                )}
              </p>
            </div>
          </section>

          <aside className="border-border bg-card w-full shrink-0 border-t lg:w-[340px] lg:border-t-0 lg:border-l">
            <div
              className="bg-muted/20 flex gap-1 border-b p-1.5"
              role="tablist"
              aria-label="Explore panels"
            >
              {(
                [
                  ["Data", Database],
                  ["Customize", Settings2],
                  ["Query", Code2],
                  ["Results", Eye],
                ] as const
              ).map(([label, Icon]) => (
                <button
                  key={label}
                  onClick={() => setActiveTab(label)}
                  role="tab"
                  aria-selected={activeTab === label}
                  className={`focus-visible:ring-ring flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none active:opacity-90 motion-reduce:transition-none ${activeTab === label ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-accent/60"}`}
                  type="button"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 stroke-[1.75]" aria-hidden /> {label}
                </button>
              ))}
            </div>

            <div className="max-h-[58vh] overflow-auto p-4 lg:max-h-[calc(100vh-88px)]">
              {activeTab === "Data" && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold tracking-tight">Dataset</p>
                    <div className="border-border bg-muted/30 rounded-lg border p-3">
                      {datasetsLoading ? (
                        <p className="text-muted-foreground text-xs">Loading…</p>
                      ) : datasetsError ? (
                        <p className="text-destructive text-xs font-medium">{datasetsError}</p>
                      ) : ds ? (
                        <>
                          <p className="text-xs font-medium tracking-tight text-balance">
                            {ds.name}
                          </p>
                          <p className="text-muted-foreground font-mono text-[11px]">{ds.source}</p>
                          <p className="text-muted-foreground mt-1.5 text-[11px] leading-relaxed text-pretty">
                            {ds.description ?? "—"}
                          </p>
                        </>
                      ) : (
                        <p className="text-muted-foreground text-xs">No dataset</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium tracking-tight">Query mode</p>
                    <div className="border-input bg-muted text-muted-foreground rounded-md border px-2.5 py-2 text-xs">
                      Aggregate (group + metric)
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium tracking-tight">Time range</p>
                    <div className="border-input bg-muted text-muted-foreground rounded-md border px-2.5 py-2 text-xs">
                      Not wired yet — deferred
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium tracking-tight">Row limit</p>
                    <p className="text-muted-foreground text-[11px] leading-relaxed text-pretty">
                      Caps grouped buckets (Bar / Line / Area / Scatter / Heatmap / Box) and raw
                      rows (Table). Current:{" "}
                      <span className="text-foreground font-mono font-medium tabular-nums">
                        {rowLimit}
                      </span>
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium tracking-tight">URL parameters</p>
                    <p className="text-muted-foreground text-[11px] leading-relaxed text-pretty">
                      Deferred — would reflect Explore state in the URL like Superset does.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "Customize" && (
                <div className="space-y-5">
                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold tracking-tight">TanStack style</p>
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={showLegend}
                        onChange={(e) => setShowLegend(e.target.checked)}
                        className="accent-primary focus-visible:ring-ring h-3.5 w-3.5 rounded-sm focus-visible:ring-2 focus-visible:ring-offset-0"
                      />
                      Legend
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={showGrid}
                        onChange={(e) => setShowGrid(e.target.checked)}
                        className="accent-primary focus-visible:ring-ring h-3.5 w-3.5 rounded-sm focus-visible:ring-2 focus-visible:ring-offset-0"
                      />
                      Grid
                    </label>
                  </div>
                  <div className="border-border bg-muted/40 rounded-lg border p-3">
                    <p className="text-xs font-medium tracking-tight">
                      Colors & tooltips are tokens
                    </p>
                    <p className="text-muted-foreground mt-1.5 text-[11px] leading-relaxed text-pretty">
                      Fills use{" "}
                      <code className="bg-background rounded border px-1 font-mono text-[11px]">
                        var(--chart-1)
                      </code>
                      …
                      <code className="bg-background rounded border px-1 font-mono text-[11px]">
                        var(--chart-5)
                      </code>
                      , grid uses{" "}
                      <code className="bg-background rounded border px-1 font-mono text-[11px]">
                        var(--border)
                      </code>
                      , ticks use{" "}
                      <code className="bg-background rounded border px-1 font-mono text-[11px]">
                        var(--muted-foreground)
                      </code>{" "}
                      + Space Grotesk, tooltips via{" "}
                      <code className="bg-background rounded border px-1 font-mono text-[11px]">
                        tooltip
                      </code>{" "}
                      extension themed with{" "}
                      <code className="bg-background rounded border px-1 font-mono text-[11px]">
                        var(--card)
                      </code>
                      /
                      <code className="bg-background rounded border px-1 font-mono text-[11px]">
                        var(--border)
                      </code>
                      . See{" "}
                      <code className="bg-background rounded border px-1 font-mono text-[11px]">
                        ChartRenderer.tsx
                      </code>{" "}
                      — no stock TanStack defaults.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium tracking-tight">Color scheme</p>
                    <div className="flex gap-1.5" aria-hidden>
                      <span
                        className="h-6 w-6 rounded-full border border-black/5 shadow-sm"
                        style={{ background: "var(--chart-1)" }}
                        title="chart-1"
                      />
                      <span
                        className="h-6 w-6 rounded-full border border-black/5 shadow-sm"
                        style={{ background: "var(--chart-2)" }}
                        title="chart-2"
                      />
                      <span
                        className="h-6 w-6 rounded-full border border-black/5 shadow-sm"
                        style={{ background: "var(--chart-3)" }}
                        title="chart-3"
                      />
                      <span
                        className="h-6 w-6 rounded-full border border-black/5 shadow-sm"
                        style={{ background: "var(--chart-4)" }}
                        title="chart-4"
                      />
                      <span
                        className="h-6 w-6 rounded-full border border-black/5 shadow-sm"
                        style={{ background: "var(--chart-5)" }}
                        title="chart-5"
                      />
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Picker beyond this default palette is deferred.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "Query" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold tracking-tight">Rendered SQL</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(sql);
                        showToast("SQL copied");
                      }}
                      className="border-input bg-background hover:bg-muted focus-visible:ring-ring active:bg-accent/60 rounded border px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                      type="button"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="border-editor-border bg-editor text-editor-foreground overflow-auto rounded-lg border p-3 font-mono text-[11px] leading-relaxed">
                    {sql}
                  </pre>
                  <p className="text-muted-foreground text-[11px] leading-relaxed text-pretty">
                    Derived from the dimension / metric / limit controls — inspectable, not a black
                    box.
                  </p>
                  <div className="border-border bg-muted/30 rounded-lg border p-3">
                    <p className="text-xs font-medium tracking-tight">Query JSON (shape)</p>
                    <pre className="text-muted-foreground mt-1.5 overflow-auto font-mono text-[11px] leading-relaxed">
                      {JSON.stringify(
                        {
                          dataset: ds?.name ?? "—",
                          source: ds?.source ?? "—",
                          vizType,
                          dimension,
                          metric: metricName,
                          rowLimit,
                          filterText: filterText || undefined,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="active:bg-accent/80 h-7 text-xs focus-visible:ring-2 motion-reduce:transition-none"
                      onClick={() =>
                        showToast("Preview is live and already reflects your controls.")
                      }
                    >
                      <Play className="mr-1 h-3 w-3 stroke-[1.75]" aria-hidden /> Run
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="active:bg-accent/60 h-7 text-xs motion-reduce:transition-none"
                      onClick={() => showToast("No async query to stop.")}
                    >
                      <X className="mr-1 h-3 w-3 stroke-[1.75]" aria-hidden /> Stop
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === "Results" && (
                <div className="space-y-4">
                  <p className="text-xs font-semibold tracking-tight">Tabular results</p>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Rows backing the preview — paginated to{" "}
                    <span className="font-mono font-medium tabular-nums">{rowLimit}</span>.
                  </p>
                  <div className="border-border overflow-hidden rounded-lg border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/40 text-muted-foreground border-b text-left">
                          <th className="px-2.5 py-2 font-mono text-[11px] font-medium tracking-wide">
                            {dimension ?? "label"}
                          </th>
                          <th className="px-2.5 py-2 text-right font-mono text-[11px] font-medium tracking-wide">
                            {metricLabel}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-border divide-y">
                        {chartRows.slice(0, rowLimit).map((r) => (
                          <tr
                            key={r.label}
                            className="hover:bg-muted/40 transition-colors duration-150 motion-reduce:transition-none"
                          >
                            <td className="px-2.5 py-2 tracking-tight">{r.label}</td>
                            <td className="px-2.5 py-2 text-right font-mono text-[11px] tabular-nums">
                              {formatNumber(r.value, selectedMetric?.d3Format)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {chartRows.length === 0 && (
                      <p className="text-muted-foreground px-3 py-8 text-center text-xs">
                        No rows — pick a dimension / metric.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const csv = [
                          "label,value",
                          ...chartRows.map((r) => `${JSON.stringify(r.label)},${r.value}`),
                        ].join("\n");
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${ds?.name ?? "chart"}-${vizType}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="border-input bg-background hover:bg-muted focus-visible:ring-ring active:bg-accent/60 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                      type="button"
                    >
                      Export CSV
                    </button>
                    <span className="text-muted-foreground text-[11px] tabular-nums">
                      {chartRows.length} buckets
                    </span>
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Column stats: {chartRows.length} groups · single metric — richer stats deferred.
                  </p>
                </div>
              )}
            </div>
          </aside>

          {/* Conversational copilot — right slide-over on lg, bottom sheet on mobile */}
          {aiOpen && (
            <>
              <button
                type="button"
                aria-label="Close assistant"
                onClick={() => setAiOpen(false)}
                className="absolute inset-0 z-30 bg-black/20 backdrop-blur-[1px]"
              />
              <div className="bg-card absolute inset-x-0 bottom-0 z-30 flex max-h-[72vh] flex-col rounded-t-xl border-t shadow-2xl lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:w-[380px] lg:rounded-none lg:border-t-0 lg:border-l">
                <div className="flex items-center gap-2.5 border-b px-3 py-3">
                  <span
                    className="bg-ai text-ai-foreground grid h-7 w-7 place-items-center rounded-md"
                    aria-hidden
                  >
                    <Sparkles className="h-4 w-4 stroke-[1.75]" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold tracking-tight text-balance">
                      Ask about this chart
                    </p>
                    <p className="text-muted-foreground text-[11px] leading-none">
                      Copilot — suggests, never auto-applies
                    </p>
                  </div>
                  <span className="bg-ai-muted border-ai-border hidden rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wide sm:inline">
                    MOCK · real schema
                  </span>
                  <button
                    type="button"
                    onClick={() => setAiOpen(false)}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring active:bg-accent/60 grid h-7 w-7 place-items-center rounded-md transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                    aria-label="Close assistant"
                  >
                    <X className="h-4 w-4 stroke-[1.75]" aria-hidden />
                  </button>
                </div>

                <div ref={aiScrollRef} className="flex-1 overflow-auto p-4">
                  <div className="space-y-3">
                    {aiExchanges.length === 0 && !aiBusy && (
                      <div className="border-ai-border bg-ai-muted/40 rounded-lg border border-dashed p-3">
                        <p className="text-xs font-medium tracking-tight">Try asking</p>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {[
                            "make it a line chart",
                            "filter to published orders only",
                            "break down by region",
                            "show me revenue by status",
                          ].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => sendAi(s)}
                              className="border-ai-border bg-card hover:bg-ai-muted focus-visible:ring-ring active:bg-accent/60 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                        <p className="text-muted-foreground mt-2.5 text-[11px] leading-relaxed text-pretty">
                          The assistant reads{" "}
                          <code className="bg-card rounded border px-1 font-mono text-[11px]">
                            Dataset
                          </code>{" "}
                          ·{" "}
                          <code className="bg-card rounded border px-1 font-mono text-[11px]">
                            {ds?.source ?? "—"}
                          </code>{" "}
                          and replies with a reviewable action + the exact SQL. Hit{" "}
                          <span className="text-foreground font-medium">Apply</span> to mutate the
                          chart — nothing changes until you do.
                        </p>
                      </div>
                    )}

                    {aiExchanges.slice(-4).map((ex) => {
                      const r = ex.response;
                      const actionLabel = r.action
                        ? r.action.type === "modify_chart"
                          ? `Propose: switch to ${r.action.payload.vizType ?? r.action.payload.dimensions?.[0] ?? "modified"}`
                          : r.action.type === "filter"
                            ? `Propose: filter ${r.action.payload.filters?.[0]?.column} = ${r.action.payload.filters?.[0]?.value}`
                            : r.action.type === "generate_chart"
                              ? `Propose: ${r.action.payload.chartConfig?.vizType} of ${r.action.payload.chartConfig?.metric} by ${r.action.payload.chartConfig?.dimension}`
                              : r.action.type
                        : "No action — explanation";
                      const tables = r.tablesUsed?.join(", ") ?? "—";
                      return (
                        <div
                          key={ex.id}
                          className="border-border bg-card overflow-hidden rounded-lg border shadow-sm"
                        >
                          <div className="bg-muted/30 border-b px-3 py-2">
                            <p className="text-xs font-medium tracking-tight text-balance">
                              You → {ex.prompt}
                            </p>
                          </div>
                          <div className="space-y-2.5 p-3">
                            <p
                              className="text-xs leading-relaxed text-pretty"
                              dangerouslySetInnerHTML={{
                                __html: r.reply
                                  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                                  .replace(
                                    /`([^`]+)`/g,
                                    '<code class="bg-muted rounded px-1 font-mono text-[11px]">$1</code>',
                                  ),
                              }}
                            />
                            <div className="bg-ai-muted border-ai-border flex flex-wrap items-center gap-1.5 rounded-md border px-2.5 py-1.5">
                              <span className="text-ai text-[11px] font-semibold">
                                {actionLabel}
                              </span>
                              <span
                                className="bg-ai-border hidden h-3 w-px self-center sm:inline-block"
                                aria-hidden
                              />
                              <span className="text-muted-foreground font-mono text-[10px] tabular-nums">
                                tables: {tables}
                              </span>
                            </div>
                            {r.sql && (
                              <details className="group">
                                <summary className="text-muted-foreground hover:text-foreground cursor-pointer list-none text-[11px] font-medium transition-colors duration-150 motion-reduce:transition-none">
                                  <span className="group-open:hidden">
                                    ▸ View SQL (inspectable)
                                  </span>
                                  <span className="hidden group-open:inline">▾ Hide SQL</span>
                                </summary>
                                <pre className="border-ai-border bg-editor text-editor-foreground mt-2 overflow-auto rounded-md border p-3 font-mono text-[11px] leading-relaxed">
                                  {r.sql}
                                </pre>
                              </details>
                            )}
                            <div className="flex gap-1.5 pt-1">
                              <Button
                                size="sm"
                                className="bg-ai text-ai-foreground hover:bg-ai/90 h-7 text-xs focus-visible:ring-2 active:opacity-90 motion-reduce:transition-none"
                                onClick={() => applyExchange(ex)}
                                disabled={!r.action}
                              >
                                Apply
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="active:bg-accent/60 h-7 text-xs motion-reduce:transition-none"
                                onClick={() =>
                                  setAiExchanges((prev) => prev.filter((p) => p.id !== ex.id))
                                }
                              >
                                Dismiss
                              </Button>
                              <span className="text-muted-foreground ml-auto hidden self-center text-[10px] sm:inline">
                                Not auto-applied — explicit confirm required
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {aiBusy && (
                      <div className="border-ai-border bg-ai-muted/30 flex items-center gap-2 rounded-lg border p-3 text-xs">
                        <Loader2
                          className="text-ai h-4 w-4 animate-spin stroke-[1.75]"
                          aria-hidden
                        />
                        Thinking — reading {ds?.name ?? "dataset"} schema…
                      </div>
                    )}
                    {aiError && (
                      <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-3 text-xs font-medium">
                        {aiError}
                      </div>
                    )}
                    {aiExchanges.length > 4 && (
                      <p className="text-muted-foreground text-center text-[11px]">
                        Showing the 4 most recent exchanges.
                      </p>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-4 text-center text-[11px] leading-relaxed text-pretty">
                    This panel and the “Ask AI” NL2SQL bar in SQL Lab are separate surfaces — both
                    use the same server-side mock (
                    <code className="bg-muted rounded px-1 font-mono text-[11px]">
                      x-mock-ai: 1
                    </code>
                    ) but different prompts and context.
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
                          sendAi();
                        }
                      }}
                      placeholder="Ask about this chart…"
                      aria-label="Ask about this chart"
                      className="placeholder:text-muted-foreground/70 h-9 flex-1 text-xs focus-visible:ring-2"
                      disabled={aiBusy}
                    />
                    <Button
                      size="sm"
                      className="bg-ai text-ai-foreground hover:bg-ai/90 h-9 px-3 focus-visible:ring-2 active:opacity-90 motion-reduce:transition-none"
                      onClick={() => sendAi()}
                      disabled={aiBusy || !aiInput.trim()}
                    >
                      <Send className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden />
                    </Button>
                  </div>
                  <p className="text-muted-foreground mt-1.5 text-[11px]">
                    Enter to send · suggestions never rewrite the chart until you press Apply
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {showSave && (
          <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4 backdrop-blur-sm">
            <div className="border-border bg-card w-full max-w-[520px] rounded-xl border p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold tracking-tight text-balance">Save chart</p>
                <button
                  onClick={() => setShowSave(false)}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring active:bg-accent/60 grid h-7 w-7 place-items-center rounded-md transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                  type="button"
                  aria-label="Close"
                >
                  <X className="h-4 w-4 stroke-[1.75]" aria-hidden />
                </button>
              </div>
              <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed text-pretty">
                This writes to{" "}
                <code className="bg-muted rounded px-1 font-mono text-[11px]">
                  POST /api/charts
                </code>{" "}
                (Postgres via Drizzle) — so it appears in Chart List immediately. Same{" "}
                <code className="bg-muted rounded px-1 font-mono text-[11px]">Chart</code> contract
                Chart List already reads.
              </p>
              <div className="mt-4 space-y-3">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium tracking-tight">Chart name *</span>
                  <Input
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder={`${metricLabel} by ${dimension ?? "total"} — ${vizType}`}
                    aria-label="Chart name"
                    className="placeholder:text-muted-foreground/70 h-9 text-sm focus-visible:ring-2"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium tracking-tight">Description</span>
                  <textarea
                    value={saveDesc}
                    onChange={(e) => setSaveDesc(e.target.value)}
                    placeholder="What this chart shows…"
                    rows={2}
                    className="border-input bg-background placeholder:text-muted-foreground/70 focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-xs leading-relaxed focus-visible:ring-2 focus-visible:outline-none"
                  />
                </label>
                <div className="bg-muted/40 rounded-lg border px-3 py-2.5 font-mono text-[11px] leading-relaxed">
                  dataset{" "}
                  <span className="text-foreground font-semibold tabular-nums">
                    {ds?.name ?? "—"}
                  </span>{" "}
                  · {ds?.source ?? "—"} · {vizType} · {dimension ?? "(no dim)"} / {metricLabel}
                </div>
                <div className="bg-muted/40 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs">
                  <span className="text-muted-foreground">Preview buckets</span>
                  <span className="bg-border h-3 w-px self-center" aria-hidden />
                  <span className="font-mono text-[11px] tabular-nums">
                    {chartRows
                      .map((r) => `${r.label}: ${formatNumber(r.value, selectedMetric?.d3Format)}`)
                      .slice(0, 3)
                      .join(" · ") || "—"}
                  </span>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSave(false)}
                  className="active:bg-accent/60 h-8 text-xs motion-reduce:transition-none"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={onSave}
                  disabled={saving || !saveName.trim()}
                  className="h-8 text-xs focus-visible:ring-2 active:opacity-90 motion-reduce:transition-none"
                >
                  {saving ? "Saving…" : "Save to Chart List"}
                </Button>
              </div>
              <p className="text-muted-foreground mt-3 text-[11px]">
                After save:{" "}
                <button
                  onClick={() => navigate("/chart/list")}
                  className="text-primary focus-visible:ring-ring rounded-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none active:opacity-80"
                  type="button"
                >
                  View in Chart List →
                </button>
              </p>
            </div>
          </div>
        )}

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="border-border bg-card animate-in fade-in slide-in-from-bottom-1 fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-3 py-2 text-sm font-medium shadow-lg duration-200 motion-reduce:animate-none"
          >
            {toast}
          </div>
        )}
      </div>
    </AppShell>
  );
}
