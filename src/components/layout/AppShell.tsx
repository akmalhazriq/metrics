import { Link, useLocation } from "react-router";
import {
  BarChart3,
  Database,
  FileSpreadsheet,
  FlaskConical,
  LayoutDashboard,
  Search,
  Bell,
  Shield,
  Settings2,
  Table2,
  Compass,
} from "lucide-react";

import { cn } from "@/utils";

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
      { label: "Alerts", href: "/alerts", icon: Bell },
      { label: "Admin", href: "/admin", icon: Shield },
      { label: "Settings", href: "/settings", icon: Settings2 },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname.startsWith("/dashboard");
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
  const activeLabel =
    NAV.flatMap((g) => g.items).find((it) => isActive(pathname, it.href))?.label ?? "Dashboards";

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
          <div className="border-border ml-1 hidden items-center gap-2 border-l pl-3 sm:flex">
            <span className="text-muted-foreground hidden text-xs lg:inline">Akmal Hazriq</span>
            <span className="bg-primary text-primary-foreground grid h-7 w-7 place-items-center rounded-full text-xs font-medium">
              AH
            </span>
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

            <div className="border-sidebar-border bg-muted/40 mt-6 rounded-md border border-dashed p-3">
              <p className="text-xs font-medium">No database connected</p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                Connect a database to run SQL and build charts.
              </p>
              <button className="text-primary mt-2 text-xs font-medium hover:underline">
                Add database →
              </button>
            </div>
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
