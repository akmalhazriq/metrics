import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onClose: () => void;
  initial: Record<string, unknown> | null;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

export function TagEditor({ open, onClose, initial, onSave }: Props) {
  const isEdit = !!initial;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!open) return;
    const init = (initial ?? {}) as Record<string, unknown>;
    setForm({
      name: (init.name as string) ?? "",
      type: (init.type as string) ?? "dashboard",
      chartCount: (init.chartCount as number) ?? 0,
      dashboardCount: (init.dashboardCount as number) ?? 0,
    });
  }, [open, initial]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;
  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    const name = String(form.name ?? "").trim();
    if (!name) return;
    const payload = { name, type: String(form.type ?? "").trim() || null };
    setSaving(true);
    try { await onSave(payload); onClose(); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <button aria-label="Close editor" onClick={onClose} className="bg-foreground/20 flex-1 backdrop-blur-sm" />
      <div className="bg-card border-border flex w-full max-w-[480px] flex-col border-l shadow-xl">
        <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight">{isEdit ? "Edit tag" : "Add tag"}</h2>
            <p className="text-muted-foreground mt-1 max-w-[40ch] text-xs leading-relaxed">Tags label dashboards and charts. Names must be unique.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:bg-accent grid h-8 w-8 place-items-center rounded-md"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-5">
            <label className="space-y-1.5"><span className="text-xs font-medium">Name *</span><Input value={String(form.name ?? "")} onChange={(e) => set("name", e.target.value)} placeholder="e.g. finance" /></label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium">Type</span>
              <select value={String(form.type ?? "dashboard")} onChange={(e) => set("type", e.target.value)} className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm">
                <option value="dashboard">dashboard</option>
                <option value="chart">chart</option>
              </select>
            </label>
            {isEdit && (
              <div className="border-border bg-muted/30 rounded-md border px-3 py-2">
                <p className="text-xs font-medium">Usage — read only</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Used on {String(form.chartCount ?? 0)} charts · {String(form.dashboardCount ?? 0)} dashboards
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="border-border flex items-center gap-2 border-t px-5 py-4">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="ml-auto" disabled={saving || !String(form.name ?? "").trim()} onClick={handleSave}>{saving ? "Saving…" : isEdit ? "Save changes" : "Create tag"}</Button>
        </div>
      </div>
    </div>
  );
}
