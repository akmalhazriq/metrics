import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Shield, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setStoredToken } from "@/hooks/useAuth";

const ROLES: { id: number; name: string }[] = [
  { id: 1, name: "Admin" },
  { id: 2, name: "Analyst" },
  { id: 3, name: "Viewer" },
];

export default function SetupPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [selected, setSelected] = useState<number[]>([1]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json() as Promise<{ hasUsers: boolean }>)
      .then((j) => {
        if (j.hasUsers) navigate("/login", { replace: true });
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [navigate]);

  const toggleRole = (id: number) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) { setError("Enter your first and last name."); return; }
    if (!username.trim()) { setError("Choose a username."); return; }
    if (!email.includes("@")) { setError("Enter a valid email."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don’t match."); return; }
    if (selected.length === 0) { setError("Pick at least one role."); return; }

    setSubmitting(true);
    try {
      const r = await fetch("/api/setup/initialize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), username: username.trim(), email: email.trim(), password, roleIds: selected }),
      });
      const j = await r.json() as { token?: string; error?: string; message?: string };
      if (!r.ok) throw new Error(j.error ?? j.message ?? "Setup failed");
      setStoredToken(j.token ?? null);
      navigate("/welcome", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top,_var(--muted)_0%,_var(--background)_55%)]">
        <span className="text-muted-foreground inline-flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Checking setup…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--muted)_0%,_var(--background)_55%)] px-4 py-10">
      <div className="mx-auto w-full max-w-[460px]">
        {/* Brand + intro — reads as product first-run, not a generic form */}
        <div className="mb-6">
          <Link to="/health" className="inline-flex items-center gap-2.5">
            <span className="bg-primary text-primary-foreground grid h-8 w-8 place-items-center rounded-md text-[11px] font-bold tracking-widest">M</span>
            <span className="text-[13px] font-semibold tracking-tight">Metric</span>
            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide">BI</span>
          </Link>
          <h1 className="mt-5 text-[22px] font-semibold tracking-tight">Create your admin account</h1>
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
            This is a fresh install — no users exist yet. Create the first admin to get started.
            You’ll be signed in and taken to the sample “Orders Overview” dashboard.
          </p>
        </div>

        <form onSubmit={onSubmit} className="border-border bg-card rounded-xl border shadow-sm">
          <div className="p-6">
            {/* subtle step indicator */}
            <div className="mb-5 flex items-center gap-2">
              <span className="bg-primary text-primary-foreground grid h-6 w-6 place-items-center rounded-full"><Shield className="h-3.5 w-3.5" /></span>
              <span className="text-xs font-medium tracking-wide">Step 1 of 1 — initial setup</span>
              <span className="bg-border ml-auto h-px flex-1" />
              <span className="text-muted-foreground text-[11px]">Runs once</span>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">First name</span>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Admin" autoComplete="given-name" />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Last name</span>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="User" autoComplete="family-name" />
                </label>
              </div>

              <label className="space-y-1.5 block">
                <span className="text-xs font-medium">Username</span>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin_user" autoComplete="username" />
                <span className="text-muted-foreground text-[11px]">Lowercase, no spaces — used to sign in.</span>
              </label>

              <label className="space-y-1.5 block">
                <span className="text-xs font-medium">Email</span>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" autoComplete="email" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Password</span>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Confirm</span>
                  <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" autoComplete="new-password" />
                </label>
              </div>

              <div className="border-border bg-muted/40 rounded-lg border p-3">
                <p className="text-xs font-medium">Role</p>
                <p className="text-muted-foreground mt-0.5 text-[11px]">Admin gets full access. You can add more roles later.</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {ROLES.map((r) => {
                    const on = selected.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggleRole(r.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent"}`}
                      >
                        {on && <Check className="h-3 w-3" />}
                        {r.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && <p className="text-destructive bg-destructive/10 border-destructive/20 rounded-md border px-3 py-2 text-xs">{error}</p>}

              <Button type="submit" className="h-10 w-full text-sm" disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account…</> : "Create admin & continue"}
              </Button>

              <p className="text-muted-foreground text-center text-[11px] leading-relaxed">
                By continuing you create the first user in this workspace.<br />This screen won’t appear again — later users are added from <span className="font-medium">Users</span>.
              </p>
            </div>
          </div>

          <div className="border-border bg-muted/30 flex items-center justify-between rounded-b-xl border-t px-6 py-3">
            <span className="text-muted-foreground text-[11px]">Sample data: 1 dashboard · 2 charts · Analytics / public.orders</span>
            <Link to="/health" className="text-muted-foreground hover:text-foreground text-[11px] hover:underline">Health</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
