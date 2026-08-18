import { Link, useLocation, useNavigate } from "react-router";
import {
  Activity,
  BarChart3,
  Clock3,
  Database,
  FileJson,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Info,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Search,
  Bell,
  Shield,
  Settings2,
  Sparkles,
  StickyNote,
  SwatchBook,
  Table2,
  Tag,
  Compass,
  User,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/utils";
import { useAuth } from "@/hooks/useAuth";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
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
      { label: "Upload Data", href: "/uploads", icon: FileSpreadsheet },
    ],
  },
  {
    section: "Govern",
    items: [
      { label: "Alerts", href: "/alert/list", icon: Bell },
      { label: "Reports", href: "/report/list", icon: FileText },
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
      { label: "AI Settings", href: "/settings/ai", icon: Sparkles },
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
  const activeEntry = NAV.flatMap((g) => g.items).find((it) => isActive(pathname, it.href));
  const activeLabel = activeEntry?.label ?? "Dashboards";
  const activeSection =
    NAV.find((g) => g.items.some((it) => isActive(pathname, it.href)))?.section ?? "Workspace";
  const { user, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const firstMenuItemRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  // Global "/" shortcut, focus the list search input if present
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      const el = document.querySelector<HTMLInputElement>("[data-list-search]");
      if (!el) return;
      e.preventDefault();
      el.focus();
      el.select?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Close user menu on route change, Escape, and manage focus
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    // Focus first item after open for keyboard users
    window.requestAnimationFrame(() => firstMenuItemRef.current?.focus());
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const handleHeaderSearch = () => {
    // Always land on the dashboard list where search lives, then focus it
    if (
      pathname === "/dashboard" ||
      pathname === "/dashboard/list" ||
      pathname.startsWith("/dashboard")
    ) {
      document.querySelector<HTMLInputElement>("[data-list-search]")?.focus();
      return;
    }
    navigate("/dashboard/list");
    // Focus after route transition
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>("[data-list-search]")?.focus();
    }, 80);
  };

  const initials = user
    ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() ||
      user.username.slice(0, 2).toUpperCase()
    : "—";

  return (
    <div className="bg-background text-foreground min-h-screen antialiased">
      <a
        href="#main-content"
        className="focus:bg-primary focus:text-primary-foreground focus-visible:ring-ring sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:outline-none focus-visible:ring-2"
      >
        Skip to main content
      </a>
      {/* Header, 44px, tool grade, sticky above content */}
      <header className="border-sidebar-border bg-sidebar sticky top-0 z-40 flex h-[44px] items-center gap-3 border-b px-3">
        <Link
          to="/"
          className="focus-visible:ring-ring flex items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none"
          aria-label="Metric BI home"
        >
          <span className="bg-primary text-primary-foreground grid h-7 w-7 place-items-center rounded-md text-[11px] font-bold tracking-widest">
            M
          </span>
          <span className="text-[13px] font-semibold tracking-tight text-balance">Metric</span>
          <span className="bg-muted text-muted-foreground hidden rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide sm:inline">
            BI
          </span>
        </Link>

        {/* Breadcrumb, section / page, quiet */}
        <nav
          aria-label="Breadcrumb"
          className="text-muted-foreground ml-2 hidden items-center gap-1.5 text-[12px] md:flex"
        >
          <span className="bg-border h-3 w-px" aria-hidden />
          <span className="px-1.5 tracking-tight select-none">{activeSection}</span>
          <span className="text-border" aria-hidden>
            /
          </span>
          <span className="text-foreground font-medium tracking-tight" aria-current="page">
            {activeLabel}
          </span>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Search dashboards"
            title="Search, press /"
            onClick={handleHeaderSearch}
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80 focus-visible:ring-ring grid h-8 w-8 place-items-center rounded-md transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
          >
            <Search className="h-4 w-4 stroke-[1.75]" aria-hidden />
          </button>

          <div className="relative ml-1 hidden items-center gap-2 border-l pl-3 sm:flex">
            <span
              className="text-muted-foreground hidden max-w-[14ch] truncate text-xs lg:inline"
              aria-hidden
            >
              {user ? `${user.firstName} ${user.lastName}` : "—"}
            </span>
            <button
              ref={menuBtnRef}
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label={
                user ? `${user.firstName} ${user.lastName}, open user menu` : "Open user menu"
              }
              className="bg-primary text-primary-foreground focus-visible:ring-ring hover:bg-primary/90 active:bg-primary/80 grid h-8 w-8 place-items-center rounded-full text-xs font-medium ring-offset-2 transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
            >
              {initials}
            </button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close user menu"
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-20 cursor-default"
                  tabIndex={-1}
                />
                <div
                  role="menu"
                  aria-label="User menu"
                  className="border-border bg-popover animate-in fade-in slide-in-from-top-1 absolute top-9 right-0 z-30 w-52 rounded-lg border p-1 shadow-xl duration-150 motion-reduce:animate-none"
                >
                  <div className="px-2.5 py-2">
                    <p className="truncate text-xs font-medium tracking-tight">
                      {user?.username ?? "—"}
                    </p>
                    <p className="text-muted-foreground truncate text-[11px]">
                      {user?.email ?? ""}
                    </p>
                  </div>
                  <div className="bg-border my-1 h-px" />
                  <Link
                    ref={firstMenuItemRef}
                    to="/profile"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="hover:bg-accent focus-visible:bg-accent focus-visible:ring-ring flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                  >
                    <User className="h-4 w-4 shrink-0 stroke-[1.75]" aria-hidden /> Profile
                  </Link>
                  <Link
                    to="/about"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="hover:bg-accent focus-visible:bg-accent focus-visible:ring-ring flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                  >
                    <Info className="h-4 w-4 shrink-0 stroke-[1.75]" aria-hidden /> About
                  </Link>
                  <Link
                    to="/health"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="hover:bg-accent focus-visible:bg-accent focus-visible:ring-ring flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                  >
                    <Activity className="h-4 w-4 shrink-0 stroke-[1.75]" aria-hidden /> Health
                  </Link>
                  <div className="bg-border my-1 h-px" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      void logout();
                    }}
                    className="hover:bg-accent focus-visible:bg-accent focus-visible:ring-ring flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                  >
                    <LogOut className="h-4 w-4 shrink-0 stroke-[1.75]" aria-hidden /> Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar, Linear and Vercel quiet, 256px, dense */}
        <aside
          className="border-sidebar-border bg-sidebar hidden w-[256px] shrink-0 border-r md:block"
          aria-label="Primary"
        >
          <nav className="sticky top-[44px] h-[calc(100vh-44px)] overflow-y-auto px-2 py-3">
            {NAV.map((group) => (
              <div key={group.section} className="mb-6 last:mb-0">
                <p className="text-muted-foreground mb-2 px-2 text-[10px] font-semibold tracking-[0.09em] uppercase select-none">
                  {group.section}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <li key={item.label}>
                        <Link
                          to={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "focus-visible:ring-ring flex items-center gap-2.5 rounded-md px-2 py-[7px] text-[13px] leading-none transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none",
                            active
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent/80",
                          )}
                        >
                          <item.icon
                            aria-hidden
                            className={cn(
                              "h-4 w-4 shrink-0 stroke-[1.75]",
                              active ? "opacity-100" : "opacity-70",
                            )}
                          />
                          <span className="truncate tracking-tight">{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Mobile nav, horizontal scroll of primary sections */}
        <nav
          aria-label="Primary, mobile"
          className="border-sidebar-border bg-sidebar fixed inset-x-0 bottom-0 z-30 flex [scrollbar-width:none] items-center gap-1 overflow-x-auto border-t px-2 py-2 [-ms-overflow-style:none] md:hidden [&::-webkit-scrollbar]:hidden"
        >
          {NAV.flatMap((g) => g.items).map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.label}
                to={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-150 motion-reduce:transition-none",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
                )}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0 stroke-[1.75]" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Main, content gutter, no extra chrome */}
        <main
          id="main-content"
          tabIndex={-1}
          className="bg-background focus-visible:ring-ring min-w-0 flex-1 pb-16 outline-none focus-visible:ring-2 focus-visible:ring-inset md:pb-0"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
