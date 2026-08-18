import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  BarChart3,
  Compass,
  Database,
  FileSpreadsheet,
  FlaskConical,
  LayoutDashboard,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStoredToken, RequireAuth, useAuth } from "@/hooks/useAuth";
import { ApiError, fetchApi } from "@/lib/api";

type WelcomeResp = {
  recentDashboards: {
    id: number;
    title: string;
    slug: string;
    status: string;
    modifiedAt: string;
  }[];
  recentCharts: { id: number; name: string; slug: string; vizType: string; modifiedAt: string }[];
  favoriteDashboards: {
    id: number;
    title: string;
    slug: string;
    status: string;
    modifiedAt: string;
  }[];
  favoriteCharts: { id: number; name: string; slug: string; vizType: string; modifiedAt: string }[];
  createdDashboards: {
    id: number;
    title: string;
    slug: string;
    status: string;
    modifiedAt: string;
  }[];
  createdCharts: { id: number; name: string; slug: string; vizType: string; modifiedAt: string }[];
  quickStats: { dashboards: number; charts: number; datasets: number; databases: number };
};

const ACTIONS = [
  { label: "Create Dashboard", href: "/dashboard", icon: LayoutDashboard, desc: "New layout" },
  { label: "Create Chart", href: "/chart", icon: BarChart3, desc: "Visualize data" },
  { label: "Connect Database", href: "/databases", icon: Database, desc: "Add connection" },
  { label: "Upload Data", href: "/uploads", icon: FileSpreadsheet, desc: "Import file" },
  { label: "Explore SQL Lab", href: "/sqllab", icon: FlaskConical, desc: "Write SQL" },
];

function CardGrid({
  title,
  items,
  kind,
}: {
  title: string;
  items: { id: number; title?: string; name?: string; slug: string }[];
  kind: "dashboard" | "chart";
}) {
  if (items.length === 0)
    return (
      <div className="border-border bg-card rounded-lg border p-4">
        <h3 className="text-xs font-semibold tracking-wide uppercase">{title}</h3>
        <p className="text-muted-foreground mt-2 text-xs">
          Nothing here yet. Create your first one to get started.
        </p>
      </div>
    );
  return (
    <div className="border-border bg-card rounded-lg border">
      <div className="border-border flex items-center justify-between border-b px-3 py-2.5">
        <h3 className="text-xs font-semibold tracking-wide uppercase">{title}</h3>
        <Badge variant="secondary" className="text-[11px]">
          {items.length}
        </Badge>
      </div>
      <ul className="divide-border divide-y">
        {items.map((it) => (
          <li key={it.id}>
            <Link
              to={kind === "dashboard" ? `/dashboard/${it.id}` : `/chart/${it.id}`}
              className="hover:bg-muted/40 flex items-center gap-3 px-3 py-2.5"
            >
              <span className="bg-muted grid h-7 w-7 place-items-center rounded-md">
                {kind === "dashboard" ? (
                  <LayoutDashboard className="h-3.5 w-3.5" />
                ) : (
                  <BarChart3 className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-medium">
                {it.title ?? it.name ?? it.slug}
              </span>
              <span className="text-muted-foreground font-mono text-[11px]">#{it.id}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WelcomeInner() {
  const { user } = useAuth();
  const [data, setData] = useState<WelcomeResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favTab, setFavTab] = useState<"dash" | "chart">("dash");
  const [createdTab, setCreatedTab] = useState<"dash" | "chart">("dash");
  const [showSetupNote, setShowSetupNote] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem("setup_complete_seen");
      if (v === "0") {
        setShowSetupNote(true);
        localStorage.setItem("setup_complete_seen", "1");
      }
    } catch {
      /* ignore storage */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = getStoredToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      setLoading(true);
      setError(null);
      try {
        const resp = await fetchApi<WelcomeResp>("/api/welcome", { headers });
        if (!cancelled) setData(resp);
      } catch (e) {
        const msg =
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "We couldn't load your workspace. Try refreshing.";
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
      {showSetupNote && (
        <div className="border-success/30 bg-success/10 text-success mb-4 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs">
          <span>
            All set. Your admin account is ready, you will not see that setup screen again.
          </span>
          <button
            onClick={() => setShowSetupNote(false)}
            className="hover:bg-success/20 rounded px-1.5 py-0.5 text-[11px] font-medium"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">
            Welcome, {user?.firstName ?? user?.username ?? "there"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Pick up where you left off or start something new.
          </p>
        </div>
        <div className="border-border bg-card flex items-center gap-2 rounded-lg border px-3 py-2">
          <Compass className="text-muted-foreground h-4 w-4" />
          <span className="text-xs font-medium">
            {data?.quickStats.dashboards == null
              ? "—"
              : data.quickStats.dashboards === 1
                ? "1 dashboard"
                : `${data.quickStats.dashboards} dashboards`}
          </span>
          <span className="bg-border h-3 w-px" />
          <span className="text-xs font-medium">
            {data?.quickStats.charts == null
              ? "—"
              : data.quickStats.charts === 1
                ? "1 chart"
                : `${data.quickStats.charts} charts`}
          </span>
          <span className="bg-border h-3 w-px" />
          <span className="text-xs font-medium">
            {data?.quickStats.datasets == null
              ? "—"
              : data.quickStats.datasets === 1
                ? "1 dataset"
                : `${data.quickStats.datasets} datasets`}
          </span>
          <span className="bg-border h-3 w-px" />
          <span className="text-xs font-medium">
            {data?.quickStats.databases == null
              ? "—"
              : data.quickStats.databases === 1
                ? "1 database"
                : `${data.quickStats.databases} databases`}
          </span>
        </div>
      </div>

      {error && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mt-4 rounded-md border px-3 py-2 text-xs">
          {error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ACTIONS.map((a) => (
          <Link
            key={a.label}
            to={a.href}
            className="border-border bg-card hover:bg-accent group flex items-center gap-3 rounded-lg border px-3 py-3"
          >
            <span className="bg-muted group-hover:bg-background grid h-8 w-8 place-items-center rounded-md">
              <a.icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-xs font-medium">{a.label}</span>
              <span className="text-muted-foreground text-[11px]">{a.desc}</span>
            </span>
          </Link>
        ))}
      </div>

      {loading ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-muted h-32 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <CardGrid title="Recent dashboards" items={data.recentDashboards} kind="dashboard" />
            <CardGrid title="Recent charts" items={data.recentCharts} kind="chart" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="border-border bg-card rounded-lg border">
              <div className="border-border flex items-center justify-between border-b px-3 py-2.5">
                <h3 className="text-xs font-semibold tracking-wide uppercase">Favorites</h3>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={favTab === "dash" ? "secondary" : "ghost"}
                    className="h-7 text-xs"
                    onClick={() => setFavTab("dash")}
                  >
                    Dashboards
                  </Button>
                  <Button
                    size="sm"
                    variant={favTab === "chart" ? "secondary" : "ghost"}
                    className="h-7 text-xs"
                    onClick={() => setFavTab("chart")}
                  >
                    Charts
                  </Button>
                </div>
              </div>
              <div className="p-3">
                {favTab === "dash" ? (
                  <CardGrid
                    title="Favorite dashboards"
                    items={data.favoriteDashboards}
                    kind="dashboard"
                  />
                ) : (
                  <CardGrid title="Favorite charts" items={data.favoriteCharts} kind="chart" />
                )}
              </div>
            </div>
            <div className="border-border bg-card rounded-lg border">
              <div className="border-border flex items-center justify-between border-b px-3 py-2.5">
                <h3 className="text-xs font-semibold tracking-wide uppercase">Created by you</h3>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={createdTab === "dash" ? "secondary" : "ghost"}
                    className="h-7 text-xs"
                    onClick={() => setCreatedTab("dash")}
                  >
                    Dashboards
                  </Button>
                  <Button
                    size="sm"
                    variant={createdTab === "chart" ? "secondary" : "ghost"}
                    className="h-7 text-xs"
                    onClick={() => setCreatedTab("chart")}
                  >
                    Charts
                  </Button>
                </div>
              </div>
              <div className="p-3">
                {createdTab === "dash" ? (
                  <CardGrid
                    title="Your dashboards"
                    items={data.createdDashboards}
                    kind="dashboard"
                  />
                ) : (
                  <CardGrid title="Your charts" items={data.createdCharts} kind="chart" />
                )}
              </div>
            </div>
          </div>

          <div className="border-border bg-card mt-4 rounded-lg border p-4">
            <h3 className="text-xs font-semibold tracking-wide uppercase">Resources</h3>
            <ul className="text-muted-foreground mt-2 grid gap-1 text-xs sm:grid-cols-2">
              <li>
                <a
                  href="https://superset.apache.org/docs/intro"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  Documentation
                </a>{" "}
                — concepts and guides
              </li>
              <li>
                <a
                  href="https://superset.apache.org/docs/faq"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  Tutorials
                </a>{" "}
                — first chart and dashboard
              </li>
              <li>
                <Link to="/about" className="text-primary hover:underline">
                  About this build
                </Link>{" "}
                — version and links
              </li>
              <li>
                <Link to="/health" className="text-primary hover:underline">
                  Health check
                </Link>{" "}
                — DB and uptime
              </li>
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function WelcomePage() {
  return (
    <RequireAuth>
      <AppShell>
        <WelcomeInner />
      </AppShell>
    </RequireAuth>
  );
}
