import { useEffect, useState } from "react";

type HealthResp = { status: "ok"; database: "connected" | "error"; timestamp: string };

export default function HealthPage() {
  const [data, setData] = useState<HealthResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/health").then((r) => r.json() as Promise<HealthResp>).then(setData).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  const ok = data?.database === "connected";
  return (
    <div className="mx-auto max-w-[560px] px-4 py-8 sm:px-6">
      <h1 className="text-[20px] font-semibold tracking-tight">Health</h1>
      <p className="text-muted-foreground mt-1 text-xs">Public — no authentication required. Useful for monitoring.</p>
      <div className="border-border bg-card mt-6 rounded-lg border p-5">
        {error ? <p className="text-destructive text-sm">{error}</p> : !data ? <p className="text-muted-foreground text-sm">Checking…</p> : (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${data.status === "ok" ? "bg-[var(--success)]" : "bg-destructive"}`} /><span className="font-medium">App: {data.status}</span></div>
            <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-[var(--success)]" : "bg-destructive"}`} /><span>Database: {data.database}</span></div>
            <div className="text-muted-foreground font-mono text-xs">{data.timestamp}</div>
          </div>
        )}
      </div>
      <p className="text-muted-foreground mt-3 text-xs">GET <code className="bg-muted rounded px-1 py-0.5">/api/health</code> · DB test is <code className="bg-muted rounded px-1 py-0.5">SELECT 1</code>.</p>
    </div>
  );
}
