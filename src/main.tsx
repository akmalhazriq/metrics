import "./index.css";

import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useRoutes } from "react-router";
import routes from "~react-pages";
import { AuthProvider, RequireAuth } from "@/hooks/useAuth";
import RootErrorBoundary from "@/pages/RootErrorBoundary";

// Global fetch patch — inject Bearer token for every /api/* request and
// bounce expired sessions to /login instead of white-screening.
// Fixes auth regression from bulk requireAuth patch: ~20 list pages
// fetch("/api/...") without an Authorization header, got 401 JSON
// {error:true}, then setRows(undefined) and crashed to a white screen.
// Single patch here restores all of them without touching each page.
// 401-redirect excludes /api/auth/* and /api/setup/* so wrong-password
// on login shows inline error instead of a redirect loop.
const TOKEN_KEY = "metrics_session_token";
const _origFetch = window.fetch.bind(window);
window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof Request ? input.url : input instanceof URL ? input.toString() : "";
  let nextInput: RequestInfo | URL = input;
  let nextInit: RequestInit | undefined = init;
  if (url.startsWith("/api/") && typeof window !== "undefined") {
    let token: string | null;
    try { token = localStorage.getItem(TOKEN_KEY); } catch { token = null; }
    if (token) {
      const hasAuth = (() => {
        if (!init?.headers) {
          if (input instanceof Request) return input.headers.has("Authorization") || input.headers.has("authorization");
          return false;
        }
        const h = init.headers as Record<string, string> | Headers | [string, string][];
        if (h instanceof Headers) return h.has("Authorization") || h.has("authorization");
        if (Array.isArray(h)) return h.some(([k]) => k.toLowerCase() === "authorization");
        return "Authorization" in h || "authorization" in h;
      })();
      if (!hasAuth) {
        if (input instanceof Request) {
          const headers = new Headers(input.headers);
          headers.set("Authorization", `Bearer ${token}`);
          nextInput = new Request(input, { headers });
        } else {
          nextInit = init ?? {};
          if (nextInit.headers instanceof Headers) {
            nextInit.headers.set("Authorization", `Bearer ${token}`);
          } else if (Array.isArray(nextInit.headers)) {
            (nextInit.headers as [string, string][]).push(["Authorization", `Bearer ${token}`]);
          } else {
            nextInit.headers = { ...((nextInit.headers as Record<string, string>) ?? {}), Authorization: `Bearer ${token}` };
          }
        }
      }
    }
  }
  const p = _origFetch(nextInput as RequestInfo, nextInit);
  // Expired/invalid session → clear token and bounce to /login.
  // Exclude auth + setup endpoints: 401 on /api/auth/login is a
  // legitimate "wrong password" that the login page shows inline.
  const isAuthOrSetup = url.startsWith("/api/auth/") || url.startsWith("/api/setup/");
  if (!isAuthOrSetup && url.startsWith("/api/")) {
    return p.then((res) => {
      if (res.status === 401) {
        try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
        if (window.location.pathname !== "/login" && window.location.pathname !== "/setup") {
          window.location.href = "/login";
        }
      }
      return res;
    });
  }
  return p;
}) as typeof window.fetch;

// eslint-disable-next-line react-refresh/only-export-components
function App() {
  return <Suspense fallback={<p>...</p>}>{useRoutes(routes)}</Suspense>;
}

const app = createRoot(document.getElementById("root")!);

app.render(
  <StrictMode>
    <BrowserRouter>
      <RootErrorBoundary>
        <AuthProvider>
          <RequireAuth>
            <App />
          </RequireAuth>
        </AuthProvider>
      </RootErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
