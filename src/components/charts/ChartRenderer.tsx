import { useEffect, useRef } from "react";

import { colorLegend, defineChart, barY, lineY, areaY, dot, rect, boxY } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scaleOrdinal } from "@tanstack/charts/scales/ordinal";
import { tooltip } from "@tanstack/charts/tooltip";

import type { ChartVizType } from "@/types/chart";
import type { Dataset, DatasetSampleRow } from "@/types/dataset";

type Props = {
  vizType: ChartVizType;
  /** Aggregated buckets for cartesian charts: label = dimension value, value = metric */
  data: { label: string; value: number }[];
  metricLabel: string;
  d3Format?: string;
  dataset: Dataset;
  dimension?: string | null;
  showGrid?: boolean;
  showLegend?: boolean;
  /** Raw rows for Table / Box Plot */
  rawRows?: DatasetSampleRow[];
  rowLimit?: number;
  /** Cross-filter: Bar-only — click a bar to filter other charts */
  onCrossFilter?: (value: string) => void;
  selectedValue?: string | null;
  /** Drill-to-detail: Bar-only — right-click a bar to view underlying rows */
  onDrillDetail?: (payload: { dimension: string; value: string }) => void;
};

// OKLCH tokens from src/index.css — never let TanStack leak its own defaults
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function formatNumber(n: number, d3Format?: string) {
  if (!Number.isFinite(n)) return "—";
  if (d3Format?.includes("%")) return `${(n * 100).toFixed(2)}%`;
  if (d3Format?.includes("$"))
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (d3Format === ",.0f") return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(Number(n.toFixed(2)));
}

function DeferredCard({ vizType, reason }: { vizType: string; reason: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="bg-muted grid h-9 w-9 place-items-center rounded-full">
        <span className="text-muted-foreground text-[11px] font-bold tracking-wide">◌</span>
      </div>
      <p className="mt-3 text-sm font-medium">{vizType} — deferred</p>
      <p className="text-muted-foreground mt-1 max-w-[52ch] text-xs leading-relaxed">{reason}</p>
      <p className="text-muted-foreground mt-2 font-mono text-[11px]">
        TanStack Charts 0.14 core grammar — see src/components/charts/ChartRenderer.tsx
      </p>
    </div>
  );
}

function inferNumericKey(dataset: Dataset): string | null {
  const rows = dataset.sampleRows ?? [];
  for (const col of dataset.columns) {
    if (!/NUMERIC|INTEGER|FLOAT|DOUBLE|DECIMAL/i.test(col.type)) continue;
    if (rows.some((r) => typeof r[col.name] === "number")) return col.name;
  }
  for (const col of dataset.columns) {
    if (rows.some((r) => typeof r[col.name] === "number")) return col.name;
  }
  return null;
}

export default function ChartRenderer({
  vizType,
  data,
  metricLabel,
  d3Format,
  dataset,
  dimension,
  showGrid = true,
  showLegend = true,
  rawRows,
  rowLimit = 10,
  onCrossFilter,
  selectedValue,
  onDrillDetail,
}: Props) {
  const barWrapRef = useRef<HTMLDivElement>(null);

  // Highlight/dim bars when a cross-filter is active on this chart
  useEffect(() => {
    if (vizType !== "Bar") return;
    let raf = 0;
    let tries = 0;
    const apply = () => {
      const wrap = barWrapRef.current;
      if (!wrap) return;
      const svg = wrap.querySelector("svg");
      if (!svg) {
        if (tries++ < 8) raf = window.requestAnimationFrame(apply);
        return;
      }
      const rects = Array.from(svg.querySelectorAll("rect")) as SVGRectElement[];
      const candidates = rects.filter((r) => {
        const w = Number(r.getAttribute("width") ?? 0);
        const h = Number(r.getAttribute("height") ?? 0);
        return w > 6 && h > 6 && w < 300 && h < 360;
      });
      let bars: SVGRectElement[] = candidates.length === data.length ? candidates : candidates.slice(0, data.length);
      if (bars.length !== data.length) {
        const sorted = [...candidates].sort((a, b) => Number(a.getAttribute("x") ?? 0) - Number(b.getAttribute("x") ?? 0));
        bars = sorted.slice(0, data.length);
      } else {
        bars.sort((a, b) => Number(a.getAttribute("x") ?? 0) - Number(b.getAttribute("x") ?? 0));
      }
      if (!bars.length && tries++ < 8) {
        raf = window.requestAnimationFrame(apply);
        return;
      }
      bars.forEach((rect, i) => {
        const label = data[i]?.label;
        if (label == null) return;
        rect.style.cursor = onCrossFilter ? "pointer" : "default";
        rect.style.opacity = selectedValue ? (label === selectedValue ? "1" : "0.28") : "1";
        rect.style.transition = "opacity 150ms ease";
      });
    };
    apply();
    return () => window.cancelAnimationFrame(raf);
  }, [vizType, data, selectedValue, onCrossFilter]);
  if (vizType === "Table") {
    const rows = (rawRows ?? dataset.sampleRows ?? []).slice(0, rowLimit);
    if (!rows.length)
      return (
        <p className="text-muted-foreground px-6 py-10 text-center text-xs">
          No sample rows for {dataset?.name ?? "this dataset"}.
        </p>
      );
    const cols = dataset.columns.slice(0, 6);
    return (
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground border-b text-left">
              {cols.map((c) => (
                <th key={c.name} className="px-3 py-2 font-mono text-[11px] font-medium">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-muted/40">
                {cols.map((c) => (
                  <td
                    key={c.name}
                    className="max-w-[14ch] truncate px-3 py-1.5 font-mono text-[11px]"
                  >
                    {String(r[c.name] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (vizType === "Big Number") {
    const total = data.length ? data.reduce((s, d) => s + d.value, 0) : (data[0]?.value ?? 0);
    const display = data.length === 1 && data[0]?.label === "Total" ? data[0].value : total;
    return (
      <div className="flex flex-col items-center justify-center px-6 py-10">
        <p className="text-muted-foreground text-xs tracking-wide">{metricLabel}</p>
        <p className="mt-2 font-mono text-[40px] font-semibold tracking-tight">
          {formatNumber(display, d3Format)}
        </p>
        <p className="text-muted-foreground mt-1 max-w-[42ch] text-center text-xs leading-relaxed">
          {dataset.source} · {dimension ? `grouped by ${dimension} (total shown)` : "total"} ·{" "}
          {dataset.sampleRows?.length ?? 0} sample rows
        </p>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <p className="text-sm font-medium">No data to chart</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Pick a dimension and metric with values.
        </p>
      </div>
    );
  }

  // ---- TanStack marks — tokens mapped explicitly so no stock demo leak ----
  // Axes/grid: grid var(--border), tick text var(--muted-foreground) + Space Grotesk
  // Tooltips: via `tooltip` extension but themed with var(--card)/var(--border)
  // Categorical: var(--chart-1..5)

  if (vizType === "Bar") {
    const definition = defineChart({
      marks: [barY(data, { x: "label", y: "value", fill: CHART_COLORS[0], radius: 6 })],
      x: {
        scale: () => scaleBand<string>().padding(0.28),
        grid: false,
        axis: {
          label: dimension ?? "label",
          tick: {
            label: {
              style: { fill: "var(--muted-foreground)", fontFamily: "Space Grotesk", fontSize: 11 },
            },
          },
        },
      },
      y: {
        scale: scaleLinear,
        nice: true,
        grid: showGrid,
        axis: {
          label: metricLabel,
          tick: {
            label: {
              style: { fill: "var(--muted-foreground)", fontFamily: "Space Grotesk", fontSize: 11 },
            },
          },
        },
      },
      color: {
        scale: () => scaleOrdinal<string, string>().range(CHART_COLORS),
        legend: showLegend ? colorLegend({ label: metricLabel }) : undefined,
      },
      tooltip,
    });
    const getBarLabelAt = (e: React.MouseEvent<HTMLDivElement>): string | null => {
      const wrap = barWrapRef.current;
      if (!wrap) return null;
      const svg = wrap.querySelector("svg");
      if (!svg) return null;
      const rects = Array.from(svg.querySelectorAll("rect")) as SVGRectElement[];
      const candidates = rects.filter((r) => {
        const w = Number(r.getAttribute("width") ?? 0);
        const h = Number(r.getAttribute("height") ?? 0);
        return w > 6 && h > 6 && w < 300 && h < 360;
      });
      let bars: SVGRectElement[] = candidates.length === data.length ? candidates : candidates.slice(0, data.length);
      if (bars.length !== data.length) {
        bars = [...candidates].sort((a, b) => Number(a.getAttribute("x") ?? 0) - Number(b.getAttribute("x") ?? 0)).slice(0, data.length);
      } else {
        bars.sort((a, b) => Number(a.getAttribute("x") ?? 0) - Number(b.getAttribute("x") ?? 0));
      }
      for (let i = 0; i < bars.length; i++) {
        const box = bars[i].getBoundingClientRect();
        if (e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom) {
          return data[i]?.label ?? null;
        }
      }
      const svgBox = svg.getBoundingClientRect();
      const relX = e.clientX - svgBox.left;
      const leftInset = 48;
      const plotW = svgBox.width - leftInset - 12;
      if (plotW <= 0 || relX < leftInset) return null;
      const idx = Math.min(data.length - 1, Math.max(0, Math.floor(((relX - leftInset) / plotW) * data.length)));
      return data[idx]?.label ?? null;
    };
    const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onCrossFilter) return;
      const label = getBarLabelAt(e);
      if (label != null) onCrossFilter(label);
    };
    const handleBarContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onDrillDetail || !dimension) return;
      e.preventDefault();
      const label = getBarLabelAt(e);
      if (label != null) onDrillDetail({ dimension, value: label });
    };
    const interactive = Boolean(onCrossFilter || onDrillDetail);
    return (
      <div
        ref={barWrapRef}
        onClick={onCrossFilter ? handleBarClick : undefined}
        onContextMenu={onDrillDetail && dimension ? handleBarContextMenu : undefined}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  const first = data[0]?.label;
                  if (first != null && onCrossFilter) onCrossFilter(first);
                }
              }
            : undefined
        }
        className={interactive ? "h-[360px] w-full cursor-pointer sm:h-[400px]" : "h-[360px] w-full sm:h-[400px]"}
        aria-label={
          interactive
            ? `Bar chart: ${dimension ?? "category"} — click to filter, right-click for row details`
            : undefined
        }
        title={
          onCrossFilter && onDrillDetail
            ? `Click a bar to filter other charts by ${dimension ?? "category"} · Right-click for row-level data`
            : onCrossFilter
              ? `Click a bar to filter other charts by ${dimension ?? "category"}`
              : onDrillDetail
                ? `Right-click a bar for row-level data`
                : undefined
        }
      >
        <Chart
          definition={definition}
          ariaLabel={`${metricLabel} by ${dimension ?? "total"} — Bar`}
          className="h-full w-full"
        />
      </div>
    );
  }

  if (vizType === "Line") {
    const definition = defineChart({
      marks: [
        lineY(data, { x: "label", y: "value", stroke: CHART_COLORS[1], strokeWidth: 2.2 }),
        dot(data, { x: "label", y: "value", fill: CHART_COLORS[1], r: 3 }),
      ],
      x: {
        scale: () => scaleBand<string>().padding(0.35),
        grid: showGrid,
        axis: {
          label: dimension ?? "label",
          tick: {
            label: {
              style: { fill: "var(--muted-foreground)", fontFamily: "Space Grotesk", fontSize: 11 },
            },
          },
        },
      },
      y: {
        scale: scaleLinear,
        nice: true,
        grid: showGrid,
        axis: {
          label: metricLabel,
          tick: {
            label: {
              style: { fill: "var(--muted-foreground)", fontFamily: "Space Grotesk", fontSize: 11 },
            },
          },
        },
      },
      color: { scale: () => scaleOrdinal<string, string>().range([CHART_COLORS[1]]) },
      tooltip,
    });
    return (
      <Chart
        definition={definition}
        ariaLabel={`${metricLabel} by ${dimension ?? "total"} — Line`}
        className="h-[360px] w-full sm:h-[400px]"
      />
    );
  }

  if (vizType === "Area") {
    const definition = defineChart({
      marks: [
        areaY(data, {
          x: "label",
          y: "value",
          fill: CHART_COLORS[2],
          fillOpacity: 0.22,
          stroke: CHART_COLORS[2],
          strokeWidth: 1.8,
        }),
      ],
      x: {
        scale: () => scaleBand<string>().padding(0.3),
        grid: showGrid,
        axis: {
          label: dimension ?? "label",
          tick: {
            label: {
              style: { fill: "var(--muted-foreground)", fontFamily: "Space Grotesk", fontSize: 11 },
            },
          },
        },
      },
      y: {
        scale: scaleLinear,
        nice: true,
        grid: showGrid,
        axis: {
          label: metricLabel,
          tick: {
            label: {
              style: { fill: "var(--muted-foreground)", fontFamily: "Space Grotesk", fontSize: 11 },
            },
          },
        },
      },
      tooltip,
    });
    return (
      <Chart
        definition={definition}
        ariaLabel={`${metricLabel} by ${dimension ?? "total"} — Area`}
        className="h-[360px] w-full sm:h-[400px]"
      />
    );
  }

  if (vizType === "Scatter") {
    const definition = defineChart({
      marks: [
        dot(data, {
          x: "label",
          y: "value",
          fill: CHART_COLORS[0],
          r: 5,
          fillOpacity: 0.9,
          stroke: "var(--card)",
          strokeWidth: 1,
        }),
      ],
      x: {
        scale: () => scaleBand<string>().padding(0.4),
        grid: showGrid,
        axis: {
          label: dimension ?? "label",
          tick: {
            label: {
              style: { fill: "var(--muted-foreground)", fontFamily: "Space Grotesk", fontSize: 11 },
            },
          },
        },
      },
      y: {
        scale: scaleLinear,
        nice: true,
        grid: showGrid,
        axis: {
          label: metricLabel,
          tick: {
            label: {
              style: { fill: "var(--muted-foreground)", fontFamily: "Space Grotesk", fontSize: 11 },
            },
          },
        },
      },
      tooltip,
    });
    return (
      <Chart
        definition={definition}
        ariaLabel={`${metricLabel} — Scatter`}
        className="h-[360px] w-full sm:h-[400px]"
      />
    );
  }

  if (vizType === "Heatmap") {
    // Single-category row heatmap via rect — keep y as a constant category band.
    // 0.14.0 rect/cell generics can trip inference for constant-y channels; cast to keep
    // the runtime mark live without fighting the brand-heavy CheckedChartSpec.
    const definition = (
      defineChart as unknown as (spec: unknown) => Parameters<typeof Chart>[0]["definition"]
    )({
      marks: [rect(data, { x: "label", y: () => metricLabel, fill: CHART_COLORS[3], radius: 4 })],
      x: {
        scale: () => scaleBand<string>().padding(0.08),
        axis: {
          tick: {
            label: {
              style: { fill: "var(--muted-foreground)", fontFamily: "Space Grotesk", fontSize: 10 },
            },
          },
        },
      },
      y: {
        scale: () => scaleBand<string>().padding(0.2),
        axis: {
          tick: {
            label: {
              style: { fill: "var(--muted-foreground)", fontFamily: "Space Grotesk", fontSize: 11 },
            },
          },
        },
      },
      color: {
        scale: () =>
          scaleOrdinal<string, string>().range([CHART_COLORS[3], CHART_COLORS[1], CHART_COLORS[4]]),
      },
      tooltip,
    } as unknown);
    return (
      <Chart
        definition={definition}
        ariaLabel={`${metricLabel} — Heatmap`}
        className="h-[360px] w-full sm:h-[400px]"
      />
    );
  }

  if (vizType === "Box Plot") {
    const numericKey = inferNumericKey(dataset);
    const src = (rawRows ?? dataset.sampleRows ?? []) as readonly Record<string, unknown>[];
    if (!dimension || !numericKey || !src.length) {
      return (
        <DeferredCard
          vizType="Box Plot"
          reason="Needs a categorical dimension and a numeric metric with sample rows to compute quartiles — pick a groupable column and a numeric metric."
        />
      );
    }
    // boxY's BoxYDatum brands make the generic inference brittle for the x/y
    // literal channels; the mark itself is correct at runtime — cast the spec.
    const definition = (
      defineChart as unknown as (spec: unknown) => Parameters<typeof Chart>[0]["definition"]
    )({
      marks: [
        boxY(src, {
          x: dimension as never,
          y: numericKey as never,
          fill: CHART_COLORS[2],
          stroke: "var(--border)",
        }),
      ],
      x: {
        scale: () => scaleBand<string>().padding(0.3),
        axis: {
          tick: {
            label: {
              style: { fill: "var(--muted-foreground)", fontFamily: "Space Grotesk", fontSize: 11 },
            },
          },
        },
      },
      y: {
        scale: scaleLinear,
        nice: true,
        grid: showGrid,
        axis: {
          label: metricLabel,
          tick: {
            label: {
              style: { fill: "var(--muted-foreground)", fontFamily: "Space Grotesk", fontSize: 11 },
            },
          },
        },
      },
      tooltip,
    } as unknown);
    return (
      <Chart
        definition={definition}
        ariaLabel={`${metricLabel} — Box Plot`}
        className="h-[360px] w-full sm:h-[400px]"
      />
    );
  }

  if (vizType === "Violin") {
    return (
      <DeferredCard
        vizType="Violin"
        reason="violinY mark exists in dist/violin.js but is not yet re-exported from the public entry at 0.14.0 — deferred until the export stabilizes. Box Plot above uses the same distribution shape today."
      />
    );
  }

  if (vizType === "Pie" || vizType === "Donut") {
    return (
      <DeferredCard
        vizType={vizType}
        reason={
          vizType === "Donut"
            ? "Donut is a Pie variant (innerRadius > 0). polar-pie exists internally at dist/polar-pie.js but is not exported via package.json `exports` at 0.14.0 — deferred until TanStack exposes it publicly; Heatmap/Box above already prove the mark pipeline."
            : "polar-pie exists at dist/polar-pie.js but is not exported from the public entry at 0.14.0 (package `exports` blocks ./polar-pie). Deferred rather than bypassing the boundary; will wire via `import { pie } from '@tanstack/charts'` once the export lands. Cartesian/rect marks above are the live proof of the pipeline."
        }
      />
    );
  }

  if (vizType === "Treemap") {
    return (
      <DeferredCard
        vizType="Treemap"
        reason="hierarchy/treemap exists at @tanstack/charts/hierarchy/treemap but needs a nested tree (parentId/name/value), not flat label/value buckets. Deferred until Explore builds a tree transform from sampleRows."
      />
    );
  }

  if (vizType === "Sunburst") {
    return (
      <DeferredCard
        vizType="Sunburst"
        reason="hierarchy/sunburst exists at @tanstack/charts/hierarchy/sunburst but needs ancestor-aware SunburstNode tree, not flat buckets. Deferred until a hierarchy transform is wired."
      />
    );
  }

  if (vizType === "Sankey") {
    return (
      <DeferredCard
        vizType="Sankey"
        reason="network/sankey exists at @tanstack/charts/network/sankey (wraps d3-sankey) but needs a graph of nodes + links, not a single metric by dimension. Highly complex per the brief — deferred with reason, not as a generic placeholder."
      />
    );
  }

  if (vizType === "Gauge") {
    return (
      <DeferredCard
        vizType="Gauge"
        reason="No gauge/arc mark is exported in 0.14.0 core grammar yet. Would compose rect + polar sector once TanStack exposes it; deferred rather than faking with an unrelated mark."
      />
    );
  }

  return (
    <DeferredCard
      vizType={vizType}
      reason="No TanStack mark mapped for this vizType in this pass."
    />
  );
}
