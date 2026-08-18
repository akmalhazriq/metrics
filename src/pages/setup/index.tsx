import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AlertCircle, Check, Eye, EyeOff, Loader2, Lock, Mail, Shield, User } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError("Enter your first and last name.");
      return;
    }
    if (!username.trim()) {
      setError("Choose a username.");
      return;
    }
    if (!email.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (selected.length === 0) {
      setError("Pick at least one role.");
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch("/api/setup/initialize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          username: username.trim(),
          email: email.trim(),
          password,
          roleIds: selected,
        }),
      });
      const j = (await r.json()) as { token?: string; error?: string; message?: string };
      if (!r.ok) throw new Error(j.error ?? j.message ?? "Setup failed");
      setStoredToken(j.token ?? null);
      try {
        localStorage.setItem("setup_complete_seen", "0");
      } catch {
        /* ignore storage */
      }
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
        <span className="text-muted-foreground inline-flex items-center gap-2 text-sm tracking-tight">
          <Loader2 className="h-4 w-4 animate-spin stroke-[1.75] motion-reduce:animate-none" />{" "}
          Checking setup…
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--muted)_0%,_var(--background)_55%)] px-4 py-10">
      <div className="mx-auto w-full max-w-[460px]">
        {/* Brand plus intro, same mark family as login, left aligned for the one time ceremony */}
        <div className="mb-6">
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
          <h1 className="mt-5 text-[22px] font-semibold tracking-tight text-balance">
            Let&apos;s get you set up
          </h1>
          <p className="text-muted-foreground mt-1.5 max-w-[42ch] text-sm leading-relaxed text-pretty">
            This is a fresh install, no users exist yet. Create the first admin to get started. You
            will be signed in and taken to the sample "Orders Overview" dashboard. This only takes a
            minute.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          noValidate
          className="border-border bg-card rounded-xl border shadow-sm"
          aria-describedby={error ? "setup-error" : undefined}
        >
          <div className="p-6">
            {/* subtle step indicator */}
            <div className="mb-5 flex items-center gap-2">
              <span className="bg-primary text-primary-foreground grid h-6 w-6 place-items-center rounded-full">
                <Shield className="h-3.5 w-3.5 stroke-[1.75]" />
              </span>
              <span className="text-xs font-medium tracking-tight">Step 1 of 1, initial setup</span>
              <span className="bg-border ml-auto h-px flex-1" />
              <span className="text-muted-foreground text-[11px] tracking-tight tabular-nums">
                Runs once
              </span>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label htmlFor="setup-first" className="block space-y-1.5">
                  <span className="text-xs font-medium tracking-tight">First name</span>
                  <div className="relative">
                    <User className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75]" />
                    <Input
                      id="setup-first"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Admin"
                      autoComplete="given-name"
                      autoFocus
                      className="placeholder:text-muted-foreground/70 focus-visible:ring-ring/50 h-9 pl-8 tracking-tight focus-visible:ring-2"
                    />
                  </div>
                </label>
                <label htmlFor="setup-last" className="block space-y-1.5">
                  <span className="text-xs font-medium tracking-tight">Last name</span>
                  <div className="relative">
                    <User className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75]" />
                    <Input
                      id="setup-last"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="User"
                      autoComplete="family-name"
                      className="placeholder:text-muted-foreground/70 focus-visible:ring-ring/50 h-9 pl-8 tracking-tight focus-visible:ring-2"
                    />
                  </div>
                </label>
              </div>

              <label htmlFor="setup-username" className="block space-y-1.5">
                <span className="text-xs font-medium tracking-tight">Username</span>
                <div className="relative">
                  <User className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75]" />
                  <Input
                    id="setup-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin_user"
                    autoComplete="username"
                    className="placeholder:text-muted-foreground/70 focus-visible:ring-ring/50 h-9 pl-8 tracking-tight focus-visible:ring-2"
                    aria-describedby="setup-username-hint"
                  />
                </div>
                <span
                  id="setup-username-hint"
                  className="text-muted-foreground block text-[11px] leading-relaxed tracking-tight"
                >
                  Lowercase, no spaces. You use this to sign in.
                </span>
              </label>

              <label htmlFor="setup-email" className="block space-y-1.5">
                <span className="text-xs font-medium tracking-tight">Email</span>
                <div className="relative">
                  <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75]" />
                  <Input
                    id="setup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    autoComplete="email"
                    className="placeholder:text-muted-foreground/70 focus-visible:ring-ring/50 h-9 pl-8 tracking-tight focus-visible:ring-2"
                  />
                </div>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label htmlFor="setup-password" className="block space-y-1.5">
                  <span className="text-xs font-medium tracking-tight">Password</span>
                  <div className="relative">
                    <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75]" />
                    <Input
                      id="setup-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
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
                <label htmlFor="setup-confirm" className="block space-y-1.5">
                  <span className="text-xs font-medium tracking-tight">Confirm</span>
                  <div className="relative">
                    <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75]" />
                    <Input
                      id="setup-confirm"
                      type={showConfirm ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repeat password"
                      autoComplete="new-password"
                      className="placeholder:text-muted-foreground/70 focus-visible:ring-ring/50 h-9 pr-9 pl-8 tracking-tight focus-visible:ring-2"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                      aria-pressed={showConfirm}
                      className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring absolute top-1/2 right-1 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {showConfirm ? (
                        <EyeOff className="h-3.5 w-3.5 stroke-[1.75]" />
                      ) : (
                        <Eye className="h-3.5 w-3.5 stroke-[1.75]" />
                      )}
                    </button>
                  </div>
                </label>
              </div>

              <div className="border-border bg-muted/40 rounded-lg border p-3">
                <p className="text-xs font-medium tracking-tight">Role</p>
                <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed tracking-tight text-pretty">
                  Admin gets full access. You can add more roles later.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {ROLES.map((r) => {
                    const on = selected.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggleRole(r.id)}
                        aria-pressed={on}
                        className={`focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium tracking-tight transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${on ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card border-border hover:bg-accent hover:text-accent-foreground"}`}
                      >
                        {on && <Check className="h-3 w-3 stroke-[1.75]" />}
                        {r.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <p
                  id="setup-error"
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin stroke-[1.75] motion-reduce:animate-none" />{" "}
                    Creating account…
                  </>
                ) : (
                  "Create admin & continue"
                )}
              </Button>

              <p className="text-muted-foreground text-center text-[11px] leading-relaxed tracking-tight text-pretty">
                By continuing you create the first user in this workspace.
                <br />
                This screen will not appear again. Later users are added from{" "}
                <span className="text-foreground font-medium">Users</span>.
              </p>
            </div>
          </div>

          <div className="border-border bg-muted/30 flex items-center justify-between rounded-b-xl border-t px-6 py-3">
            <span className="text-muted-foreground max-w-[28ch] text-[11px] leading-relaxed tracking-tight text-pretty">
              Sample data: 1 dashboard · 2 charts · Analytics / public.orders
            </span>
            <Link
              to="/health"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring shrink-0 rounded-sm text-[11px] tracking-tight underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              Health
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
