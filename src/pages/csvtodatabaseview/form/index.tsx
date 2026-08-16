import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Database,
  FileSpreadsheet,
  FileText,
  Table2,
  Upload,
  X,
  Eye,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { seedDatabases } from "@/data/databases";

type Parsed = { headers: string[]; rows: string[][]; truncated: boolean };

// ---- Hand-rolled CSV parser (placeholder phase) --------------------------------
// Quoted fields, escaped "" inside quotes, delimiter-aware. ~60 lines —
// sufficient for a real preview without pulling in papaparse (~40 kB) or
// sheetjs (~500 kB) when the production backend will parse anyway.
// Excel (.xlsx/.xls) is binary; we surface a guidance note instead of
// silently failing — see Excel note in the page.
function parseCsvText(
  text: string,
  delimiter: string,
  hasHeader: boolean,
  nullValuesRaw: string,
  dataframeIndex: boolean,
  parseDates: boolean,
): Parsed {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((l) => l.length > 0);
  if (!lines.length) return { headers: [], rows: [], truncated: false };

  const delim = delimiter === "\\t" ? "\t" : delimiter;
  const nullSet = new Set(
    nullValuesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const rows: string[][] = [];
  for (const line of lines) {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = !inQuotes;
      } else if (ch === delim && !inQuotes) {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    rows.push(cells.map((c) => c.trim().replace(/^"|"$/g, "")));
  }

  // dataframe index: drop first column if flag is on and every row has same width
  let working = rows;
  if (dataframeIndex && working.every((r) => r.length > 1)) {
    working = working.map((r) => r.slice(1));
  }

  // null handling + date coercion (display-level only)
  const coerce = (v: string) => {
    if (nullSet.has(v) || (nullSet.size && v === "")) return "";
    if (parseDates && /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 19).replace("T", " ");
    }
    return v;
  };
  working = working.map((r) => r.map(coerce));

  let headers: string[];
  let dataRows: string[][];
  if (hasHeader) {
    headers = (working[0] ?? []).map((h, i) => h || `col_${i + 1}`);
    dataRows = working.slice(1);
  } else {
    const width = working[0]?.length ?? 0;
    headers = Array.from({ length: width }, (_, i) => `col_${i + 1}`);
    dataRows = working;
  }

  // de-duplicate headers like Superset does
  const seen = new Map<string, number>();
  headers = headers.map((h) => {
    const n = seen.get(h) ?? 0;
    seen.set(h, n + 1);
    return n ? `${h}_${n + 1}` : h;
  });

  const truncated = dataRows.length > 100;
  return { headers, rows: dataRows.slice(0, 100), truncated };
}

export default function UploadFormPage() {
  const location = useLocation();
  const isExcelRoute = location.pathname.includes("exceltodatabaseview");
  const fileType: "csv" | "excel" = isExcelRoute ? "excel" : "csv";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // CSV options per spec
  const [delimiter, setDelimiter] = useState(","); // , ; \t |
  const [hasHeader, setHasHeader] = useState(true);
  const [parseDates, setParseDates] = useState(false);
  const [nullValues, setNullValues] = useState("");
  const [dataframeIndex, setDataframeIndex] = useState(false);

  // Target
  const [databaseId, setDatabaseId] = useState(seedDatabases[0]?.id ?? "analytics");
  const [schema, setSchema] = useState(seedDatabases[0]?.schemas[0]?.name ?? "public");
  const [tableName, setTableName] = useState("");

  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    databaseId: string;
    schema: string;
    table: string;
    columns: string[];
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const db = seedDatabases.find((d) => d.id === databaseId) ?? seedDatabases[0]!;
  // Keep schema in sync when database changes
  useEffect(() => {
    const first = seedDatabases.find((d) => d.id === databaseId)?.schemas[0]?.name;
    if (
      first &&
      !seedDatabases.find((d) => d.id === databaseId)?.schemas.some((s) => s.name === schema)
    ) {
      setSchema(first);
    }
  }, [databaseId, schema]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  const handleFile = (file: File) => {
    setFileError(null);
    setResult(null);
    setFileName(file.name);
    if (!tableName) {
      const base = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .slice(0, 48);
      setTableName(base || "uploaded_table");
    }
    // Excel binary — don't try to FileReader as text silently
    if (fileType === "excel" || /\.xlsx?$/i.test(file.name)) {
      if (file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls")) {
        // Try reading as text anyway to show row count if user exported as CSV-by-mistake,
        // but warn that binary Excel needs CSV export in placeholder.
        if (file.size > 5 * 1024 * 1024) {
          setFileError(
            "Excel file over 5 MB — export it as CSV first for the placeholder importer.",
          );
          setRawText(null);
          return;
        }
        // Read first bytes to detect ZIP (xlsx = zip)
        const reader = new FileReader();
        reader.onload = () => {
          const txt = String(reader.result ?? "");
          const looksZip = txt.startsWith("PK");
          if (looksZip) {
            setFileError(
              "This looks like a binary .xlsx file. The placeholder importer only previews CSV. Export the sheet as CSV first — full Excel parsing is deferred until a backend parser (sheetjs) is wired.",
            );
            setRawText(null);
          } else {
            setRawText(txt);
          }
        };
        reader.onerror = () => setFileError("Could not read file.");
        reader.readAsText(file);
        return;
      }
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError("File over 5 MB — try a smaller sample for the placeholder preview.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setRawText(String(reader.result ?? ""));
    reader.onerror = () => setFileError("Could not read file.");
    reader.readAsText(file);
  };

  const parsed: Parsed | null = useMemo(() => {
    if (!rawText) return null;
    try {
      return parseCsvText(rawText, delimiter, hasHeader, nullValues, dataframeIndex, parseDates);
    } catch {
      return null;
    }
  }, [rawText, delimiter, hasHeader, nullValues, dataframeIndex, parseDates]);

  const canImport =
    !!parsed &&
    parsed.headers.length > 0 &&
    !!databaseId &&
    !!schema &&
    !!tableName.trim() &&
    !importing;

  const onImport = async () => {
    if (!parsed || !canImport) return;
    setImporting(true);
    try {
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          databaseId,
          schema,
          tableName: tableName.trim(),
          columns: parsed.headers,
          rowCount: parsed.rows.length,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        databaseId?: string;
        schema?: string;
        table?: string;
        columns?: string[];
      };
      if (!res.ok) throw new Error(data.message || data.error || "Import failed");
      setResult({
        databaseId: data.databaseId!,
        schema: data.schema!,
        table: data.table!,
        columns: data.columns ?? parsed.headers,
      });
      showToast(
        `Imported ${parsed.rows.length} rows into ${data.databaseId}.${data.schema}.${data.table}`,
      );
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const resetFile = () => {
    setFileName(null);
    setRawText(null);
    setFileError(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const allowCsv = db.allowCsvUpload;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
        {/* Header + file-type toggle */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="bg-muted text-muted-foreground grid h-7 w-7 place-items-center rounded-md">
                <Upload className="h-4 w-4" />
              </div>
              <h1 className="text-[22px] font-semibold tracking-tight">Upload data</h1>
              <span className="bg-warning text-warning-foreground rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide">
                PLACEHOLDER
              </span>
            </div>
            <p className="text-muted-foreground mt-1 max-w-[62ch] text-sm leading-relaxed">
              Drop a local CSV or Excel file, pick where it lands, preview it for real, then import.
              The imported table appears in the Database Editor and in Dataset create — same single
              source as the rest of the placeholder layer.
            </p>
          </div>
          <div className="border-input bg-background flex gap-1 rounded-md border p-0.5">
            <Link
              to="/csvtodatabaseview/form"
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium ${fileType === "csv" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <FileText className="h-3.5 w-3.5" /> CSV
            </Link>
            <Link
              to="/exceltodatabaseview/form"
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium ${fileType === "excel" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Link>
          </div>
        </div>

        {/* Two thin routes share one component — toggle just switches route */}
        <p className="text-muted-foreground mt-3 text-xs">
          Routes: <code className="bg-muted rounded px-1 py-0.5">/csvtodatabaseview/form</code> and{" "}
          <code className="bg-muted rounded px-1 py-0.5">/exceltodatabaseview/form</code> — two spec
          routes, one implementation. Toggle above switches route; form state is shared.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Left: drop + target */}
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFile(f);
              }}
              className={`border-border bg-card rounded-lg border-2 border-dashed p-6 text-center transition-colors ${dragOver ? "border-primary bg-muted/40" : "hover:border-input"}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={fileType === "csv" ? ".csv,.txt" : ".xlsx,.xls,.csv,.txt"}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <div className="mx-auto flex max-w-[36ch] flex-col items-center">
                <div className="bg-muted grid h-10 w-10 place-items-center rounded-full">
                  {fileType === "csv" ? (
                    <FileText className="h-5 w-5" />
                  ) : (
                    <FileSpreadsheet className="h-5 w-5" />
                  )}
                </div>
                <p className="mt-3 text-sm font-medium">
                  {fileType === "csv" ? "Drop a CSV file here" : "Drop an Excel or CSV file here"}
                </p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  {fileType === "csv"
                    ? "Comma, semicolon, tab or pipe — parsed in the browser before import."
                    : "Binary .xlsx preview is deferred in this phase — export as CSV for a real preview (see note)."}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" /> Choose file
                </Button>
                <p className="text-muted-foreground mt-2 text-[11px]">
                  Max 5 MB for placeholder preview. Nothing leaves this browser until you hit
                  Import.
                </p>
              </div>
              {fileName && (
                <div className="border-border bg-muted/40 mt-4 flex items-center gap-2 rounded-md border px-3 py-2 text-left">
                  <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                  <span className="truncate font-mono text-xs">{fileName}</span>
                  <span className="text-muted-foreground ml-auto hidden text-xs sm:inline">
                    {parsed
                      ? `${parsed.rows.length} rows · ${parsed.headers.length} cols`
                      : rawText
                        ? "parsing…"
                        : ""}
                  </span>
                  <button
                    onClick={resetFile}
                    className="text-muted-foreground hover:text-foreground ml-2 grid h-6 w-6 place-items-center rounded"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {fileError && (
                <div className="border-destructive/30 bg-destructive/10 text-destructive mt-3 flex gap-2 rounded-md border px-3 py-2 text-left text-xs leading-relaxed">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{fileError}</span>
                </div>
              )}
              {result && (
                <div className="border-success/30 bg-success/10 mt-3 flex gap-2 rounded-md border px-3 py-2 text-left text-xs leading-relaxed">
                  <CheckCircle2 className="text-success mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Imported{" "}
                    <span className="font-mono font-medium">
                      {result.databaseId}.{result.schema}.{result.table}
                    </span>{" "}
                    ({result.columns.length} cols).{" "}
                    <Link to={`/databaseview/list`} className="underline-offset-2 hover:underline">
                      View in Databases →
                    </Link>
                    {" · "}
                    <Link
                      to={`/tablemodelview/list`}
                      className="underline-offset-2 hover:underline"
                    >
                      Create dataset →
                    </Link>
                  </span>
                </div>
              )}
            </div>

            <div className="border-border bg-card rounded-lg border p-4">
              <p className="text-xs font-semibold tracking-wide">Target — where the table lands</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Database *</span>
                  <div className="relative">
                    <select
                      value={databaseId}
                      onChange={(e) => setDatabaseId(e.target.value)}
                      className="border-input bg-background h-9 w-full rounded-md border px-3 pr-8 text-sm"
                    >
                      {seedDatabases.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} · {d.backend}
                          {d.allowCsvUpload ? "" : " (no CSV upload)"}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2" />
                  </div>
                  {!allowCsv && (
                    <span className="text-warning-foreground bg-warning/20 inline-flex rounded px-1.5 py-0.5 text-[11px]">
                      This DB has Allow CSV upload off — import still works in placeholder, but in
                      prod it would be blocked.
                    </span>
                  )}
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Schema *</span>
                  <div className="relative">
                    <select
                      value={schema}
                      onChange={(e) => setSchema(e.target.value)}
                      className="border-input bg-background h-9 w-full rounded-md border px-3 pr-8 text-sm"
                    >
                      {db.schemas.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name} ({s.tables.length} tables)
                        </option>
                      ))}
                      <option value="__new">— New schema… —</option>
                    </select>
                    <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2" />
                  </div>
                  {schema === "__new" && (
                    <Input
                      autoFocus
                      placeholder="new_schema"
                      onBlur={(e) => {
                        const v = e.target.value
                          .trim()
                          .replace(/[^a-zA-Z0-9_]/g, "_")
                          .slice(0, 32);
                        if (v) setSchema(v);
                        else setSchema(db.schemas[0]?.name ?? "public");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      className="mt-1 h-8 font-mono text-xs"
                    />
                  )}
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Table name *</span>
                  <Input
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder="uploaded_table"
                    className="h-9 font-mono text-xs"
                  />
                  <span className="text-muted-foreground text-[11px]">
                    Sanitized to <code className="bg-muted rounded px-1">a-z0-9_</code> — max 64.
                  </span>
                </label>
              </div>
              <div className="text-muted-foreground mt-3 flex flex-wrap gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  {db.schemas.length} schemas ·{" "}
                  {db.schemas.reduce((n, s) => n + s.tables.length, 0)} tables
                </span>
                <span className="bg-border hidden h-3 w-px sm:inline-block" />
                <span>
                  Existing tables:{" "}
                  {db.schemas
                    .find((s) => s.name === schema)
                    ?.tables.slice(0, 4)
                    .map((t) => t.name)
                    .join(", ") || "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Right: CSV options */}
          <div className="border-border bg-card rounded-lg border p-4">
            <p className="text-xs font-semibold tracking-wide">CSV options</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              These run before preview — same set the spec lists for Superset's CSV form.
            </p>
            <div className="mt-4 space-y-4">
              <label className="space-y-1.5">
                <span className="text-xs font-medium">Delimiter</span>
                <div className="relative">
                  <select
                    value={delimiter}
                    onChange={(e) => setDelimiter(e.target.value)}
                    className="border-input bg-background h-9 w-full rounded-md border px-3 pr-8 font-mono text-sm text-xs"
                  >
                    <option value=",">, &nbsp; Comma</option>
                    <option value=";">; &nbsp; Semicolon</option>
                    <option value={"\t"}>\t &nbsp; Tab</option>
                    <option value="|">| &nbsp; Pipe</option>
                  </select>
                  <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2" />
                </div>
              </label>
              <label className="flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={hasHeader}
                  onChange={(e) => setHasHeader(e.target.checked)}
                  className="accent-primary h-3.5 w-3.5 rounded border"
                />
                Header row — first row is column names
              </label>
              <label className="flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={parseDates}
                  onChange={(e) => setParseDates(e.target.checked)}
                  className="accent-primary h-3.5 w-3.5 rounded border"
                />
                Parse dates — coerce YYYY-MM-DD into timestamps
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium">Null values</span>
                <Input
                  value={nullValues}
                  onChange={(e) => setNullValues(e.target.value)}
                  placeholder="e.g. NULL, N/A or leave blank"
                  className="h-8 font-mono text-xs"
                />
                <span className="text-muted-foreground text-[11px]">
                  Comma-separated — matching cells become empty in preview.
                </span>
              </label>
              <label className="flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={dataframeIndex}
                  onChange={(e) => setDataframeIndex(e.target.checked)}
                  className="accent-primary h-3.5 w-3.5 rounded border"
                />
                Dataframe index — first column is an index, drop it
              </label>
              <div className="border-border bg-muted/40 rounded-md border p-3">
                <p className="text-xs font-medium">Why a hand-rolled parser?</p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  No <code className="bg-background rounded border px-1">papaparse</code> in{" "}
                  <code className="bg-background rounded border px-1">package.json</code> today. ~60
                  lines handles quoted fields, delimiter, and the five CSV options for a real
                  preview — adding a 40 kB dep isn't justified while the real backend will parse
                  anyway (same call as skipping Monaco for SQL Lab). Excel (.xlsx) is binary ZIP —
                  needs <code className="bg-background rounded border px-1">sheetjs</code> (~500
                  kB); deferred until a backend parser is wired.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="border-border bg-card mt-4 overflow-hidden rounded-lg border">
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide">
              <Eye className="h-3.5 w-3.5" /> Preview{" "}
              {parsed
                ? `· ${parsed.rows.length} rows${parsed.truncated ? " (first 100)" : ""} · ${parsed.headers.length} cols`
                : "· drop a file to see real data"}
            </span>
            <span className="bg-border hidden h-3 w-px sm:inline-block" />
            <span className="text-muted-foreground hidden text-xs sm:inline">
              This is the actual file content — not a seeded table.
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={resetFile}
                disabled={!fileName}
              >
                Clear
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={onImport} disabled={!canImport}>
                {importing
                  ? "Importing…"
                  : `Import into ${databaseId}.${schema}.${tableName || "…"}`}
              </Button>
            </div>
          </div>
          {!parsed ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium">No file yet</p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-[48ch] text-sm leading-relaxed">
                Drop a CSV above to see its rows here before import. Options like delimiter and
                header row re-parse immediately.
              </p>
              <p className="text-muted-foreground mt-2 font-mono text-[11px]">
                Try pasting a tiny sample:{" "}
                <code className="bg-muted rounded px-1">
                  id,name,amount{"\n"}1,Mira,129.90{"\n"}2,Jonah,89.00
                </code>
              </p>
            </div>
          ) : parsed.headers.length === 0 ? (
            <div className="border-destructive/30 bg-destructive/10 m-3 rounded-md border p-3 text-xs">
              No columns detected — check delimiter and header-row setting.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 text-muted-foreground border-b text-left">
                    {parsed.headers.map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 font-mono text-[11px] font-medium tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {parsed.rows.map((r, i) => (
                    <tr key={i} className="hover:bg-muted/40 font-mono text-[11px]">
                      {parsed.headers.map((_, j) => (
                        <td key={j} className="max-w-[18ch] truncate px-3 py-1.5">
                          {r[j] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.rows.length === 0 && (
                <p className="text-muted-foreground px-3 py-6 text-center text-xs">
                  File has headers but no data rows.
                </p>
              )}
            </div>
          )}
          {parsed && parsed.headers.length > 0 && (
            <div className="border-border bg-muted/20 flex flex-wrap items-center gap-2 border-t px-3 py-2 text-xs">
              <span className="inline-flex items-center gap-1">
                <Table2 className="h-3 w-3" />
                {parsed.headers.length} cols:
              </span>
              <span className="font-mono text-[11px]">{parsed.headers.join(", ")}</span>
              <span className="bg-border hidden h-3 w-px sm:inline-block" />
              <span className="text-muted-foreground">
                All columns imported as <code className="bg-muted rounded px-1">varchar</code> in
                placeholder (type inference deferred).
              </span>
            </div>
          )}
        </div>

        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          Preview: real client-side parsing of the dropped file (hand-rolled,
          delimiter/quote-aware). Import:{" "}
          <code className="bg-muted rounded px-1 py-0.5">POST /api/uploads</code> mutates the
          canonical <code className="bg-muted rounded px-1 py-0.5">seedDatabases</code> in-memory —
          new table then appears in{" "}
          <Link to="/databaseview/list" className="underline-offset-2 hover:underline">
            Database Editor schema list
          </Link>{" "}
          and when creating a{" "}
          <Link to="/tablemodelview/list" className="underline-offset-2 hover:underline">
            Dataset
          </Link>
          . Resets on server restart — placeholder, no persistence.
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
