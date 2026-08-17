import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ChevronDown, X } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchList, fetchOne, mutate, ApiError } from "@/lib/api";
import type { DatabaseConnection } from "@/types/database";
import type { Dataset } from "@/types/dataset";

export default function DatasetEditAlias() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Dataset | null>(null);
  const [liveDbs, setLiveDbs] = useState<DatabaseConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2200); };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [dsRes, dbRes] = await Promise.all([
          fetchOne<Dataset>(`/api/datasets/${id}`),
          fetchList<DatabaseConnection>("/api/databases", { page: 1, pageSize: 50 }),
        ]);
        if (cancelled) return;
        setEditing(dsRes.data as unknown as Dataset);
        setLiveDbs(dbRes.data);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not load dataset";
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id]);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { showToast("Dataset name is required"); return; }
    setSaving(true);
    try {
      await mutate(`/api/datasets/${editing.id}`, "PUT", {
        name: editing.name,
        databaseId: editing.databaseId,
        schema: editing.schema,
        tableName: editing.table,
        description: editing.description,
      });
      showToast(`Dataset "${editing.name}" saved`);
      navigate("/datasets");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Save failed";
      showToast(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AppShell><div className="mx-auto max-w-[640px] px-6 py-12 text-sm text-muted-foreground">Loading dataset {id}…</div></AppShell>;
  if (error) return <AppShell><div className="mx-auto max-w-[640px] px-6 py-12"><p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p><Link to="/datasets" className="mt-4 inline-flex text-xs underline">Back to datasets</Link></div></AppShell>;
  if (!editing) return <AppShell><div className="mx-auto max-w-[640px] px-6 py-12 text-sm">Not found</div></AppShell>;

  return (
    <AppShell>
      <div className="mx-auto max-w-[720px] px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-[20px] font-semibold tracking-tight">Edit dataset · {editing.name}</h1>
          <Button variant="outline" size="sm" onClick={() => navigate("/datasets")}><X className="mr-1 h-3.5 w-3.5" /> Close</Button>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">Hydrated via <code className="bg-muted rounded px-1">/api/datasets/{id}</code> — live databases from <code className="bg-muted rounded px-1">/api/databases</code></p>

        <div className="border-border bg-card mt-6 rounded-lg border p-5 space-y-4">
          <label className="space-y-1.5 block">
            <span className="text-xs font-medium">Name *</span>
            <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-9 text-sm" />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-xs font-medium">Database *</span>
              <div className="relative">
                <select
                  value={editing.databaseId}
                  onChange={(e) => {
                    const db = liveDbs.find((x) => x.id === e.target.value);
                    if (db) setEditing({ ...editing, databaseId: db.id, databaseName: db.name, backend: db.backend as Dataset["backend"], schema: db.schemas[0]?.name ?? editing.schema, table: db.schemas[0]?.tables[0]?.name ?? editing.table });
                  }}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 pr-8 text-sm"
                >
                  {liveDbs.map((db) => <option key={db.id} value={db.id}>{db.name} · {db.backend}</option>)}
                </select>
                <ChevronDown className="text-muted-foreground absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2" />
              </div>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium">Schema</span>
              <div className="relative">
                <select value={editing.schema ?? "public"} onChange={(e) => setEditing({ ...editing, schema: e.target.value })} className="border-input bg-background h-9 w-full rounded-md border px-3 pr-8 text-sm">
                  {(liveDbs.find((x) => x.id === editing.databaseId)?.schemas ?? []).map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
                <ChevronDown className="text-muted-foreground absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2" />
              </div>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium">Table</span>
              <div className="relative">
                <select value={editing.table ?? ""} onChange={(e) => setEditing({ ...editing, table: e.target.value })} className="border-input bg-background h-9 w-full rounded-md border px-3 pr-8 font-mono text-xs">
                  {(liveDbs.find((x) => x.id === editing.databaseId)?.schemas.find((s) => s.name === editing.schema)?.tables ?? []).map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
                <ChevronDown className="text-muted-foreground absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2" />
              </div>
            </label>
          </div>

          <label className="space-y-1.5 block">
            <span className="text-xs font-medium">Description</span>
            <Input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="h-9 text-sm" />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/datasets")}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </div>
      </div>
      {toast && <div className="border-border bg-card fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border px-3 py-2 text-sm shadow-lg">{toast}</div>}
    </AppShell>
  );
}
