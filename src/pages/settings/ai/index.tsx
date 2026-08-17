import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Cpu, Eye, EyeOff, Loader2, Pencil, Plus, ShieldAlert, Trash2, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, fetchApi, mutate } from "@/lib/api";

type Provider = {
  id: number;
  name: string;
  host: string;
  apiKey: string; // masked
  apiKeyMasked: string;
  hasKey: boolean;
  model: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  createdAt: string;
  modifiedAt: string;
};

type FormState = {
  name: string;
  host: string;
  apiKey: string;
  model: string;
  temperature: string;
  maxTokens: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  host: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o",
  temperature: "0.20",
  maxTokens: "4096",
  isActive: true,
};

function maskPreview(v: string): string {
  if (!v) return "";
  const t = v.trim();
  if (t.length <= 4) return "sk-...****";
  return `sk-...${t.slice(-4)}`;
}

export default function AiSettingsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // editor
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testState, setTestState] = useState<{ status: "idle" | "loading" | "success" | "error"; message: string; latency?: number }>({ status: "idle", message: "" });

  // delete confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApi<{ data: Provider[] }>("/api/settings/ai");
      setProviders(res.data ?? []);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not load AI settings";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
  }, []);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const active = providers.find((p) => p.isActive) ?? null;

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowKey(false);
    setTestState({ status: "idle", message: "" });
    setOpen(true);
  };
  const openEdit = (p: Provider) => {
    setEditing(p);
    setForm({
      name: p.name,
      host: p.host,
      apiKey: "", // never prefill full key — user re-enters if changing
      model: p.model,
      temperature: String(p.temperature),
      maxTokens: String(p.maxTokens),
      isActive: p.isActive,
    });
    setShowKey(false);
    setTestState({ status: "idle", message: "" });
    setOpen(true);
  };

  const handleTest = async () => {
    const host = form.host.trim();
    // If editing and apiKey empty but hasKey true, we need to tell user to re-enter — test needs a real key
    if (!host) { setTestState({ status: "error", message: "Host is required." }); return; }
    const keyForTest = form.apiKey.trim();
    if (!keyForTest && editing?.hasKey) {
      setTestState({ status: "error", message: "Re-enter the API key to test — stored keys are masked and never returned." });
      return;
    }
    if (!keyForTest) { setTestState({ status: "error", message: "API key is required to test." }); return; }
    const model = form.model.trim() || "gpt-4o";
    setTestState({ status: "loading", message: "" });
    try {
      const j = await mutate<{ success: boolean; message: string; latencyMs: number }>(
        "/api/settings/ai/test",
        "POST",
        { host, apiKey: keyForTest, model },
      );
      setTestState({ status: j.success ? "success" : "error", message: j.message, latency: j.latencyMs });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
      setTestState({ status: "error", message: msg });
    }
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const host = form.host.trim();
    const model = form.model.trim();
    if (!name || !host || !model) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name,
        host,
        model,
        temperature: Number(form.temperature) || 0.2,
        maxTokens: Number(form.maxTokens) || 4096,
        isActive: form.isActive,
      };
      // Only send apiKey if user typed it — otherwise keep existing (edit) or empty (create)
      if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim();
      else if (!editing) payload.apiKey = "";

      const url = editing ? `/api/settings/ai/${editing.id}` : "/api/settings/ai";
      const method = editing ? "PUT" as const : "POST" as const;
      await mutate(url, method, payload);
      setOpen(false);
      await fetchAll();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
      setTestState({ status: "error", message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await mutate(`/api/settings/ai/${id}`, "DELETE");
      setDeleteId(null);
      await fetchAll();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
      setError(msg);
    }
  };

  const handleSetActive = async (p: Provider) => {
    try {
      await mutate(`/api/settings/ai/${p.id}`, "PUT", { isActive: true });
      await fetchAll();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
      setError(msg);
    }
  };

  return (
    <div className="mx-auto max-w-[960px] px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] font-semibold tracking-tight">
            <span className="bg-ai-muted border-ai-border grid h-8 w-8 place-items-center rounded-md border">
              <Cpu className="text-ai h-4 w-4" />
            </span>
            AI Settings
          </h1>
          <p className="text-muted-foreground mt-1 max-w-[60ch] text-sm leading-relaxed">
            Configure the language model that powers NL2SQL, self-healing queries, conversational BI, and insight detection.
            Any OpenAI-compatible API works — OpenAI, Anthropic (via compat), Together, Groq, Ollama, vLLM.
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-1.5 h-4 w-4" /> Add provider
        </Button>
      </div>

      {/* Status banner */}
      <div className="mt-6">
        {active ? (
          <div className="border-success/30 bg-success/10 flex items-start gap-3 rounded-lg border px-4 py-3">
            <CheckCircle2 className="text-success mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">AI features are using <span className="font-mono text-xs">{active.model}</span> at <span className="font-mono text-xs">{active.host}</span></p>
              <p className="text-muted-foreground mt-0.5 text-xs">Provider “{active.name}” is active. Responses will be <span className="font-medium">real LLM</span> (<span className="font-mono">_mock: false</span>). Remove or deactivate to fall back to mock.</p>
            </div>
            <span className="bg-success text-success-foreground ml-auto hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline">Active</span>
          </div>
        ) : (
          <div className="border-warning/40 bg-warning/10 flex items-start gap-3 rounded-lg border px-4 py-3">
            <ShieldAlert className="text-warning mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">AI features are running in mock mode.</p>
              <p className="text-muted-foreground mt-0.5 text-xs">Configure and activate a provider to enable real LLM responses. Mock uses template logic + real schema — no network calls.</p>
            </div>
            <span className="bg-warning text-warning-foreground ml-auto hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline">Mock</span>
          </div>
        )}
      </div>

      {/* Known gap notice */}
      <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-[11px]">
        <AlertTriangle className="h-3 w-3" /> API keys are stored as plaintext for now — encryption at rest is a known gap. Do not use production secrets without rotation.
      </p>

      {/* Error */}
      {error && (
        <div className="border-destructive/30 bg-destructive/10 mt-4 rounded-md border px-3 py-2 text-xs text-destructive">
          {error} <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Provider list */}
      <div className="mt-6">
        <h2 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Providers</h2>
        {loading ? (
          <div className="mt-3 grid gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="border-border bg-card h-[96px] animate-pulse rounded-lg border" />
            ))}
          </div>
        ) : providers.length === 0 ? (
          <div className="border-border bg-card mt-3 rounded-lg border px-6 py-10 text-center">
            <div className="bg-muted mx-auto grid h-10 w-10 place-items-center rounded-full">
              <Cpu className="text-muted-foreground h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-medium">No providers yet</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-[40ch] text-xs">Add an OpenAI-compatible endpoint. For local Ollama: <code className="bg-muted rounded px-1 font-mono text-[11px]">http://localhost:11434/v1</code> with model <code className="bg-muted rounded px-1 font-mono text-[11px]">llama3</code>.</p>
            <Button size="sm" className="mt-4" onClick={openAdd}><Plus className="mr-1.5 h-4 w-4" /> Add provider</Button>
          </div>
        ) : (
          <div className="mt-3 grid gap-3">
            {providers.map((p) => (
              <div key={p.id} className={`bg-card relative flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center ${p.isActive ? "border-success/40 shadow-sm" : "border-border"}`}>
                {p.isActive && <span className="bg-success absolute top-0 left-4 h-1 w-10 -translate-y-[1px] rounded-full" aria-hidden />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{p.name}</span>
                    {p.isActive ? (
                      <span className="bg-success text-success-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
                        <Zap className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">Inactive</span>
                    )}
                    <span className="text-muted-foreground font-mono text-[11px]">{p.model}</span>
                  </div>
                  <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
                    <span className="truncate">{p.host}</span>
                    <span>{p.hasKey ? p.apiKeyMasked : "no key"}</span>
                    <span>t={Number(p.temperature).toFixed(2)} · {p.maxTokens} tokens</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {!p.isActive && (
                    <Button variant="outline" size="sm" onClick={() => void handleSetActive(p)} className="h-8 text-xs">
                      Set active
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)} className="h-8 w-8 p-0">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDeleteId(p.id)} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-foreground/20 p-4 backdrop-blur-sm">
          <div className="bg-card border-border w-full max-w-sm rounded-lg border p-5 shadow-xl">
            <h3 className="text-sm font-semibold">Delete provider?</h3>
            <p className="text-muted-foreground mt-1 text-xs">This cannot be undone. If this was the active provider, AI features will fall back to mock.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={() => void handleDelete(deleteId!)}>Delete</Button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over editor */}
      {open && (
        <div className="fixed inset-0 z-40 flex">
          <button aria-label="Close editor" onClick={() => setOpen(false)} className="flex-1 bg-foreground/20 backdrop-blur-sm" />
          <div className="bg-card border-border flex w-full max-w-[560px] flex-col border-l shadow-xl">
            <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
              <div>
                <h2 className="text-[16px] font-semibold tracking-tight">{editing ? "Edit provider" : "Add provider"}</h2>
                <p className="text-muted-foreground mt-0.5 text-xs">OpenAI-compatible. Keys stay server-side — never exposed as VITE_*.</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:bg-accent grid h-8 w-8 place-items-center rounded-md">
                <Plus className="h-4 w-4 rotate-45" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="space-y-4">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Name *</span>
                  <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder='OpenAI Production or Local Ollama' />
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Host *</span>
                  <Input value={form.host} onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))} placeholder="https://api.openai.com/v1" className="font-mono text-xs" />
                  <span className="text-muted-foreground text-[11px]">Any OpenAI-compatible API — OpenAI, Together, Groq, Ollama (<code className="bg-muted rounded px-1">http://localhost:11434/v1</code>), vLLM.</span>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-medium">API Key {editing && editing.hasKey ? "(leave blank to keep current)" : ""}</span>
                  <div className="relative">
                    <Input
                      type={showKey ? "text" : "password"}
                      value={form.apiKey}
                      onChange={(e) => setForm((p) => ({ ...p, apiKey: e.target.value }))}
                      placeholder={editing?.hasKey ? "••••••••••••abcd (re-enter to change)" : "sk-..."}
                      className="pr-9 font-mono text-xs"
                    />
                    <button type="button" onClick={() => setShowKey((v) => !v)} className="text-muted-foreground absolute top-1/2 right-2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded">
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {form.apiKey ? <span className="text-muted-foreground font-mono text-[11px]">{maskPreview(form.apiKey)}</span> : null}
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Model *</span>
                  <Input value={form.model} onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))} placeholder="gpt-4o" className="font-mono text-xs" />
                  <span className="text-muted-foreground text-[11px]">e.g. <code className="bg-muted rounded px-1">gpt-4o</code>, <code className="bg-muted rounded px-1">gpt-4o-mini</code>, <code className="bg-muted rounded px-1">llama3</code>, <code className="bg-muted rounded px-1">mixtral-8x7b</code>. Must exist at the host.</span>
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium">Temperature</span>
                    <Input type="number" step="0.05" min={0} max={2} value={form.temperature} onChange={(e) => setForm((p) => ({ ...p, temperature: e.target.value }))} />
                    <span className="text-muted-foreground text-[11px]">0–2. Lower = deterministic. 0.1–0.3 for SQL.</span>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium">Max tokens</span>
                    <Input type="number" min={1} max={128000} value={form.maxTokens} onChange={(e) => setForm((p) => ({ ...p, maxTokens: e.target.value }))} />
                    <span className="text-muted-foreground text-[11px]">Default 4096.</span>
                  </label>
                </div>

                <label className="flex items-center gap-2 text-xs font-medium">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} className="accent-primary h-3.5 w-3.5" />
                  Active — use this provider for all AI features (only one active at a time)
                </label>

                {/* Test connection */}
                <div className="border-border bg-muted/30 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleTest} disabled={testState.status === "loading"} className="border-ai-border bg-ai-muted/30 text-xs">
                      {testState.status === "loading" ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Testing…</> : <><Zap className="mr-1.5 h-3.5 w-3.5" /> Test connection</>}
                    </Button>
                    <span className="text-muted-foreground text-[11px]">Sends one “Say connected” request — does not save.</span>
                  </div>
                  {testState.status !== "idle" && (
                    <div className={`mt-2 rounded-md border px-3 py-2 text-xs ${testState.status === "success" ? "border-success/30 bg-success/10 text-success" : testState.status === "error" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-ai-border bg-ai-muted/30"}`}>
                      <span className="font-medium">{testState.status === "success" ? "Connected" : testState.status === "error" ? "Failed" : "…"}</span>
                      {testState.latency != null ? <span className="ml-2 font-mono text-[11px]">· {testState.latency}ms</span> : null}
                      <span className="ml-2">{testState.message}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-border flex items-center gap-2 border-t px-5 py-4">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" className="ml-auto" disabled={saving || !form.name.trim() || !form.host.trim() || !form.model.trim()} onClick={handleSave}>
                {saving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving…</> : editing ? "Save changes" : "Create provider"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
