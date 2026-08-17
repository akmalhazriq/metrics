import * as React from "react";
import { X, ChevronLeft, ChevronRight, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DatasetColumn, DatasetSampleRow } from "@/types/dataset";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  columns: DatasetColumn[];
  rows: DatasetSampleRow[];
};

const PAGE_SIZE = 25;

function formatCellValue(v: unknown): { text: string; isNumber: boolean } {
  if (v == null) return { text: "—", isNumber: false };
  if (typeof v === "number") return { text: Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v), isNumber: true };
  if (typeof v === "boolean") return { text: v ? "true" : "false", isNumber: false };
  if (v instanceof Date) return { text: v.toISOString(), isNumber: false };
  // Try ISO date string
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return { text: d.toISOString(), isNumber: false };
  }
  return { text: String(v), isNumber: false };
}

export function DrillDetailModal({ open, onOpenChange, title, subtitle, columns, rows }: Props) {
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    if (open) setPage(1);
  }, [open, rows]);

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onOpenChange]);

  // Lock scroll when open
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, total);
  const pageRows = rows.slice(start, end);
  const showingText = total === 0 ? "No rows" : `Showing ${start + 1}–${end} of ${total} row${total === 1 ? "" : "s"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drill-title"
        className="bg-card border-border relative z-10 flex max-h-[82vh] w-full max-w-[920px] flex-col overflow-hidden rounded-lg border shadow-xl"
      >
        {/* Header */}
        <div className="border-border flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="bg-muted border-border grid h-7 w-7 place-items-center rounded-md border">
                <Table2 className="text-muted-foreground h-3.5 w-3.5" />
              </span>
              <h2 id="drill-title" className="truncate text-sm font-semibold tracking-tight">
                {title}
              </h2>
            </div>
            {subtitle && <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{subtitle}</p>}
            <p className="text-muted-foreground mt-1 font-mono text-[11px]">{showingText} · {columns.length} column{columns.length === 1 ? "" : "s"}</p>
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0" onClick={() => onOpenChange(false)} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {total === 0 ? (
            <div className="grid place-items-center px-6 py-14 text-center">
              <div className="bg-muted grid h-10 w-10 place-items-center rounded-full">
                <Table2 className="text-muted-foreground h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-medium">No rows match this filter</p>
              <p className="text-muted-foreground mt-1 max-w-[44ch] text-xs leading-relaxed">
                Try a different bar or clear the active cross-filters above the canvas.
              </p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground sticky top-0 z-10 border-b">
                <tr className="text-left">
                  {columns.map((c) => (
                    <th key={c.name} className="border-border whitespace-nowrap border-b px-3 py-2 font-mono text-[11px] font-semibold tracking-wide">
                      <span className="text-foreground">{c.name}</span>
                      <span className="text-muted-foreground ml-1.5 font-normal">{c.type.toLowerCase()}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {pageRows.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/40">
                    {columns.map((c) => {
                      const { text, isNumber } = formatCellValue((r as Record<string, unknown>)[c.name]);
                      return (
                        <td
                          key={c.name}
                          className={`max-w-[20ch] truncate px-3 py-1.5 font-mono text-[11px] ${isNumber ? "text-right" : "text-left"}`}
                          title={text}
                        >
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
          <span className="text-muted-foreground font-mono text-[11px]">{showingText}</span>
          {total > PAGE_SIZE && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Prev
              </Button>
              <span className="text-muted-foreground px-2 font-mono text-[11px]">
                Page {safePage} of {totalPages}
              </span>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <Button variant="outline" size="sm" className="ml-auto h-7 text-xs" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
