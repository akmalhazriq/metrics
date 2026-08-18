import { useEffect, useState } from "react";
import { Link } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getStoredToken, RequireAuth, useAuth } from "@/hooks/useAuth";

type ProfileResp = {
  user: {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    active: boolean;
  };
  roles: { id: number; name: string }[];
  favorites: {
    dashboards: { id: number; title: string; slug: string }[];
    charts: { id: number; name: string; slug: string; vizType: string }[];
  };
  recentActivity: {
    id: number;
    action: string;
    objectType: string;
    objectId: number | null;
    dashboardId: number | null;
    chartId: number | null;
    timestamp: string;
  }[];
  created: {
    dashboards: { id: number; title: string; slug: string }[];
    charts: { id: number; name: string; slug: string }[];
  };
};

function fmt(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) +
    " " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
}

function ProfileInner() {
  const { refresh } = useAuth();
  const [data, setData] = useState<ProfileResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"info" | "favorites" | "activity" | "created">("info");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2200);
  };

  const load = () => {
    const token = getStoredToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    setLoading(true);
    fetch("/api/profile", { headers })
      .then((r) => r.json() as Promise<ProfileResp>)
      .then((j) => {
        setData(j);
        setForm({ firstName: j.user.firstName, lastName: j.user.lastName, email: j.user.email });
      })
      .catch(() => showToast("We couldn't load your profile. Try refreshing."))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onSave = async () => {
    const token = getStoredToken();
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      showToast("Fill all fields");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/profile", { method: "PUT", headers, body: JSON.stringify(form) });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) {
        showToast(j.error ?? "Could not save. Try again.");
        return;
      }
      showToast("Profile saved");
      await refresh();
      load();
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="mx-auto max-w-[960px] px-4 py-10">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  if (!data)
    return (
      <div className="mx-auto max-w-[960px] px-4 py-10">
        <p className="text-sm">Failed to load profile.</p>
      </div>
    );

  const initials =
    `${data.user.firstName[0] ?? ""}${data.user.lastName[0] ?? ""}`.toUpperCase() ||
    data.user.username.slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-[960px] px-4 py-6 sm:px-6">
      <div className="flex items-center gap-4">
        <span className="bg-primary text-primary-foreground grid h-12 w-12 place-items-center rounded-full text-sm font-semibold">
          {initials}
        </span>
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">
            {data.user.firstName} {data.user.lastName}
          </h1>
          <p className="text-muted-foreground text-xs">
            @{data.user.username} · {data.user.email}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {data.roles.map((r) => (
              <Badge key={r.id} variant="secondary" className="text-[11px]">
                {r.name}
              </Badge>
            ))}
            {!data.user.active && (
              <Badge variant="destructive" className="text-[11px]">
                inactive
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="border-border mt-6 flex gap-1 border-b">
        {(["info", "favorites", "activity", "created"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs font-medium capitalize ${tab === t ? "border-primary text-foreground border-b-2" : "text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <div className="border-border bg-card mt-4 rounded-lg border p-5">
          <h2 className="text-sm font-semibold">Info</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Edit your display name and email. Username and password are managed by an admin.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium">First name</span>
              <Input
                value={form.firstName}
                onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium">Last name</span>
              <Input
                value={form.lastName}
                onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium">Email</span>
              <Input
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            <Button size="sm" variant="outline" onClick={load}>
              Reset
            </Button>
          </div>
        </div>
      )}

      {tab === "favorites" && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="border-border bg-card rounded-lg border p-3">
            <h3 className="text-xs font-semibold">Favorite dashboards</h3>
            {data.favorites.dashboards.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-xs">
                No favorites yet. Star a dashboard and it will show up here.
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {data.favorites.dashboards.map((d) => (
                  <li key={d.id}>
                    <Link
                      to={`/dashboard/${d.id}`}
                      className="text-primary text-xs hover:underline"
                    >
                      {d.title} — #{d.id}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-border bg-card rounded-lg border p-3">
            <h3 className="text-xs font-semibold">Favorite charts</h3>
            {data.favorites.charts.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-xs">
                No favorites yet. Star a chart and it will show up here.
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {data.favorites.charts.map((c) => (
                  <li key={c.id}>
                    <Link to={`/chart/${c.id}`} className="text-primary text-xs hover:underline">
                      {c.name} — #{c.id}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div className="border-border bg-card mt-4 overflow-hidden rounded-lg border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground border-b text-left">
                <th className="px-3 py-2">Time</th>
                <th className="px-2 py-2">Action</th>
                <th className="px-2 py-2">Object</th>
                <th className="px-2 py-2">ID</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {data.recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-muted-foreground px-3 py-8 text-center">
                    No activity yet. Actions you take will show up here.
                  </td>
                </tr>
              ) : (
                data.recentActivity.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/40">
                    <td className="px-3 py-2">{fmt(a.timestamp)}</td>
                    <td className="px-2 py-2">{a.action}</td>
                    <td className="px-2 py-2">{a.objectType}</td>
                    <td className="px-2 py-2 font-mono">
                      #{a.objectId ?? a.dashboardId ?? a.chartId ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "created" && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="border-border bg-card rounded-lg border p-3">
            <h3 className="text-xs font-semibold">Dashboards you created</h3>
            {data.created.dashboards.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-xs">
                None yet. Create a dashboard and it will appear here.
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {data.created.dashboards.map((d) => (
                  <li key={d.id}>
                    <Link
                      to={`/dashboard/${d.id}`}
                      className="text-primary text-xs hover:underline"
                    >
                      {d.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-border bg-card rounded-lg border p-3">
            <h3 className="text-xs font-semibold">Charts you created</h3>
            {data.created.charts.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-xs">
                None yet. Create a chart and it will appear here.
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {data.created.charts.map((c) => (
                  <li key={c.id}>
                    <Link to={`/chart/${c.id}`} className="text-primary text-xs hover:underline">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {toast && (
        <div className="border-border bg-card fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border px-3 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <AppShell>
        <ProfileInner />
      </AppShell>
    </RequireAuth>
  );
}
