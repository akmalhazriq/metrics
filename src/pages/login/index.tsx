import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status").then((r) => r.json() as Promise<{ hasUsers: boolean }>)
      .then((j) => { if (!j.hasUsers) navigate("/setup", { replace: true }); })
      .catch(() => {});
  }, [navigate]);

  useEffect(() => {
    if (!loading && user) navigate("/welcome");
  }, [loading, user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError("Enter username and password.");
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
    <div className="bg-muted/30 grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="bg-primary text-primary-foreground grid h-9 w-9 place-items-center rounded-md text-xs font-bold tracking-widest">M</span>
          <h1 className="text-[20px] font-semibold tracking-tight">Sign in to Metric</h1>
          <p className="text-muted-foreground text-xs">Welcome back — sign in with your account.</p>
        </div>
        <form onSubmit={onSubmit} className="border-border bg-card rounded-lg border p-6 shadow-sm">
          <div className="space-y-4">
            <label className="space-y-1.5">
              <span className="text-xs font-medium">Username</span>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your username" autoComplete="username" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium">Password</span>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </label>
            {error && <p className="text-destructive bg-destructive/10 rounded px-2 py-1.5 text-xs">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</Button>
            <p className="text-muted-foreground text-center text-[11px]">First run? Create your admin account from <a href="/setup" className="text-primary hover:underline">Setup</a>.</p>
          </div>
        </form>
        <p className="text-muted-foreground mt-3 text-center text-xs"><a href="/health" className="hover:underline">Health check</a> · <a href="/about" className="hover:underline">About</a></p>
      </div>
    </div>
  );
}
