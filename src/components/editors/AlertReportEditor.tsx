import { useEffect, useMemo, useState } from "react";
import { Clock3, FlaskConical, LayoutDashboard, Mail, Send, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "alert" | "report";

export type EditorInitial = Record<string, unknown> | null;

type Props = {
  mode: Mode;
  open: boolean;
  onClose: () => void;
  initial: EditorInitial;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onTest: (payload: Record<string, unknown>) => void;
};

const TIMEZONES = ["UTC", "America/Los_Angeles", "America/New_York", "Europe/London", "Asia/Singapore"];
const DELIVERY = ["email", "slack", "webhook"] as const;
const VALIDATION = ["not_null", "operator", "value_comparison"] as const;

function humanizeCron(cron: string) {
  const s = cron.trim();
  if (s === "0 9 * * MON") return "Every Monday at 9:00am";
  if (s === "0 8 * * *") return "Daily at 8:00am";
  if (s === "0 7 * * FRI") return "Every Friday at 7:00am";
  if (s === "0 9 * * *") return "Daily at 9:00am";
  if (s === "0 */6 * * *") return "Every 6 hours";
  if (s === "*/30 * * * *") return "Every 30 minutes";
  return s;
}

export function AlertReportEditor({ mode, open, onClose, initial, onSave, onTest }: Props) {
  const isAlert = mode === "alert";
  const [tab, setTab] = useState<"condition" | "schedule" | "content">(isAlert ? "condition" : "schedule");
  const [saving, setSaving] = useState(false);

  // form state — single object so Save always has full payload
  const [form, setForm] = useState<Record<string, unknown>>({});

  // dashboards/charts for Reports content tab
  const [dashOpts, setDashOpts] = useState<{ id: number; title: string }[]>([]);
  const [chartOpts, setChartOpts] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    const init = (initial ?? {}) as Record<string, unknown>;
    setForm({
      name: (init.name as string) ?? "",
      type: (init.type as string) ?? (isAlert ? "Alert" : "Report"),
      trigger: (init.trigger as string) ?? (isAlert ? "Threshold" : ""),
      validationType: (init.validationType as string) ?? (isAlert ? "operator" : ""),
      threshold: (init.threshold as string) ?? "",
      sqlQuery: (init.sqlQuery as string) ?? "",
      schedule: (init.schedule as string) ?? "0 9 * * MON",
      timezone: (init.timezone as string) ?? "UTC",
      deliveryType: (init.deliveryType as string) ?? "email",
      recipients: Array.isArray(init.recipients) ? (init.recipients as string[]).join(", ") : (init.recipients as string) ?? "",
      message: (init.message as string) ?? "",
      logRetentionDays: String((init.logRetentionDays as number) ?? 30),
      dashboardId: init.dashboardId != null ? String(init.dashboardId) : "",
      chartId: init.chartId != null ? String(init.chartId) : "",
      filterValues: init.filterValues ? JSON.stringify(init.filterValues, null, 2) : "",
      active: (init.active as boolean) ?? true,
      status: (init.status as string) ?? "active",
    });
    setTab(isAlert ? "condition" : "schedule");
  }, [open, initial, isAlert]);

  useEffect(() => {
    if (!open || isAlert) return;
    fetch("/api/dashboards?pageSize=50").then((r) => r.json()).then((j: { data: { id: number; title: string }[] }) => setDashOpts(j.data ?? [])).catch(() => {});
    fetch("/api/charts?pageSize=50").then((r) => r.json()).then((j: { data: { id: number; name: string }[] }) => setChartOpts(j.data ?? [])).catch(() => {});
  }, [open, isAlert]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const cronHint = useMemo(() => humanizeCron(String(form.schedule ?? "")), [form.schedule]);

  if (!open) return null;

  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    const name = String(form.name ?? "").trim();
    if (!name) return;
    const payload: Record<string, unknown> = {
      name,
      type: String(form.type ?? (isAlert ? "Alert" : "Report")),
      trigger: String(form.trigger ?? ""),
      schedule: String(form.schedule ?? "").trim() || "0 9 * * MON",
      timezone: String(form.timezone ?? "UTC"),
      deliveryType: String(form.deliveryType ?? "email"),
      recipients: String(form.recipients ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
      message: String(form.message ?? "").trim() || null,
      logRetentionDays: Number(form.logRetentionDays ?? 30) || 30,
      active: !!form.active,
    };
    if (isAlert) {
      payload.validationType = String(form.validationType ?? "").trim() || null;
      payload.threshold = String(form.threshold ?? "").trim() || null;
      payload.sqlQuery = String(form.sqlQuery ?? "").trim() || null;
    } else {
      payload.dashboardId = form.dashboardId ? Number(form.dashboardId) : null;
      payload.chartId = form.chartId ? Number(form.chartId) : null;
      const fv = String(form.filterValues ?? "").trim();
      if (fv) {
        try { payload.filterValues = JSON.parse(fv); } catch { payload.filterValues = fv; }
      } else payload.filterValues = null;
    }
    setSaving(true);
    try { await onSave(payload); onClose(); } finally { setSaving(false); }
  };

  const tabs: { id: typeof tab; label: string; icon: typeof Clock3 }[] = isAlert
    ? [
        { id: "condition", label: "Condition", icon: FlaskConical },
        { id: "schedule", label: "Schedule", icon: Clock3 },
      ]
    : [
        { id: "schedule", label: "Schedule", icon: Clock3 },
        { id: "content", label: "Content", icon: LayoutDashboard },
      ];

  return (
    <div className="fixed inset-0 z-40 flex">
      <button aria-label="Close editor" onClick={onClose} className="bg-foreground/20 flex-1 backdrop-blur-sm" />
      <div className="bg-card border-border flex w-full max-w-[640px] flex-col border-l shadow-xl">
        <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight">
              {initial ? `Edit ${isAlert ? "alert" : "report"}` : `Add ${isAlert ? "alert" : "report"}`}
            </h2>
            <p className="text-muted-foreground mt-1 max-w-[44ch] text-xs leading-relaxed">
              {isAlert ? "SQL check + threshold → notify when the condition is met." : "Pick a dashboard or chart to deliver on a schedule."}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:bg-accent grid h-8 w-8 place-items-center rounded-md">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-border flex gap-1 border-b px-2 py-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-xs font-medium">
            <input type="checkbox" checked={!!form.active} onChange={(e) => set("active", e.target.checked)} className="accent-primary h-3.5 w-3.5" />
            {form.active ? "Enabled" : "Paused"}
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {tab === "condition" && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Validation type</span>
                  <div className="relative">
                    <select value={String(form.validationType ?? "")} onChange={(e) => set("validationType", e.target.value)} className="border-input bg-background h-9 w-full rounded-md border px-3 pr-8 text-sm">
                      <option value="">—</option>
                      {VALIDATION.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <SlidersHorizontal className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2" />
                  </div>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Threshold</span>
                  <Input value={String(form.threshold ?? "")} onChange={(e) => set("threshold", e.target.value)} placeholder="500" />
                </label>
              </div>
              <label className="space-y-1.5">
                <span className="text-xs font-medium">Trigger</span>
                <Input value={String(form.trigger ?? "")} onChange={(e) => set("trigger", e.target.value)} placeholder="Threshold / SQL check" />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium">SQL query</span>
                <textarea value={String(form.sqlQuery ?? "")} onChange={(e) => set("sqlQuery", e.target.value)} rows={6} placeholder="SELECT COUNT(*) FROM orders WHERE updated_at < NOW() - INTERVAL '6 hours'" className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-xs" style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }} />
                <span className="text-muted-foreground text-[11px]">Runs on schedule; rows returned vs threshold decides trigger.</span>
              </label>
            </div>
          )}

          {tab === "schedule" && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Name *</span>
                  <Input value={String(form.name ?? "")} onChange={(e) => set("name", e.target.value)} placeholder={isAlert ? "Revenue drop — last 24h" : "Executive KPI — Weekly"} />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Type</span>
                  <Input value={String(form.type ?? "")} onChange={(e) => set("type", e.target.value)} placeholder={isAlert ? "Alert" : "Report"} />
                </label>
              </div>
              <label className="space-y-1.5">
                <span className="text-xs font-medium">Cron expression *</span>
                <Input value={String(form.schedule ?? "")} onChange={(e) => set("schedule", e.target.value)} placeholder="0 9 * * MON" className="font-mono text-xs" />
                <span className="text-muted-foreground text-[11px]">{cronHint} — e.g. <code className="bg-muted rounded px-1">0 9 * * MON</code> = Every Monday at 9am · <code className="bg-muted rounded px-1">0 */6 * * *</code> = Every 6 hours</span>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Timezone</span>
                  <div className="relative">
                    <select value={String(form.timezone ?? "UTC")} onChange={(e) => set("timezone", e.target.value)} className="border-input bg-background h-9 w-full rounded-md border px-3 pr-8 text-sm">
                      {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                    <Clock3 className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2" />
                  </div>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Delivery</span>
                  <div className="relative">
                    <select value={String(form.deliveryType ?? "email")} onChange={(e) => set("deliveryType", e.target.value)} className="border-input bg-background h-9 w-full rounded-md border px-3 pr-8 text-sm">
                      {DELIVERY.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2" />
                  </div>
                </label>
              </div>
              <label className="space-y-1.5">
                <span className="text-xs font-medium">Recipients — comma separated</span>
                <textarea value={String(form.recipients ?? "")} onChange={(e) => set("recipients", e.target.value)} rows={2} placeholder={String(form.deliveryType) === "slack" ? "#data-alerts, #ops" : String(form.deliveryType) === "webhook" ? "https://hooks.example.com/alert" : "ops@example.com, revops@example.com"} className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-xs" />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium">Message</span>
                <textarea value={String(form.message ?? "")} onChange={(e) => set("message", e.target.value)} rows={2} placeholder="Human-readable context included with the notification." className="border-input bg-background w-full rounded-md border px-3 py-2 text-xs" />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium">Log retention (days)</span>
                <Input type="number" value={String(form.logRetentionDays ?? "30")} onChange={(e) => set("logRetentionDays", e.target.value)} />
              </label>
            </div>
          )}

          {tab === "content" && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Dashboard (optional)</span>
                  <div className="relative">
                    <select value={String(form.dashboardId ?? "")} onChange={(e) => set("dashboardId", e.target.value)} className="border-input bg-background h-9 w-full rounded-md border px-3 pr-8 text-sm">
                      <option value="">— none —</option>
                      {dashOpts.map((d) => <option key={d.id} value={String(d.id)}>{d.title}</option>)}
                    </select>
                    <LayoutDashboard className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2" />
                  </div>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Chart (optional)</span>
                  <div className="relative">
                    <select value={String(form.chartId ?? "")} onChange={(e) => set("chartId", e.target.value)} className="border-input bg-background h-9 w-full rounded-md border px-3 pr-8 text-sm">
                      <option value="">— none —</option>
                      {chartOpts.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                    </select>
                    <SlidersHorizontal className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2" />
                  </div>
                </label>
              </div>
              <p className="text-muted-foreground text-[11px]">Pick a dashboard or a chart. At least one should be set; both is allowed. The export will render that target with the filter values below.</p>
              <label className="space-y-1.5">
                <span className="text-xs font-medium">Filter values (JSON)</span>
                <textarea value={String(form.filterValues ?? "")} onChange={(e) => set("filterValues", e.target.value)} rows={5} placeholder='{"region": "all", "grain": "weekly"}' className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-xs" style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }} />
                <span className="text-muted-foreground text-[11px]">Applied to the dashboard at send time.</span>
              </label>
            </div>
          )}
        </div>

        <div className="border-border flex items-center gap-2 border-t px-5 py-4">
          <Button variant="outline" size="sm" onClick={() => onTest(form)}>
            <Send className="mr-1.5 h-3.5 w-3.5" /> Test
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="ml-auto" disabled={saving || !String(form.name ?? "").trim()} onClick={handleSave}>
            {saving ? "Saving…" : initial ? "Save changes" : `Create ${isAlert ? "alert" : "report"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
