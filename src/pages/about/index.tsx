import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/hooks/useAuth";

type AboutInfo = { name: string; version: string; license: string; links: { github: string; docs: string } };

function AboutInner() {
  const [info, setInfo] = useState<AboutInfo | null>(null);
  useEffect(() => { fetch("/api/about").then((r) => r.json() as Promise<AboutInfo>).then(setInfo).catch(() => {}); }, []);
  return (
    <div className="mx-auto max-w-[720px] px-4 py-8 sm:px-6">
      <h1 className="text-[20px] font-semibold tracking-tight">About</h1>
      <p className="text-muted-foreground mt-1 text-sm">Metric — AI-native BI, Superset-parity core with a dense, tool-like chrome.</p>
      <div className="border-border bg-card mt-6 rounded-lg border p-5">
        <dl className="grid gap-3 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">App</dt><dd className="font-medium">{info?.name ?? "Metric BI"}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Version</dt><dd className="font-mono text-xs">{info?.version ?? "—"}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">License</dt><dd className="font-medium">{info?.license ?? "MIT"}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">GitHub</dt><dd><a href={info?.links.github ?? "#"} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs">{info?.links.github ?? "—"}</a></dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Docs</dt><dd><a href={info?.links.docs ?? "#"} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs">{info?.links.docs ?? "—"}</a></dd></div>
        </dl>
      </div>
    </div>
  );
}

export default function AboutPage() {
  return <RequireAuth><AppShell><AboutInner /></AppShell></RequireAuth>;
}
