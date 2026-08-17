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

export function AnnotationEditor({ open, onClose, initial, onSave }: Props) {
  const isEdit = !!initial;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [metaError, setMetaError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const init = (initial ?? {}) as Record<string, unknown>;
    let metaText = "";
    if (init.jsonMetadata != null) {
      try { metaText = JSON.stringify(init.jsonMetadata, null, 2); } catch { metaText = String(init.jsonMetadata); }
    }
    setForm({
      name: (init.name as string) ?? "",
      description: (init.description as string) ?? "",
      annotationType: (init.annotationType as string) ?? "event",
      startField: (init.startField as string) ?? "",
      endField: (init.endField as string) ?? "",
      jsonMetadataText: metaText,
    });
    setMetaError(null);
  }, [open, initial]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;
  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));
  const t = String(form.annotationType ?? "event");
  const showStart = t === "interval" || t === "event";
  const showEnd = t === "interval";
  const showMetaHint = true;

  const handleSave = async () => {
    const name = String(form.name ?? "").trim();
    if (!name) return;
    let jsonMetadata: unknown = null;
    const raw = String(form.jsonMetadataText ?? "").trim();
    if (raw) {
      try { jsonMetadata = JSON.parse(raw); setMetaError(null); } catch (e) { setMetaError(e instanceof Error ? e.message : "Invalid JSON"); return; }
    }
    const payload: Record<string, unknown> = {
      name,
      description: String(form.description ?? "").trim() || null,
      annotationType: t,
      startField: showStart ? (String(form.startField ?? "").trim() || null) : null,
      endField: showEnd ? (String(form.endField ?? "").trim() || null) : null,
      jsonMetadata,
    };
    setSaving(true);
    try { await onSave(payload); onClose(); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <button aria-label="Close editor" onClick={onClose} className="bg-foreground/20 flex-1 backdrop-blur-sm" />
      <div className="bg-card border-border flex w-full max-w-[640px] flex-col border-l shadow-xl">
        <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight">{isEdit ? "Edit annotation layer" : "Add annotation layer"}</h2>
            <p className="text-muted-foreground mt-1 max-w-[44ch] text-xs leading-relaxed">Mark events and intervals on charts — releases, outages, targets.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:bg-accent grid h-8 w-8 place-items-center rounded-md"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-5">
            <label className="space-y-1.5"><span className="text-xs font-medium">Name *</span><Input value={String(form.name ?? "")} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Product Launches" /></label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium">Description</span>
              <textarea value={String(form.description ?? "")} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="What this layer marks." className="border-input bg-background w-full rounded-md border px-3 py-2 text-xs" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium">Annotation type</span>
              <select value={t} onChange={(e) => set("annotationType", e.target.value)} className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm">
                <option value="time series">time series</option>
                <option value="interval">interval</option>
                <option value="event">event</option>
              </select>
            </label>
            {showStart && <label className="space-y-1.5"><span className="text-xs font-medium">Start field {t === "event" ? "*" : ""}</span><Input value={String(form.startField ?? "")} onChange={(e) => set("startField", e.target.value)} placeholder="e.g. launch_start" /></label>}
            {showEnd && <label className="space-y-1.5"><span className="text-xs font-medium">End field</span><Input value={String(form.endField ?? "")} onChange={(e) => set("endField", e.target.value)} placeholder="e.g. launch_end" /></label>}
            {!showStart && !showEnd && <p className="text-muted-foreground text-xs">Time-series layers don&apos;t require start/end fields — they interpolate over the dataset&apos;s time grain.</p>}
            <label className="space-y-1.5">
              <span className="text-xs font-medium">JSON metadata <span className="text-muted-foreground font-normal">(optional — e.g. color)</span></span>
              <textarea value={String(form.jsonMetadataText ?? "")} onChange={(e) => set("jsonMetadataText", e.target.value)} rows={5} placeholder='{"color":"var(--chart-2)"}' className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-xs" />
              {showMetaHint && <span className="text-muted-foreground text-[11px]">Must be valid JSON. Stored as jsonb.</span>}
              {metaError && <span className="text-destructive text-xs">{metaError}</span>}
            </label>
          </div>
        </div>
        <div className="border-border flex items-center gap-2 border-t px-5 py-4">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="ml-auto" disabled={saving || !String(form.name ?? "").trim()} onClick={handleSave}>{saving ? "Saving…" : isEdit ? "Save changes" : "Create layer"}</Button>
        </div>
      </div>
    </div>
  );
}
