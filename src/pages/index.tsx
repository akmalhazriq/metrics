import { useEffect } from "react";
import { useNavigate } from "react-router";
import { getStoredToken } from "@/hooks/useAuth";

export default function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    fetch("/api/auth/status", { headers: getStoredToken() ? { Authorization: `Bearer ${getStoredToken()}` } : {} })
      .then((r) => r.json() as Promise<{ hasUsers: boolean; isAuthenticated: boolean }>)
      .then((j) => {
        if (!j.hasUsers) navigate("/setup", { replace: true });
        else if (j.isAuthenticated) navigate("/welcome", { replace: true });
        else navigate("/login", { replace: true });
      })
      .catch(() => {
        const t = getStoredToken();
        navigate(t ? "/welcome" : "/login", { replace: true });
      });
  }, [navigate]);
  return <div className="grid min-h-screen place-items-center"><p className="text-muted-foreground text-sm">Redirecting…</p></div>;
}
