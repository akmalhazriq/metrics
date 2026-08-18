import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  X,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { ApiError, fetchApi, mutate } from "@/lib/api";

type Provider = {
  id: number;
  name: string;
  host: string;
  apiKey: string;
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

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testState, setTestState] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message: string;
    latency?: number;
  }>({ status: "idle", message: "" });

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
            : "We couldn't load AI settings. Try refreshing.";
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
    return () => {
      document.body.style.overflow = "";
    };
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
      apiKey: "",
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
    if (!host) {
      setTestState({ status: "error", message: "Host is required." });
      return;
    }
    const keyForTest = form.apiKey.trim();
    if (!keyForTest && editing?.hasKey) {
      setTestState({
        status: "error",
        message: "Re-enter the API key to test. Stored keys are masked and never returned.",
      });
      return;
    }
    if (!keyForTest) {
      setTestState({ status: "error", message: "API key is required to test." });
      return;
    }
    const model = form.model.trim() || "gpt-4o";
    setTestState({ status: "loading", message: "" });
    try {
      const j = await mutate<{ success: boolean; message: string; latencyMs: number }>(
        "/api/settings/ai/test",
        "POST",
        { host, apiKey: keyForTest, model },
      );
      setTestState({
        status: j.success ? "success" : "error",
        message: j.message,
        latency: j.latencyMs,
      });
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
      if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim();
      else if (!editing) payload.apiKey = "";

      const url = editing ? `/api/settings/ai/${editing.id}` : "/api/settings/ai";
      const method = editing ? ("PUT" as const) : ("POST" as const);
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
      await fetchAll();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
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
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-[22px] font-semibold tracking-tight text-balance">
            <span className="bg-ai-muted border-ai-border grid h-8 w-8 place-items-center rounded-md border">
              <Cpu className="text-ai h-4 w-4 stroke-[1.75]" aria-hidden />
            </span>
            AI Settings
          </h1>
          <p className="text-muted-foreground mt-1.5 max-w-[60ch] text-sm leading-relaxed text-pretty">
            Choose the model that powers plain language to SQL, self healing queries, conversational
            BI, and insight detection. Any OpenAI compatible API works, OpenAI, Groq, Together,
            Ollama, vLLM.
          </p>
        </div>
        <Button
          size="sm"
          onClick={openAdd}
          className="h-8 shrink-0 text-xs tracking-tight shadow-sm focus-visible:ring-2"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5 stroke-[1.75]" aria-hidden /> Add provider
        </Button>
      </div>

      {/* Status */}
      <div className="mt-6">
        {active ? (
          <div className="border-success/20 bg-success/10 flex items-start gap-3 rounded-lg border px-4 py-3">
            <CheckCircle2
              className="text-success mt-0.5 h-4 w-4 shrink-0 stroke-[1.75]"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-medium tracking-tight">
                AI is running with{" "}
                <span className="font-mono text-xs tracking-tight">{active.model}</span> at{" "}
                <span className="font-mono text-xs tracking-tight">{active.host}</span>
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                Provider "{active.name}" is active. You will get{" "}
                <span className="font-medium">real LLM</span>{" "}
                <span className="font-mono text-[11px] tabular-nums">_mock: false</span>. Remove or
                turn it off to go back to mock.
              </p>
            </div>
            <span className="bg-success text-success-foreground ml-auto hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tracking-tight sm:inline">
              Active
            </span>
          </div>
        ) : (
          <div className="border-warning/30 bg-warning/10 flex items-start gap-3 rounded-lg border px-4 py-3">
            <ShieldAlert
              className="text-warning mt-0.5 h-4 w-4 shrink-0 stroke-[1.75]"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-medium tracking-tight">AI is in mock mode</p>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed text-pretty">
                Add a provider and turn it on to get real LLM responses. Mock uses template logic
                plus your real schema, no network calls until you activate something.
              </p>
            </div>
            <span className="bg-warning text-warning-foreground ml-auto hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tracking-tight sm:inline">
              Mock
            </span>
          </div>
        )}
      </div>

      <p className="text-muted-foreground mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 stroke-[1.75]" aria-hidden />
        <span className="text-pretty">
          We store API keys as plain text for now. Encryption at rest is still on the to do list, so
          do not use production secrets here without a rotation plan.
        </span>
      </p>

      {error && (
        <div
          role="alert"
          className="border-destructive/20 bg-destructive/10 text-destructive mt-4 flex items-start gap-2 rounded-md border px-3 py-2.5 text-xs leading-relaxed"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 stroke-[1.75]" aria-hidden />
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="hover:bg-destructive/10 focus-visible:ring-ring grid h-6 w-6 shrink-0 place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <X className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden />
          </button>
        </div>
      )}

      {/* Providers */}
      <div className="mt-6">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold tracking-tight">Providers</h2>
          {!loading && providers.length > 0 && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {providers.length} {providers.length === 1 ? "provider" : "providers"}
            </span>
          )}
        </div>

        {loading ? (
          <div className="mt-3 grid gap-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="border-border bg-card h-[96px] animate-pulse rounded-lg border motion-reduce:animate-none"
                aria-hidden
              />
            ))}
          </div>
        ) : providers.length === 0 ? (
          <div className="border-border bg-card mt-3 rounded-lg border px-6 py-10 text-center shadow-sm">
            <div className="bg-muted mx-auto grid h-10 w-10 place-items-center rounded-full">
              <Cpu className="text-muted-foreground h-5 w-5 stroke-[1.75]" aria-hidden />
            </div>
            <p className="mt-3 text-sm font-semibold tracking-tight">No providers yet</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-[46ch] text-xs leading-relaxed text-pretty">
              Add your first one to get started. For local Ollama, use{" "}
              <code className="bg-muted border-border rounded border px-1 py-0.5 font-mono text-[11px]">
                http://localhost:11434/v1
              </code>{" "}
              with model{" "}
              <code className="bg-muted border-border rounded border px-1 py-0.5 font-mono text-[11px]">
                llama3
              </code>
              .
            </p>
            <Button
              size="sm"
              className="mt-4 h-8 text-xs tracking-tight shadow-sm"
              onClick={openAdd}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5 stroke-[1.75]" aria-hidden /> Add provider
            </Button>
          </div>
        ) : (
          <div className="mt-3 grid gap-3">
            {providers.map((p) => (
              <div
                key={p.id}
                className={`bg-card relative flex flex-col gap-3 rounded-lg border p-4 transition-colors sm:flex-row sm:items-center ${
                  p.isActive
                    ? "border-success/25 bg-success/[0.03] shadow-sm"
                    : "border-border hover:bg-muted/20"
                }`}
              >
                {p.isActive && (
                  <span
                    className="bg-success absolute top-0 left-4 h-1 w-10 -translate-y-px rounded-full"
                    aria-hidden
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold tracking-tight">{p.name}</span>
                    {p.isActive ? (
                      <span className="bg-success text-success-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tracking-tight">
                        <Zap className="h-3 w-3 stroke-[1.75]" aria-hidden /> Active
                      </span>
                    ) : (
                      <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium tracking-tight">
                        Inactive
                      </span>
                    )}
                    <span className="text-muted-foreground font-mono text-[11px] tracking-tight">
                      {p.model}
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] leading-relaxed">
                    <span className="max-w-[32ch] truncate tracking-tight">{p.host}</span>
                    <span className="tabular-nums">{p.hasKey ? p.apiKeyMasked : "no key"}</span>
                    <span className="tabular-nums">
                      t={Number(p.temperature).toFixed(2)} · {p.maxTokens} tokens
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {!p.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleSetActive(p)}
                      className="h-8 px-3 text-xs tracking-tight focus-visible:ring-2"
                    >
                      Set active
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(p)}
                    aria-label={`Edit ${p.name}`}
                    className="h-8 w-8 p-0 focus-visible:ring-2"
                  >
                    <Pencil className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteId(p.id)}
                    aria-label={`Delete ${p.name}`}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0 focus-visible:ring-2"
                  >
                    <Trash2 className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete provider?"
        description="This cannot be undone. If this was the active provider, AI features will fall back to mock until another provider is activated."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => handleDelete(deleteId!)}
      />

      {/* Editor */}
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close editor"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          />
          <div className="bg-card border-border animate-in slide-in-from-right ml-auto flex h-full w-full max-w-[560px] flex-col border-l shadow-xl duration-200 motion-reduce:animate-none">
            <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold tracking-tight">
                  {editing ? "Edit provider" : "Add provider"}
                </h2>
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed text-pretty">
                  OpenAI compatible. Keys stay server side, never exposed as{" "}
                  <code className="font-mono text-[11px]">VITE_*</code>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close editor"
                className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <X className="h-4 w-4 stroke-[1.75]" aria-hidden />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor="ai-name" className="text-xs font-medium tracking-tight">
                    Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="ai-name"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="OpenAI Production or Local Ollama"
                    autoComplete="off"
                    className="placeholder:text-muted-foreground/70 h-9 tracking-tight focus-visible:ring-2"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="ai-host" className="text-xs font-medium tracking-tight">
                    Host <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="ai-host"
                    value={form.host}
                    onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))}
                    placeholder="https://api.openai.com/v1"
                    autoComplete="off"
                    spellCheck={false}
                    className="placeholder:text-muted-foreground/70 h-9 font-mono text-xs tracking-tight focus-visible:ring-2"
                  />
                  <p className="text-muted-foreground text-[11px] leading-relaxed text-pretty">
                    Any OpenAI compatible API, OpenAI, Together, Groq, Ollama (
                    <code className="bg-muted border-border rounded border px-1 py-0.5 font-mono text-[11px]">
                      http://localhost:11434/v1
                    </code>
                    ), vLLM.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="ai-key" className="text-xs font-medium tracking-tight">
                    API key{" "}
                    {editing?.hasKey && (
                      <span className="text-muted-foreground font-normal">
                        , leave blank to keep current
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <Input
                      id="ai-key"
                      type={showKey ? "text" : "password"}
                      value={form.apiKey}
                      onChange={(e) => setForm((p) => ({ ...p, apiKey: e.target.value }))}
                      placeholder={
                        editing?.hasKey ? "••••••••••••abcd, re-enter to change" : "sk-..."
                      }
                      autoComplete="off"
                      spellCheck={false}
                      className="placeholder:text-muted-foreground/70 h-9 pr-9 font-mono text-xs tracking-tight focus-visible:ring-2"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      aria-label={showKey ? "Hide API key" : "Show API key"}
                      aria-pressed={showKey}
                      className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring absolute top-1/2 right-1 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {showKey ? (
                        <EyeOff className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden />
                      ) : (
                        <Eye className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden />
                      )}
                    </button>
                  </div>
                  {form.apiKey ? (
                    <span className="text-muted-foreground block font-mono text-[11px] tabular-nums">
                      {maskPreview(form.apiKey)}
                    </span>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="ai-model" className="text-xs font-medium tracking-tight">
                    Model <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="ai-model"
                    value={form.model}
                    onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
                    placeholder="gpt-4o"
                    autoComplete="off"
                    spellCheck={false}
                    className="placeholder:text-muted-foreground/70 h-9 font-mono text-xs tracking-tight focus-visible:ring-2"
                  />
                  <p className="text-muted-foreground text-[11px] leading-relaxed text-pretty">
                    Must exist at the host, for example{" "}
                    <code className="bg-muted border-border rounded border px-1 py-0.5 font-mono text-[11px]">
                      gpt-4o
                    </code>
                    ,{" "}
                    <code className="bg-muted border-border rounded border px-1 py-0.5 font-mono text-[11px]">
                      gpt-4o-mini
                    </code>
                    ,{" "}
                    <code className="bg-muted border-border rounded border px-1 py-0.5 font-mono text-[11px]">
                      llama3
                    </code>
                    ,{" "}
                    <code className="bg-muted border-border rounded border px-1 py-0.5 font-mono text-[11px]">
                      mixtral-8x7b
                    </code>
                    .
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="ai-temp" className="text-xs font-medium tracking-tight">
                      Temperature
                    </label>
                    <Input
                      id="ai-temp"
                      type="number"
                      inputMode="decimal"
                      step="0.05"
                      min={0}
                      max={2}
                      value={form.temperature}
                      onChange={(e) => setForm((p) => ({ ...p, temperature: e.target.value }))}
                      className="h-9 font-mono text-xs tabular-nums focus-visible:ring-2"
                    />
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      0–2. Lower is deterministic. 0.1–0.3 for SQL.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="ai-tokens" className="text-xs font-medium tracking-tight">
                      Max tokens
                    </label>
                    <Input
                      id="ai-tokens"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={128000}
                      value={form.maxTokens}
                      onChange={(e) => setForm((p) => ({ ...p, maxTokens: e.target.value }))}
                      className="h-9 font-mono text-xs tabular-nums focus-visible:ring-2"
                    />
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Default 4096.
                    </p>
                  </div>
                </div>

                <label
                  htmlFor="ai-active"
                  className="has-[input:focus-visible]:ring-ring flex cursor-pointer items-start gap-2.5 rounded-md border border-transparent px-1 py-1 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-offset-2"
                >
                  <Checkbox
                    id="ai-active"
                    checked={form.isActive}
                    onChange={(e) => setForm((p) => ({ ...p, isActive: e.currentTarget.checked }))}
                  />
                  <span className="min-w-0 text-xs leading-relaxed">
                    <span className="font-medium tracking-tight">Active</span>
                    <span className="text-muted-foreground">
                      , use this provider for all AI features. Only one can be active at a time.
                    </span>
                  </span>
                </label>

                <div className="border-border bg-muted/30 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleTest}
                      disabled={testState.status === "loading"}
                      className="border-ai-border bg-ai-muted/30 hover:bg-ai-muted/50 h-8 text-xs tracking-tight focus-visible:ring-2"
                    >
                      {testState.status === "loading" ? (
                        <>
                          <Loader2
                            className="mr-1.5 h-3.5 w-3.5 animate-spin stroke-[1.75] motion-reduce:animate-none"
                            aria-hidden
                          />
                          Testing…
                        </>
                      ) : (
                        <>
                          <Zap className="mr-1.5 h-3.5 w-3.5 stroke-[1.75]" aria-hidden /> Test
                          connection
                        </>
                      )}
                    </Button>
                    <span className="text-muted-foreground text-[11px] leading-relaxed text-pretty">
                      Sends one "Say connected" request. Does not save.
                    </span>
                  </div>
                  {testState.status !== "idle" && (
                    <div
                      role="status"
                      className={`mt-2.5 rounded-md border px-3 py-2 text-xs leading-relaxed ${
                        testState.status === "success"
                          ? "border-success/20 bg-success/10 text-foreground"
                          : testState.status === "error"
                            ? "border-destructive/20 bg-destructive/10 text-destructive"
                            : "border-ai-border bg-ai-muted/30 text-foreground"
                      }`}
                    >
                      <span className="font-medium tracking-tight">
                        {testState.status === "success"
                          ? "Connected"
                          : testState.status === "error"
                            ? "Failed"
                            : "…"}
                      </span>
                      {testState.latency != null && (
                        <span className="text-muted-foreground ml-2 font-mono text-[11px] tabular-nums">
                          · {testState.latency}ms
                        </span>
                      )}
                      <span className="ml-2 break-words">{testState.message}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-border flex items-center gap-2 border-t px-5 py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-9 px-4 text-xs tracking-tight focus-visible:ring-2"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="ml-auto h-9 min-w-[132px] px-4 text-xs tracking-tight shadow-sm focus-visible:ring-2 disabled:opacity-50"
                disabled={saving || !form.name.trim() || !form.host.trim() || !form.model.trim()}
                onClick={handleSave}
              >
                {saving ? (
                  <>
                    <Loader2
                      className="mr-1.5 h-3.5 w-3.5 animate-spin stroke-[1.75] motion-reduce:animate-none"
                      aria-hidden
                    />
                    Saving…
                  </>
                ) : editing ? (
                  "Save changes"
                ) : (
                  "Create provider"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
