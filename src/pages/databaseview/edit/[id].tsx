import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { X } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchOne, mutate, ApiError } from "@/lib/api";
import type { DatabaseConnection } from "@/types/database";

export default function DatabaseEditAlias() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<DatabaseConnection | null>(null);
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
        const res = await fetchOne<DatabaseConnection>(`/api/databases/${id}`);
        if (cancelled) return;
        setEditing(res.data as unknown as DatabaseConnection);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not load database";
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
    if (!editing.name.trim()) { showToast("Database name is required"); return; }
    if (!editing.sqlalchemyUri.trim()) { showToast("SQLAlchemy URI is required"); return; }
    setSaving(true);
    try {
      await mutate(`/api/databases/${editing.id}`, "PUT", { name: editing.name, sqlalchemyUri: editing.sqlalchemyUri, backend: editing.backend });
      showToast(`Database "${editing.name}" saved`);
      navigate("/databaseview/list");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Save failed";
      showToast(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AppShell><div className="mx-auto max-w-[640px] px-6 py-12 text-sm text-muted-foreground">Loading database {id}…</div></AppShell>;
  if (error) return <AppShell><div className="mx-auto max-w-[640px] px-6 py-12"><p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p><Link to="/databaseview/list" className="mt-4 inline-flex text-xs underline">Back to databases</Link></div></AppShell>;
  if (!editing) return <AppShell><div className="mx-auto max-w-[640px] px-6 py-12 text-sm">Not found</div></AppShell>;

  return (
    <AppShell>
      <div className="mx-auto max-w-[720px] px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-[20px] font-semibold tracking-tight">Edit database · {editing.name}</h1>
          <Button variant="outline" size="sm" onClick={() => navigate("/databaseview/list")}><X className="mr-1 h-3.5 w-3.5" /> Close</Button>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">Hydrated via <code className="bg-muted rounded px-1">/api/databases/{id}</code> — live from Postgres</p>

        <div className="border-border bg-card mt-6 rounded-lg border p-5 space-y-4">
          <label className="space-y-1.5 block">
            <span className="text-xs font-medium">Name *</span>
            <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-9 text-sm" />
          </label>
          <label className="space-y-1.5 block">
            <span className="text-xs font-medium">Backend</span>
            <Input value={editing.backend} onChange={(e) => setEditing({ ...editing, backend: e.target.value as DatabaseConnection["backend"] })} className="h-9 text-sm" />
          </label>
          <label className="space-y-1.5 block">
            <span className="text-xs font-medium">SQLAlchemy URI *</span>
            <Input value={editing.sqlalchemyUri} onChange={(e) => setEditing({ ...editing, sqlalchemyUri: e.target.value })} className="h-9 font-mono text-xs" />
          </label>
          <div className="text-muted-foreground text-xs">Full editor with schemas/tables available at <Link to="/databaseview/list" className="underline">Database List → Edit</Link></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/databaseview/list")}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </div>
      </div>
      {toast && <div className="border-border bg-card fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border px-3 py-2 text-sm shadow-lg">{toast}</div>}
    </AppShell>
  );
}
