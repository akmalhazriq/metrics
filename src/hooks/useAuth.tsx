/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";

type AuthUser = { id: number; username: string; firstName: string; lastName: string; email: string; active: boolean };
type AuthState = {
  user: AuthUser | null;
  roles: { id: number; name: string }[];
  permissions: string[];
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const TOKEN_KEY = "metrics_session_token";

const AuthCtx = createContext<AuthState | null>(null);

export function getStoredToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null); setRoles([]); setPermissions([]); setLoading(false);
      return;
    }
    try {
      const r = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("me failed");
      const j = await r.json() as { user: AuthUser; roles: { id: number; name: string }[]; permissions: string[] };
      setUser(j.user); setRoles(j.roles); setPermissions(j.permissions);
    } catch {
      setStoredToken(null);
      setUser(null); setRoles([]); setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
    const j = await r.json() as { token?: string; error?: string };
    if (!r.ok) throw new Error(j.error ?? "Login failed");
    setStoredToken(j.token ?? null);
    await refresh();
    navigate("/welcome");
  }, [navigate, refresh]);

  const logout = useCallback(async () => {
    const token = getStoredToken();
    try { if (token) await fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } }); } catch { /* ignore */ }
    setStoredToken(null);
    setUser(null); setRoles([]); setPermissions([]);
    navigate("/login");
  }, [navigate]);

  const value = useMemo<AuthState>(() => ({ user, roles, permissions, loading, login, logout, refresh }), [user, roles, permissions, loading, login, logout, refresh]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

const PUBLIC_PREFIXES = ["/setup", "/login", "/health"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [statusChecked, setStatusChecked] = useState(false);
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);

  useEffect(() => {
    if (isPublicPath(pathname)) { setStatusChecked(true); return; }
    const token = getStoredToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch("/api/auth/status", { headers })
      .then((r) => r.json() as Promise<{ hasUsers: boolean }>)
      .then((j) => setHasUsers(j.hasUsers))
      .catch(() => setHasUsers(true))
      .finally(() => setStatusChecked(true));
  }, [pathname]);

  useEffect(() => {
    if (loading || !statusChecked) return;
    if (isPublicPath(pathname)) return;
    if (hasUsers === false) navigate("/setup", { replace: true });
    else if (!user) navigate("/login", { replace: true });
  }, [loading, statusChecked, hasUsers, user, pathname, navigate]);

  if (isPublicPath(pathname)) return <>{children}</>;
  if (loading || !statusChecked) return <div className="grid min-h-screen place-items-center"><p className="text-muted-foreground text-sm">Loading…</p></div>;
  if (hasUsers === false) return null;
  if (!user) return null;
  return <>{children}</>;
}
