import { useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpToLine, FileJson, Upload } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ApiError, mutate } from "@/lib/api";

export default function ImportExportPage() {
  // Import
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Record<string, unknown[]> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<Record<string, unknown> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Export
  const [expDash, setExpDash] = useState(true);
  const [expChart, setExpChart] = useState(true);
  const [expDataset, setExpDataset] = useState(false);
  const [expDatabase, setExpDatabase] = useState(false);
  const [expIds, setExpIds] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const showToast = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2200); };

  const handleFile = async (file: File) => {
    setFileName(file.name); setParseError(null); setParsed(null); setImportResult(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text) as Record<string, unknown>;
      if (typeof json !== "object" || json === null) throw new Error("JSON root must be an object");
      const keys = ["dashboards", "charts", "datasets", "databases"];
      const has = keys.some((k) => Array.isArray((json as Record<string, unknown[]>)[k]));
      if (!has && Array.isArray(json)) {
        setParsed({ dashboards: json as unknown as unknown[] });
      } else if (!has) {
        throw new Error("Expected keys: dashboards, charts, datasets, databases");
      } else {
        setParsed(json as Record<string, unknown[]>);
      }
    } catch (e: unknown) { setParseError(e instanceof Error ? e.message : String(e)); }
  };

  const handleImport = async () => {
    if (!parsed) return;
    setImporting(true);
    setError(null);
    try {
      const j = await mutate<Record<string, unknown>>("/api/importexport/import", "POST", parsed);
      setImportResult(j);
      showToast("Import complete");
    } catch (e: unknown) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Import failed";
      setError(msg);
      showToast(msg);
    } finally { setImporting(false); }
  };

  const handleExport = async () => {
    const entities: string[] = [];
    if (expDash) entities.push("dashboard");
    if (expChart) entities.push("chart");
    if (expDataset) entities.push("dataset");
    if (expDatabase) entities.push("database");
    if (entities.length === 0) { showToast("Pick at least one entity type"); return; }
    const p = new URLSearchParams();
    p.set("entities", entities.join(","));
    if (expIds.trim()) p.set("ids", expIds.trim());
    setError(null);
    try {
      const r = await fetch(`/api/importexport/export?${p.toString()}`);
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
        throw new ApiError(r.status, body.message || body.error || "Export failed");
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      showToast("Download started");
    } catch (e: unknown) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Export failed";
      setError(msg);
      showToast(msg);
    }
  };

  const counts = parsed ? Object.entries(parsed).filter(([, v]) => Array.isArray(v)).map(([k, v]) => `${(v as unknown[]).length} ${k}`).join(" · ") : null;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="bg-muted text-muted-foreground grid h-7 w-7 place-items-center rounded-md"><FileJson className="h-4 w-4" /></div>
          <h1 className="text-[22px] font-semibold tracking-tight">Import / Export</h1>
        </div>
        <p className="text-muted-foreground mt-1 max-w-[60ch] text-sm leading-relaxed">Move dashboards, charts, datasets and databases as JSON. Import is scoped to JSON only — ZIP/YAML is deferred. Export hits <code className="bg-muted rounded px-1">/api/importexport/export</code> directly.</p>

        {error && <div className="border-destructive/30 bg-destructive/10 text-destructive mt-4 rounded-md border px-3 py-2 text-xs">{error}</div>}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Import */}
          <div className="border-border bg-card rounded-lg border">
            <div className="border-border flex items-center gap-2 border-b px-4 py-3">
              <ArrowUpToLine className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-semibold">Import</h2>
              <span className="text-muted-foreground ml-auto text-xs">JSON only</span>
            </div>
            <div className="p-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void handleFile(f); }}
                onClick={() => inputRef.current?.click()}
                className="border-border bg-muted/30 hover:bg-muted/50 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors"
              >
                <Upload className="text-muted-foreground h-6 w-6" />
                <p className="text-sm font-medium">Drop a JSON file here, or click to browse</p>
                <p className="text-muted-foreground text-xs">Keys: dashboards, charts, datasets, databases — as from Export.</p>
                <input ref={inputRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
              </div>
              {fileName && <p className="text-muted-foreground mt-3 text-xs">Selected: <span className="text-foreground font-medium">{fileName}</span> {counts && `· ${counts}`}</p>}
              {parseError && <p className="text-destructive mt-2 rounded bg-[var(--destructive)]/10 px-2 py-1 text-xs">{parseError}</p>}
              {parsed && (
                <div className="mt-3 rounded-md border border-dashed px-3 py-2">
                  <p className="text-xs font-medium">Preview</p>
                  <pre className="mt-1 max-h-48 overflow-auto rounded bg-[var(--muted)] px-2 py-2 font-mono text-[11px]">{JSON.stringify(parsed, null, 2).slice(0, 3000)}{JSON.stringify(parsed).length > 3000 ? "\n… truncated" : ""}</pre>
                </div>
              )}
              {importResult && (
                <div className="border-border bg-muted/20 mt-3 rounded-md border px-3 py-2">
                  <p className="text-xs font-medium">Import summary</p>
                  <pre className="mt-1 font-mono text-[11px]">{JSON.stringify(importResult, null, 2)}</pre>
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <Button size="sm" disabled={!parsed || importing} onClick={handleImport}>{importing ? "Importing…" : "Import"}</Button>
              </div>
            </div>
          </div>

          {/* Export */}
          <div className="border-border bg-card rounded-lg border">
            <div className="border-border flex items-center gap-2 border-b px-4 py-3">
              <ArrowDownToLine className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-semibold">Export</h2>
              <span className="text-muted-foreground ml-auto text-xs">GET /api/importexport/export</span>
            </div>
            <div className="p-4">
              <p className="text-xs font-medium">Entity types</p>
              <div className="mt-2 grid gap-2">
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={expDash} onChange={(e) => setExpDash((e.target as HTMLInputElement).checked)} aria-label="Dashboards" /> Dashboards</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={expChart} onChange={(e) => setExpChart((e.target as HTMLInputElement).checked)} aria-label="Charts" /> Charts</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={expDataset} onChange={(e) => setExpDataset((e.target as HTMLInputElement).checked)} aria-label="Datasets" /> Datasets</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={expDatabase} onChange={(e) => setExpDatabase((e.target as HTMLInputElement).checked)} aria-label="Databases" /> Databases</label>
              </div>
              <label className="mt-4 block space-y-1.5">
                <span className="text-xs font-medium">IDs (optional) — comma separated</span>
                <Input value={expIds} onChange={(e) => setExpIds(e.target.value)} placeholder="1, 2, 3 — leave blank for all" className="h-8 text-sm" />
                <span className="text-muted-foreground text-[11px]">Filters dashboards/charts/datasets by id. Databases exports all.</span>
              </label>
              <div className="mt-4 flex justify-end">
                <Button size="sm" onClick={handleExport}><ArrowDownToLine className="mr-1.5 h-3.5 w-3.5" /> Export JSON</Button>
              </div>
              <div className="border-border bg-muted/20 mt-6 rounded-md border px-3 py-2">
                <p className="text-[11px] font-medium">Tip</p>
                <p className="text-muted-foreground text-[11px] leading-relaxed">Export then re-import to clone across environments. The file is also a valid Import input — no transform needed. ZIP/YAML support is deferred.</p>
              </div>
            </div>
          </div>
        </div>
        <p className="text-muted-foreground mt-3 text-xs">Import via <code className="bg-muted rounded px-1 py-0.5">POST /api/importexport/import</code> (transactional) · Export via <code className="bg-muted rounded px-1 py-0.5">GET /api/importexport/export?entities=…&ids=…</code>.</p>
      </div>
      {toast && <div className="border-border bg-card fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border px-3 py-2 text-sm shadow-lg">{toast}</div>}
    </AppShell>
  );
}
