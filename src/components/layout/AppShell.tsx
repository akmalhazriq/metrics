import { Link, useLocation, useNavigate } from "react-router";
import {
  Activity,
  BarChart3,
  Clock3,
  Database,
  FileJson,
  FileSpreadsheet,
  FlaskConical,
  Info,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Search,
  Bell,
  Shield,
  Settings2,
  StickyNote,
  SwatchBook,
  Table2,
  Tag,
  Compass,
  User,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/utils";
import { useAuth } from "@/hooks/useAuth";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  active?: boolean;
};

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Workspace",
    items: [
      { label: "Welcome", href: "/welcome", icon: Compass },
      { label: "Dashboards", href: "/dashboard", icon: LayoutDashboard },
      { label: "Charts", href: "/chart", icon: BarChart3 },
      { label: "Explore", href: "/explore", icon: Compass },
      { label: "SQL Lab", href: "/sqllab", icon: FlaskConical },
    ],
  },
  {
    section: "Data",
    items: [
      { label: "Datasets", href: "/datasets", icon: Table2 },
      { label: "Databases", href: "/databases", icon: Database },
      { label: "Uploads", href: "/uploads", icon: FileSpreadsheet },
    ],
  },
  {
    section: "Govern",
    items: [
      { label: "Alerts", href: "/alert/list", icon: Bell },
      { label: "Reports", href: "/report/list", icon: FileSpreadsheet },
      { label: "Users", href: "/users/list", icon: Users },
      { label: "Roles", href: "/roles/list", icon: Shield },
      { label: "Permissions", href: "/permissions/list", icon: KeyRound },
      { label: "RLS", href: "/rowlevelsecurity/list", icon: Shield },
      { label: "Annotation Layers", href: "/annotationlayer/list", icon: StickyNote },
      { label: "CSS Templates", href: "/csstemplates/list", icon: SwatchBook },
      { label: "Tags", href: "/tag/list", icon: Tag },
      { label: "Import / Export", href: "/importexport", icon: FileJson },
      { label: "Action Log", href: "/log", icon: Clock3 },
      { label: "Settings", href: "/settings", icon: Settings2 },
    ],
  },
  {
    section: "System",
    items: [
      { label: "Health", href: "/health", icon: Activity },
      { label: "About", href: "/about", icon: Info },
      { label: "Profile", href: "/profile", icon: User },
      { label: "AI Settings", href: "/settings/ai", icon: Settings2 },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/welcome") return pathname === "/welcome" || pathname === "/";
  if (href === "/dashboard") return pathname.startsWith("/dashboard");
  if (href === "/alert/list") return pathname.startsWith("/alert");
  if (href === "/report/list") return pathname.startsWith("/report");
  if (href === "/users/list") return pathname.startsWith("/users");
  if (href === "/roles/list") return pathname.startsWith("/roles");
  if (href === "/permissions/list") return pathname.startsWith("/permissions");
  if (href === "/rowlevelsecurity/list") return pathname.startsWith("/rowlevelsecurity");
  if (href === "/annotationlayer/list") return pathname.startsWith("/annotationlayer");
  if (href === "/csstemplates/list") return pathname.startsWith("/csstemplates");
  if (href === "/tag/list") return pathname.startsWith("/tag");
  if (href === "/importexport") return pathname.startsWith("/importexport");
  if (href === "/log") return pathname.startsWith("/log") && !pathname.startsWith("/login");
  if (href === "/health") return pathname.startsWith("/health");
  if (href === "/about") return pathname.startsWith("/about");
  if (href === "/profile") return pathname.startsWith("/profile");
  if (href === "/uploads")
    return (
      pathname.startsWith("/uploads") ||
      pathname.startsWith("/csvtodatabaseview") ||
      pathname.startsWith("/exceltodatabaseview")
    );
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeLabel =
    NAV.flatMap((g) => g.items).find((it) => isActive(pathname, it.href))?.label ?? "Dashboards";
  const { user, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  // Safety net: if AppShell somehow renders without auth (e.g. a route forgot RequireAuth),
  // redirect immediately. RequireAuth is the primary guard; this is the belt-and-suspenders.
  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);
  const initials = user ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() || user.username.slice(0, 2).toUpperCase() : "—";

  return (
    <div className="bg-background text-foreground min-h-screen">
      {/* Top bar — thin, tool-like, not marketing */}
      <header className="border-sidebar-border bg-sidebar sticky top-0 z-30 flex h-[44px] items-center gap-4 border-b px-3">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="bg-primary text-primary-foreground grid h-7 w-7 place-items-center rounded-md text-[11px] font-bold tracking-widest">
            M
          </span>
          <span className="text-[13px] font-semibold tracking-tight">Metric</span>
          <span className="bg-muted text-muted-foreground hidden rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide sm:inline">
            BI
          </span>
        </Link>

        <div className="text-muted-foreground ml-2 hidden items-center gap-1 text-xs md:flex">
          <span className="bg-border h-3 w-px" />
          <span className="px-2">Workspace</span>
          <span className="text-border">/</span>
          <span className="text-foreground font-medium">{activeLabel}</span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Search"
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground grid h-7 w-7 place-items-center rounded-md"
          >
            <Search className="h-4 w-4" />
          </button>
          <div className="relative ml-1 hidden items-center gap-2 border-l pl-3 sm:flex">
            <span className="text-muted-foreground hidden text-xs lg:inline">{user ? `${user.firstName} ${user.lastName}` : "—"}</span>
            <button onClick={() => setMenuOpen((v) => !v)} className="bg-primary text-primary-foreground grid h-7 w-7 place-items-center rounded-full text-xs font-medium">
              {initials}
            </button>
            {menuOpen && (
              <>
                <button aria-label="Close menu" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-20" />
                <div className="border-border bg-popover absolute top-9 right-0 z-30 w-48 rounded-md border p-1 shadow-lg">
                  <div className="px-2 py-1.5">
                    <p className="text-xs font-medium">{user?.username ?? "—"}</p>
                    <p className="text-muted-foreground text-[11px]">{user?.email ?? ""}</p>
                  </div>
                  <div className="bg-border my-1 h-px" />
                  <Link to="/profile" onClick={() => setMenuOpen(false)} className="hover:bg-accent flex items-center gap-2 rounded px-2 py-1.5 text-xs"><User className="h-3.5 w-3.5" /> Profile</Link>
                  <Link to="/about" onClick={() => setMenuOpen(false)} className="hover:bg-accent flex items-center gap-2 rounded px-2 py-1.5 text-xs"><Info className="h-3.5 w-3.5" /> About</Link>
                  <Link to="/health" onClick={() => setMenuOpen(false)} className="hover:bg-accent flex items-center gap-2 rounded px-2 py-1.5 text-xs"><Activity className="h-3.5 w-3.5" /> Health</Link>
                  <div className="bg-border my-1 h-px" />
                  <button onClick={() => { setMenuOpen(false); void logout(); }} className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"><LogOut className="h-3.5 w-3.5" /> Logout</button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar — quiet, dense, monochrome */}
        <aside className="border-sidebar-border bg-sidebar hidden w-[220px] shrink-0 border-r md:block">
          <nav className="sticky top-[44px] h-[calc(100vh-44px)] overflow-y-auto px-2 py-4">
            {NAV.map((group) => (
              <div key={group.section} className="mb-5">
                <p className="text-muted-foreground mb-2 px-2 text-[10px] font-semibold tracking-widest uppercase">
                  {group.section}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <li key={item.label}>
                        <Link
                          to={item.href}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] leading-none transition-colors",
                            active
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          )}
                        >
                          <item.icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

          </nav>
        </aside>

        {/* Mobile nav — horizontal pills */}
        <div className="border-sidebar-border bg-sidebar fixed right-0 bottom-0 left-0 z-30 flex gap-1 overflow-x-auto border-t px-2 py-2 md:hidden">
          {NAV.flatMap((g) => g.items)
            .slice(0, 5)
            .map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.label}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
        </div>

        {/* Main */}
        <main className="bg-background min-w-0 flex-1 pb-16 md:pb-0">{children}</main>
      </div>
    </div>
  );
}
