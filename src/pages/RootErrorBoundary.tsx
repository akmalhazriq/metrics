import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error: Error | null };

export default class RootErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[RootErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message ?? "An unexpected error occurred.";
      const truncated = msg.length > 240 ? `${msg.slice(0, 240)}…` : msg;
      return (
        <div className="bg-muted/30 grid min-h-screen place-items-center p-6">
          <div className="bg-card border-border w-full max-w-[480px] rounded-lg border p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="bg-destructive/10 text-destructive grid h-9 w-9 shrink-0 place-items-center rounded-md">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="text-base font-semibold tracking-tight">Something went wrong</h1>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  The page failed to render. This is usually a temporary issue — try reloading.
                </p>
                <p className="bg-muted border-border mt-3 rounded-md border px-3 py-2 font-mono text-[11px] leading-relaxed break-words">
                  {truncated}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => window.location.reload()}>
                    Reload page
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/dashboard/list">Go to dashboard</a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
