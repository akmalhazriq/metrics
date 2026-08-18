import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json() as Promise<{ hasUsers: boolean }>)
      .then((j) => {
        if (!j.hasUsers) navigate("/setup", { replace: true });
      })
      .catch(() => {});
  }, [navigate]);

  useEffect(() => {
    if (!loading && user) navigate("/welcome", { replace: true });
  }, [loading, user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--muted)_0%,_var(--background)_55%)] px-4 py-10">
      <div className="mx-auto w-full max-w-[400px]">
        {/* Brand, same mark family as setup (M plus Metric plus BI), centered for the recurring auth frame */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Link
            to="/health"
            className="focus-visible:ring-ring inline-flex items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="bg-primary text-primary-foreground grid h-8 w-8 place-items-center rounded-md text-[11px] font-bold tracking-widest">
              M
            </span>
            <span className="text-[13px] font-semibold tracking-tight">Metric</span>
            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide">
              BI
            </span>
          </Link>
          <div className="space-y-1.5">
            <h1 className="text-[22px] font-semibold tracking-tight text-balance">
              Sign in to Metric
            </h1>
            <p className="text-muted-foreground mx-auto max-w-[32ch] text-sm leading-relaxed text-pretty">
              Welcome back. Use your workspace account to continue.
            </p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          noValidate
          className="border-border bg-card rounded-xl border shadow-sm"
          aria-describedby={error ? "login-error" : undefined}
        >
          <div className="space-y-4 p-6">
            <label htmlFor="login-username" className="block space-y-1.5">
              <span className="text-xs font-medium tracking-tight">Username</span>
              <div className="relative">
                <User className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75]" />
                <Input
                  id="login-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your username"
                  autoComplete="username"
                  autoFocus
                  aria-invalid={Boolean(error && !username.trim())}
                  className="placeholder:text-muted-foreground/70 focus-visible:ring-ring/50 h-9 pl-8 tracking-tight focus-visible:ring-2"
                />
              </div>
            </label>

            <label htmlFor="login-password" className="block space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium tracking-tight">Password</span>
                <span className="text-muted-foreground text-[11px] tracking-tight tabular-nums">
                  Case-sensitive
                </span>
              </div>
              <div className="relative">
                <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75]" />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-invalid={Boolean(error)}
                  className="placeholder:text-muted-foreground/70 focus-visible:ring-ring/50 h-9 pr-9 pl-8 tracking-tight focus-visible:ring-2"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring absolute top-1/2 right-1 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-3.5 w-3.5 stroke-[1.75]" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 stroke-[1.75]" />
                  )}
                </button>
              </div>
            </label>

            {error && (
              <p
                id="login-error"
                role="alert"
                className="border-destructive/20 bg-destructive/10 text-destructive animate-in fade-in flex items-start gap-2 rounded-md border px-3 py-2 text-xs leading-relaxed duration-150 motion-reduce:animate-none"
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 stroke-[1.75]" />
                <span>{error}</span>
              </p>
            )}

            <Button
              type="submit"
              className="focus-visible:ring-ring h-10 w-full text-sm tracking-tight shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin stroke-[1.75] motion-reduce:animate-none" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>

            <p className="text-muted-foreground text-center text-[11px] leading-relaxed tracking-tight text-pretty">
              First run? Create your admin account from{" "}
              <Link
                to="/setup"
                className="text-primary focus-visible:ring-ring rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                Setup
              </Link>
              .
            </p>
          </div>

          <div className="border-border bg-muted/30 flex items-center justify-between rounded-b-xl border-t px-6 py-3">
            <span className="text-muted-foreground text-[11px] tracking-tight">
              Protected workspace, Postgres plus Drizzle
            </span>
            <span className="flex items-center gap-1.5 text-[11px]">
              <Link
                to="/health"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                Health
              </Link>
              <span className="text-muted-foreground/50">·</span>
              <Link
                to="/about"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                About
              </Link>
            </span>
          </div>
        </form>

        <p className="text-muted-foreground mt-4 px-2 text-center text-[11px] leading-relaxed tracking-tight text-pretty">
          Having trouble? Check{" "}
          <Link to="/health" className="hover:text-foreground underline-offset-4 hover:underline">
            Health
          </Link>{" "}
          or contact your workspace admin. Credentials are managed in{" "}
          <span className="font-medium">Users</span>.
        </p>
      </div>
    </div>
  );
}
