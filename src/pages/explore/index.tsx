import { Suspense, lazy, useMemo, useState } from "react";
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
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { seedDatasets } from "@/data/datasets";
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
  for (const col of ds.columns) {
    if (!/NUMERIC|INTEGER|FLOAT|DOUBLE|DECIMAL/i.test(col.type)) continue;
    if (rows.some((r) => typeof r[col.name] === "number")) return col.name;
  }
  for (const col of ds.columns) {
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
  const metric = ds.metrics.find((m) => m.name === metricName);
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
  const metric = ds.metrics.find((m) => m.name === metricName);
  const expr = metric?.sqlExpression ?? (metricName ? metricName : "*");
  const dim = dimension ? `${dimension}, ` : "";
  const grp = dimension ? `GROUP BY ${dimension}\n` : "";
  const order = metricName ? `ORDER BY ${metricName} DESC\n` : "";
  return `SELECT\n  ${dim}${expr} AS ${metricName ?? "value"}\nFROM ${ds.source}\n${grp}${order}LIMIT ${rowLimit};`;
}

export default function ExplorePage() {
  const navigate = useNavigate();
  const [datasetId, setDatasetId] = useState<number>(seedDatasets[0]?.id ?? 1);
  const ds = useMemo(
    () => seedDatasets.find((d) => d.id === datasetId) ?? seedDatasets[0]!,
    [datasetId],
  );

  const groupableCols = useMemo(() => ds.columns.filter((c) => c.groupable), [ds]);
  const [vizType, setVizType] = useState<ExploreViz>("Bar");
  const [dimension, setDimension] = useState<string | null>(() => groupableCols[0]?.name ?? null);
  const [metricName, setMetricName] = useState<string | null>(() => ds.metrics[0]?.name ?? null);
  const [rowLimit, setRowLimit] = useState(10);
  const [filterText, setFilterText] = useState("");
  const [activeTab, setActiveTab] = useState<"Data" | "Customize" | "Query" | "Results">("Data");
  const [showLegend, setShowLegend] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2600);
  };

  const onDatasetChange = (id: number) => {
    setDatasetId(id);
    const next = seedDatasets.find((d) => d.id === id)!;
    setDimension(next.columns.find((c) => c.groupable)?.name ?? null);
    setMetricName(next.metrics[0]?.name ?? null);
  };

  const {
    rows: chartRows,
    bigNumber,
    metricLabel,
  } = useMemo(
    () => aggregateForChart(ds, dimension, metricName, rowLimit),
    [ds, dimension, metricName, rowLimit],
  );

  const filteredRows = useMemo(() => {
    if (!filterText.trim()) return ds.sampleRows ?? [];
    const q = filterText.toLowerCase();
    return (ds.sampleRows ?? []).filter((r) => JSON.stringify(r).toLowerCase().includes(q));
  }, [ds, filterText]);

  const sql = useMemo(
    () => buildSql(ds, dimension, metricName, rowLimit),
    [ds, dimension, metricName, rowLimit],
  );
  const selectedMetric = ds.metrics.find((m) => m.name === metricName) ?? null;

  const onSave = async () => {
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
      if (!res.ok) throw new Error(data.message || data.error || "Save failed");
      showToast(`Saved — "${data.chart?.name ?? saveName}" now in Chart List`);
      setShowSave(false);
      setSaveName("");
      setSaveDesc("");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="flex min-h-[calc(100vh-44px)] flex-col">
        <div className="border-border bg-card sticky top-[44px] z-20 border-b">
          <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:px-4">
            <div className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground grid h-7 w-7 place-items-center rounded-md">
                <BarChart3 className="h-4 w-4" />
              </span>
              <h1 className="text-sm font-semibold tracking-tight">Explore</h1>
              <span className="bg-info text-info-foreground hidden rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide sm:inline">
                TANSTACK
              </span>
            </div>
            <span className="bg-border hidden h-4 w-px sm:inline-block" />
            <label className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground hidden font-medium sm:inline">Dataset</span>
              <div className="relative">
                <select
                  value={datasetId}
                  onChange={(e) => onDatasetChange(Number(e.target.value))}
                  className="border-input bg-background h-8 rounded-md border pr-7 pl-2 text-xs font-medium"
                >
                  {seedDatasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} · {d.source}
                    </option>
                  ))}
                </select>
                <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2" />
              </div>
            </label>
            <span className="bg-border hidden h-4 w-px sm:inline-block" />
            <label className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground hidden font-medium sm:inline">Chart</span>
              <div className="relative">
                <select
                  value={vizType}
                  onChange={(e) => setVizType(e.target.value as ExploreViz)}
                  className="border-input bg-background h-8 rounded-md border pr-7 pl-2 text-xs font-medium"
                >
                  {ALL_VIZ.map((v) => (
                    <option key={v} value={v}>
                      {v}
                      {(SUPPORTED as string[]).includes(v) ? "" : " — deferred"}
                    </option>
                  ))}
                </select>
                <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2" />
              </div>
            </label>

            <div className="ml-auto flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() =>
                  showToast("Run — preview is live; no extra query needed in this pass.")
                }
              >
                <Play className="mr-1 h-3.5 w-3.5" />
                Run
              </Button>
              <Button size="sm" className="h-8 text-xs" onClick={() => setShowSave(true)}>
                <Save className="mr-1 h-3.5 w-3.5" />
                Save chart
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground hidden border-t px-4 py-1.5 text-[11px] leading-relaxed sm:block">
            Preview is a{" "}
            <span className="font-medium">
              client-side aggregation of {ds.name}&apos;s sampleRows
            </span>{" "}
            ({ds.sampleRows?.length ?? 0} rows) — not a mock image. TanStack Charts renders the same{" "}
            <code className="bg-muted rounded px-1">ChartRenderer</code> that Dashboard View will
            reuse.
          </p>
        </div>

        <div className="flex flex-1 flex-col lg:flex-row">
          <aside className="border-border bg-card w-full shrink-0 border-b lg:w-[280px] lg:border-r lg:border-b-0">
            <div className="space-y-4 p-3 sm:p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-widest uppercase">
                <Database className="h-3.5 w-3.5" />
                Data controls
                <span className="text-muted-foreground font-normal normal-case">
                  — DatasetColumn/Metric
                </span>
              </div>

              <div className="space-y-3">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Dimension</span>
                  <div className="relative">
                    <select
                      value={dimension ?? ""}
                      onChange={(e) => setDimension(e.target.value || null)}
                      className="border-input bg-background h-8 w-full rounded-md border px-2 pr-7 text-xs"
                    >
                      <option value="">(no grouping — total)</option>
                      {groupableCols.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} · {c.type}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2" />
                  </div>
                  <span className="text-muted-foreground text-[11px]">
                    {groupableCols.length} groupable · from{" "}
                    <code className="bg-muted rounded px-1">{ds.name}</code>
                  </span>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Metric</span>
                  <div className="relative">
                    <select
                      value={metricName ?? ""}
                      onChange={(e) => setMetricName(e.target.value || null)}
                      className="border-input bg-background h-8 w-full rounded-md border px-2 pr-7 text-xs"
                    >
                      {(ds.metrics ?? []).map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.name} — {m.sqlExpression}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2" />
                  </div>
                  {selectedMetric?.description && (
                    <span className="text-muted-foreground text-[11px]">
                      {selectedMetric.description}
                    </span>
                  )}
                  {selectedMetric?.d3Format && (
                    <span className="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">
                      d3: {selectedMetric.d3Format}
                    </span>
                  )}
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Filters</span>
                  <Input
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Filter sample rows (e.g. paid, 42)…"
                    className="h-8 text-xs"
                  />
                  <span className="text-muted-foreground text-[11px]">
                    Simple text match over sampleRows for this pass.
                  </span>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium">Sort</span>
                    <div className="border-input bg-muted text-muted-foreground rounded-md border px-2 py-1.5 text-xs">
                      Metric desc
                    </div>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium">Row limit</span>
                    <div className="relative">
                      <select
                        value={rowLimit}
                        onChange={(e) => setRowLimit(Number(e.target.value))}
                        className="border-input bg-background h-8 w-full rounded-md border px-2 pr-6 text-xs"
                      >
                        {[5, 10, 25, 50].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2" />
                    </div>
                  </label>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-medium">Viz type</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ALL_VIZ.slice(0, 8).map((v) => {
                      const active = vizType === v;
                      const ok = (SUPPORTED as string[]).includes(v);
                      const Icon = VIZ_ICON[v] ?? BarChart3;
                      return (
                        <button
                          key={v}
                          onClick={() => setVizType(v)}
                          className={`flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-[11px] font-medium transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : ok ? "border-input bg-background hover:bg-muted" : "border-input bg-muted/40 text-muted-foreground"}`}
                          title={ok ? v : `${v} — deferred (see ChartRenderer)`}
                          type="button"
                        >
                          <Icon className="h-4 w-4" />
                          <span className="leading-none">{v}</span>
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
                          className={`flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-[11px] font-medium ${active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-muted/40 text-muted-foreground"}`}
                          title={`${v} — deferred (see ChartRenderer)`}
                          type="button"
                        >
                          <Icon className="h-4 w-4" />
                          <span className="leading-none">{v}</span>
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-muted-foreground text-[11px]">
                    8 live via TanStack (Bar/Line/Area/Scatter/Heatmap/Box Plot + Table/Big Number
                    widgets) · rest deferred with reason in ChartRenderer.
                  </span>
                </div>

                <div className="border-border bg-muted/30 rounded-md border p-2.5">
                  <p className="text-xs font-medium">{ds.name}</p>
                  <p className="text-muted-foreground mt-1 font-mono text-[11px]">
                    {ds.source} · {ds.type}
                  </p>
                  <p className="text-muted-foreground mt-1 text-[11px]">
                    {ds.columns.length} cols · {ds.metrics.length} metrics ·{" "}
                    {ds.sampleRows?.length ?? 0} sample rows
                  </p>
                  <Link
                    to="/tablemodelview/list"
                    className="text-primary mt-1 inline-block text-xs hover:underline"
                  >
                    Edit dataset →
                  </Link>
                </div>
              </div>
            </div>
          </aside>

          <section className="min-w-0 flex-1 bg-[color-mix(in_oklch,var(--background),var(--muted)_6%)]">
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Eye className="text-muted-foreground h-3.5 w-3.5" />
              <span className="text-xs font-semibold tracking-wide">Preview</span>
              <span className="bg-border hidden h-3 w-px sm:inline-block" />
              <span className="text-muted-foreground hidden text-xs sm:inline">
                {ds.name} · {vizType} {dimension ? `by ${dimension}` : "(total)"} · {metricLabel}
                {filterText ? ` · filtered` : ""} ·{" "}
                <span className="font-mono text-[11px]">ChartRenderer</span>
              </span>
              <Link
                to="/chart/list"
                className="text-primary ml-auto hidden text-xs hover:underline sm:inline"
              >
                Chart List →
              </Link>
            </div>

            <div className="p-3 sm:p-4">
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
                <div className="border-border bg-muted/20 flex flex-wrap items-center gap-2 border-t px-3 py-2 text-[11px]">
                  <span className="bg-muted rounded-full px-2 py-0.5 font-mono text-xs">
                    {ds.name}
                  </span>
                  <span className="bg-border hidden h-3 w-px sm:inline-block" />
                  <span className="text-muted-foreground">
                    {vizType === "Table" || vizType === "Big Number"
                      ? `${ds.sampleRows?.length ?? 0} sample rows`
                      : `${chartRows.length} bucket${chartRows.length === 1 ? "" : "s"} · ${ds.sampleRows?.length ?? 0} sample rows`}{" "}
                    · from <code className="bg-muted rounded px-1">{ds.source}</code> · TanStack{" "}
                    <code className="bg-muted rounded px-1">ChartRenderer</code>
                  </span>
                </div>
              </div>

              <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
                Preview runs in the browser against{" "}
                <code className="bg-muted rounded px-1">sampleRows</code>{" "}
                (DatasetColumn/DatasetMetric from{" "}
                <code className="bg-muted rounded px-1">src/types/dataset.ts</code>) and{" "}
                <code className="bg-muted rounded px-1">
                  src/components/charts/ChartRenderer.tsx
                </code>
                . TanStack chunk is lazy-loaded via{" "}
                <code className="bg-muted rounded px-1">React.lazy</code>/
                <code className="bg-muted rounded px-1">Suspense</code> so it doesn&apos;t bloat the
                initial page load.
                {bigNumber != null && vizType !== "Table" && vizType !== "Big Number" && (
                  <span className="font-mono text-[11px]">
                    {" "}
                    · total {metricLabel}: {formatNumber(bigNumber, selectedMetric?.d3Format)}
                  </span>
                )}
              </p>
            </div>
          </section>

          <aside className="border-border bg-card w-full shrink-0 border-t lg:w-[340px] lg:border-t-0 lg:border-l">
            <div className="flex gap-1 border-b p-1">
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
                  className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium ${activeTab === label ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                  type="button"
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>

            <div className="max-h-[58vh] overflow-auto p-3 sm:p-4 lg:max-h-[calc(100vh-88px)]">
              {activeTab === "Data" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold tracking-wide">Dataset</p>
                    <div className="border-border bg-muted/30 rounded-md border p-2.5">
                      <p className="text-xs font-medium">{ds.name}</p>
                      <p className="text-muted-foreground font-mono text-[11px]">{ds.source}</p>
                      <p className="text-muted-foreground mt-1 text-[11px]">
                        {ds.description ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">Query mode</p>
                    <div className="border-input bg-muted text-muted-foreground rounded-md border px-2 py-1.5 text-xs">
                      Aggregate (group + metric)
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">Time range</p>
                    <div className="border-input bg-muted text-muted-foreground rounded-md border px-2 py-1.5 text-xs">
                      Not wired yet — deferred
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">Row limit</p>
                    <p className="text-muted-foreground text-[11px]">
                      Caps grouped buckets (Bar/Line/Area/Scatter/Heatmap/Box) and raw rows (Table).
                      Current: {rowLimit}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">URL parameters</p>
                    <p className="text-muted-foreground text-[11px]">
                      Deferred — would reflect Explore state in the URL like Superset does.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "Customize" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold tracking-wide">TanStack style</p>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={showLegend}
                        onChange={(e) => setShowLegend(e.target.checked)}
                        className="accent-primary h-3.5 w-3.5"
                      />
                      Legend
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={showGrid}
                        onChange={(e) => setShowGrid(e.target.checked)}
                        className="accent-primary h-3.5 w-3.5"
                      />
                      Grid
                    </label>
                  </div>
                  <div className="border-border bg-muted/40 rounded-md border p-2.5">
                    <p className="text-xs font-medium">Colors & tooltips are tokens</p>
                    <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                      Fills use{" "}
                      <code className="bg-background rounded border px-1">var(--chart-1)</code>…
                      <code className="bg-background rounded border px-1">var(--chart-5)</code>,
                      grid uses{" "}
                      <code className="bg-background rounded border px-1">var(--border)</code>,
                      ticks use{" "}
                      <code className="bg-background rounded border px-1">
                        var(--muted-foreground)
                      </code>{" "}
                      + Space Grotesk, tooltips via{" "}
                      <code className="bg-background rounded border px-1">tooltip</code> extension
                      themed with{" "}
                      <code className="bg-background rounded border px-1">var(--card)</code>/
                      <code className="bg-background rounded border px-1">var(--border)</code>. See{" "}
                      <code className="bg-background rounded border px-1">ChartRenderer.tsx</code> —
                      no stock TanStack defaults leak.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">Color scheme</p>
                    <div className="flex gap-1.5">
                      <span
                        className="h-6 w-6 rounded-full"
                        style={{ background: "var(--chart-1)" }}
                        title="chart-1"
                      />
                      <span
                        className="h-6 w-6 rounded-full"
                        style={{ background: "var(--chart-2)" }}
                        title="chart-2"
                      />
                      <span
                        className="h-6 w-6 rounded-full"
                        style={{ background: "var(--chart-3)" }}
                        title="chart-3"
                      />
                      <span
                        className="h-6 w-6 rounded-full"
                        style={{ background: "var(--chart-4)" }}
                        title="chart-4"
                      />
                      <span
                        className="h-6 w-6 rounded-full"
                        style={{ background: "var(--chart-5)" }}
                        title="chart-5"
                      />
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      Picker beyond this default palette is deferred (Known Gaps).
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "Query" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold tracking-wide">Rendered SQL</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(sql);
                        showToast("SQL copied");
                      }}
                      className="border-input bg-background hover:bg-muted rounded border px-2 py-1 text-[11px] font-medium"
                      type="button"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="border-editor-border bg-editor text-editor-foreground overflow-auto rounded-md border p-3 font-mono text-[11px] leading-relaxed">
                    {sql}
                  </pre>
                  <p className="text-muted-foreground text-[11px]">
                    Derived from the dimension/metric/limit controls — inspectable, not a black box.
                  </p>
                  <div className="border-border bg-muted/30 rounded-md border p-2.5">
                    <p className="text-xs font-medium">Query JSON (shape)</p>
                    <pre className="text-muted-foreground mt-1 overflow-auto font-mono text-[11px]">
                      {JSON.stringify(
                        {
                          dataset: ds.name,
                          source: ds.source,
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
                      className="h-7 text-xs"
                      onClick={() =>
                        showToast("Run is live — preview already reflects your controls.")
                      }
                    >
                      <Play className="mr-1 h-3 w-3" /> Run
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => showToast("Stop — no async query in this pass.")}
                    >
                      <X className="mr-1 h-3 w-3" /> Stop
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === "Results" && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold tracking-wide">Tabular results</p>
                  <p className="text-muted-foreground text-[11px]">
                    Rows backing the preview — paginated to {rowLimit}.
                  </p>
                  <div className="border-border overflow-auto rounded-md border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/40 text-muted-foreground border-b text-left">
                          <th className="px-2 py-1.5 font-mono text-[11px]">
                            {dimension ?? "label"}
                          </th>
                          <th className="px-2 py-1.5 text-right font-mono text-[11px]">
                            {metricLabel}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-border divide-y">
                        {chartRows.slice(0, rowLimit).map((r) => (
                          <tr key={r.label} className="hover:bg-muted/40">
                            <td className="px-2 py-1.5">{r.label}</td>
                            <td className="px-2 py-1.5 text-right font-mono text-[11px]">
                              {formatNumber(r.value, selectedMetric?.d3Format)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {chartRows.length === 0 && (
                      <p className="text-muted-foreground px-3 py-6 text-center text-xs">
                        No rows — pick a dimension/metric.
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
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
                        a.download = `${ds.name}-${vizType}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="border-input bg-background hover:bg-muted rounded-md border px-2 py-1.5 text-xs font-medium"
                      type="button"
                    >
                      Export CSV
                    </button>
                    <span className="text-muted-foreground self-center text-[11px]">
                      {chartRows.length} buckets
                    </span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Column stats: {chartRows.length} groups · single metric — richer stats deferred.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>

        {showSave && (
          <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4 backdrop-blur-sm">
            <div className="border-border bg-card w-full max-w-[520px] rounded-lg border p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Save chart</p>
                <button
                  onClick={() => setShowSave(false)}
                  className="text-muted-foreground hover:text-foreground grid h-7 w-7 place-items-center rounded-md"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                This writes into <code className="bg-muted rounded px-1">seedCharts</code> (
                <code className="bg-muted rounded px-1">src/data/charts.ts</code>) via{" "}
                <code className="bg-muted rounded px-1">POST /api/charts</code> — so it appears in
                Chart List immediately. Same <code className="bg-muted rounded px-1">Chart</code>{" "}
                contract Chart List already reads.
              </p>
              <div className="mt-4 space-y-3">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Chart name *</span>
                  <Input
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder={`${metricLabel} by ${dimension ?? "total"} — ${vizType}`}
                    className="h-9 text-sm"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Description</span>
                  <textarea
                    value={saveDesc}
                    onChange={(e) => setSaveDesc(e.target.value)}
                    placeholder="What this chart shows…"
                    rows={2}
                    className="border-input bg-background w-full rounded-md border px-3 py-2 text-xs"
                  />
                </label>
                <div className="bg-muted/40 rounded-md px-3 py-2 font-mono text-[11px] leading-relaxed">
                  dataset <span className="font-semibold">{ds.name}</span> · {ds.source} · {vizType}{" "}
                  · {dimension ?? "(no dim)"} / {metricLabel}
                </div>
                <div className="bg-muted/40 flex items-center gap-2 rounded-md px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Preview buckets</span>
                  <span className="bg-border h-3 w-px" />
                  <span className="font-mono text-[11px]">
                    {chartRows
                      .map((r) => `${r.label}: ${formatNumber(r.value, selectedMetric?.d3Format)}`)
                      .slice(0, 3)
                      .join(" · ") || "—"}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSave(false)}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={onSave}
                  disabled={saving || !saveName.trim()}
                  className="h-8 text-xs"
                >
                  {saving ? "Saving…" : "Save to Chart List"}
                </Button>
              </div>
              <p className="text-muted-foreground mt-3 text-[11px]">
                After save:{" "}
                <button
                  onClick={() => navigate("/chart/list")}
                  className="text-primary hover:underline"
                  type="button"
                >
                  View in Chart List →
                </button>
              </p>
            </div>
          </div>
        )}

        {toast && (
          <div className="border-border bg-card fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border px-3 py-2 text-sm shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </AppShell>
  );
}
