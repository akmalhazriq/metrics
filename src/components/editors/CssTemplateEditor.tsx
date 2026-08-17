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

export function CssTemplateEditor({ open, onClose, initial, onSave }: Props) {
  const isEdit = !!initial;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!open) return;
    const init = (initial ?? {}) as Record<string, unknown>;
    setForm({
      name: (init.name as string) ?? "",
      description: (init.description as string) ?? "",
      cssCode: (init.cssCode as string) ?? "",
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
    const payload = { name, description: String(form.description ?? "").trim() || null, cssCode: String(form.cssCode ?? "") || null };
    setSaving(true);
    try { await onSave(payload); onClose(); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <button aria-label="Close editor" onClick={onClose} className="bg-foreground/20 flex-1 backdrop-blur-sm" />
      <div className="bg-card border-border flex w-full max-w-[640px] flex-col border-l shadow-xl">
        <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight">{isEdit ? "Edit CSS template" : "Add CSS template"}</h2>
            <p className="text-muted-foreground mt-1 max-w-[44ch] text-xs leading-relaxed">Reusable CSS applied to dashboards from dashboard properties. Keep it to layout and chrome overrides.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:bg-accent grid h-8 w-8 place-items-center rounded-md"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-5">
            <label className="space-y-1.5"><span className="text-xs font-medium">Name *</span><Input value={String(form.name ?? "")} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Dark Minimal" /></label>
            <label className="space-y-1.5"><span className="text-xs font-medium">Description</span><textarea value={String(form.description ?? "")} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="What this template does." className="border-input bg-background w-full rounded-md border px-3 py-2 text-xs" /></label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium">CSS code</span>
              <textarea
                value={String(form.cssCode ?? "")}
                onChange={(e) => set("cssCode", e.target.value)}
                rows={16}
                placeholder={".dashboard { background: oklch(0.18 0.02 260); }\n.dashboard-header { border-bottom: 1px solid var(--border); }"}
                className="border-input w-full rounded-md border bg-[var(--editor,var(--muted))] px-3 py-2 font-mono text-xs leading-relaxed"
              />
              <span className="text-muted-foreground text-[11px]">Uses <code className="bg-muted rounded px-1">--editor</code> tokens (same as SQL Lab). Stored as text.</span>
            </label>
          </div>
        </div>
        <div className="border-border flex items-center gap-2 border-t px-5 py-4">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="ml-auto" disabled={saving || !String(form.name ?? "").trim()} onClick={handleSave}>{saving ? "Saving…" : isEdit ? "Save changes" : "Create template"}</Button>
        </div>
      </div>
    </div>
  );
}
