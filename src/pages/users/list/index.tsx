import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Pencil,
  Search,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UserEditor } from "@/components/editors/UserEditor";
import { ApiError, fetchList as apiFetchList, mutate } from "@/lib/api";

type UserRow = {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  active: boolean;
  roles: string[];
  databaseAccessCount: number;
  datasourceAccessCount: number;
  createdAt: string;
  modifiedAt: string;
};

export default function UsersListPage() {
  const [q, setQ] = useState("");
  const [active, setActive] = useState("all");
  const [role, setRole] = useState("all");
  const [sortBy, setSortBy] = useState("modified");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2200);
  };
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [confirmRow, setConfirmRow] = useState<UserRow | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetchList<UserRow>("/api/users", {
        q: q || undefined,
        active: active !== "all" ? (active === "active" ? "true" : "false") : undefined,
        role: role !== "all" ? role : undefined,
        sortBy,
        sortDir,
        page,
        pageSize,
      });
      setRows(res.data);
      setTotal(res.total);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "We couldn't load users. Try refreshing.";
      setError(msg);
      showToast(msg);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void fetchList();
  }, [q, active, role, sortBy, sortDir, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const handleDelete = async (row: UserRow) => {
    try {
      await mutate(`/api/users/${row.id}`, "DELETE");
      showToast("User deleted");
      fetchList();
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not delete. Try again.";
      showToast(msg);
    }
  };
  const handleBulkDelete = async () => {
    const ids = [...selected];
    let ok = 0;
    let fail = 0;
    let lastErr = "";
    for (const id of ids) {
      try {
        await mutate(`/api/users/${id}`, "DELETE");
        ok++;
      } catch (e) {
        fail++;
        lastErr = e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
      }
    }
    if (ok && !fail) showToast(`Deleted ${ok} users`);
    else if (ok && fail)
      showToast(`Deleted ${ok} of ${ok + fail} users. ${fail} failed: ${lastErr}`);
    else if (!ok && fail) showToast(lastErr || "Could not delete. Try again.");
    setSelected(new Set());
    fetchList();
  };
  const handleSave = async (payload: Record<string, unknown>) => {
    if (editing) {
      const r = await fetch(`/api/users/${editing.id as number}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = (await r.json()) as { error?: string };
        showToast(j.error ?? "Could not save. Try again.");
        return;
      }
      showToast(`User "${String(payload.username)}" saved`);
    } else {
      const r = await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = (await r.json()) as { error?: string };
        showToast(j.error ?? "Could not create it. Try again.");
        return;
      }
      showToast(`User "${String(payload.username)}" created`);
      setPage(1);
    }
    fetchList();
  };
  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (row: UserRow) => {
    setEditing(row as unknown as Record<string, unknown>);
    setEditorOpen(true);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="bg-muted text-muted-foreground grid h-7 w-7 place-items-center rounded-md">
                <Shield className="h-4 w-4" />
              </div>
              <h1 className="text-[22px] font-semibold tracking-tight">Users</h1>
              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                {total}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 max-w-[60ch] text-sm leading-relaxed">
              Manage platform users, their roles and data access.
            </p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Shield className="mr-1.5 h-3.5 w-3.5" /> Add user
          </Button>
        </div>

        <div className="border-border bg-card mt-6 rounded-lg border">
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-[360px]">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search username, name, email…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="h-8 pl-8 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <select
                  value={active}
                  onChange={(e) => {
                    setActive(e.target.value);
                    setPage(1);
                  }}
                  className="border-input bg-background h-8 rounded-md border px-2 pr-6 text-xs font-medium"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2" />
              </div>
              <div className="relative">
                <select
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    setPage(1);
                  }}
                  className="border-input bg-background h-8 rounded-md border px-2 pr-6 text-xs font-medium"
                >
                  <option value="all">All roles</option>
                  <option value="Admin">Admin</option>
                  <option value="Alpha">Alpha</option>
                  <option value="Gamma">Gamma</option>
                  <option value="Public">Public</option>
                  <option value="sql_lab">sql_lab</option>
                </select>
                <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2" />
              </div>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="border-input bg-background h-8 rounded-md border px-2 pr-6 text-xs font-medium"
                >
                  <option value="modified">Sort: Modified</option>
                  <option value="username">Sort: Username</option>
                  <option value="email">Sort: Email</option>
                </select>
                <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2" />
              </div>
              <button
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="border-input bg-background text-muted-foreground grid h-8 w-8 place-items-center rounded-md border"
              >
                <ChevronsUpDown className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="border-border flex flex-wrap items-center gap-2 border-t px-3 py-2">
            <span className="text-muted-foreground text-xs">
              {loading ? "Loading…" : `${total} users`}
            </span>
            {(q || active !== "all" || role !== "all") && (
              <button
                onClick={() => {
                  setQ("");
                  setActive("all");
                  setRole("all");
                  setPage(1);
                }}
                className="border-input bg-background ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
          {selected.size > 0 && (
            <div className="border-border bg-muted/50 flex items-center gap-2 border-t px-3 py-2">
              <span className="text-xs font-medium">{selected.size} selected</span>
              <span className="bg-border h-4 w-px" />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setConfirmBulk(true)}
              >
                <Trash2 className="mr-1 h-3 w-3" /> Delete
              </Button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-muted-foreground ml-auto text-xs font-medium"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="border-destructive/30 bg-destructive/10 text-destructive mt-4 rounded-md border px-3 py-2 text-xs">
            {error}
          </div>
        )}

        <div className="border-border bg-card mt-4 overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border bg-muted/40 text-muted-foreground border-b text-left text-xs font-medium tracking-wide">
                  <th className="w-8 px-3 py-2.5">
                    <Checkbox
                      checked={allOnPageSelected}
                      indeterminate={!allOnPageSelected && rows.some((r) => selected.has(r.id))}
                      onChange={(e) => {
                        const c = (e.target as HTMLInputElement).checked;
                        setSelected((prev) => {
                          const n = new Set(prev);
                          rows.forEach((r) => {
                            if (c) n.add(r.id);
                            else n.delete(r.id);
                          });
                          return n;
                        });
                      }}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-2 py-2.5">Username</th>
                  <th className="hidden px-2 py-2.5 sm:table-cell">Name</th>
                  <th className="hidden px-2 py-2.5 lg:table-cell">Email</th>
                  <th className="px-2 py-2.5">Active</th>
                  <th className="hidden px-2 py-2.5 lg:table-cell">Roles</th>
                  <th className="hidden px-2 py-2.5 xl:table-cell">Access</th>
                  <th className="w-10 px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-3 py-3">
                        <span className="bg-muted block h-3 w-3 rounded" />
                      </td>
                      <td className="px-2 py-3">
                        <span className="bg-muted block h-3 w-24 rounded" />
                      </td>
                      <td colSpan={6} className="px-2 py-3">
                        <span className="bg-muted block h-3 w-32 rounded" />
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <div className="mx-auto max-w-sm">
                        <p className="text-sm font-medium">No users match your filters</p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          Create a user to grant dashboard access.
                        </p>
                        <div className="mt-4 flex justify-center">
                          <Button size="sm" onClick={openCreate}>
                            Add user
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr
                      key={r.id}
                      className={`group hover:bg-muted/40 ${selected.has(r.id) ? "bg-muted/60" : ""}`}
                    >
                      <td className="px-3 py-3">
                        <Checkbox
                          checked={selected.has(r.id)}
                          onChange={(e) => {
                            const c = (e.target as HTMLInputElement).checked;
                            setSelected((prev) => {
                              const n = new Set(prev);
                              if (c) n.add(r.id);
                              else n.delete(r.id);
                              return n;
                            });
                          }}
                          aria-label={`Select ${r.username}`}
                        />
                      </td>
                      <td className="px-2 py-3">
                        <button
                          onClick={() => openEdit(r)}
                          className="text-left text-sm font-medium hover:underline"
                        >
                          {r.username}
                        </button>
                        <div className="text-muted-foreground text-[11px] sm:hidden">
                          {r.firstName} {r.lastName}
                        </div>
                      </td>
                      <td className="hidden px-2 py-2.5 sm:table-cell">
                        <span className="text-xs">
                          {r.firstName} {r.lastName}
                        </span>
                      </td>
                      <td className="hidden px-2 py-2.5 lg:table-cell">
                        <span className="text-xs">{r.email}</span>
                      </td>
                      <td className="px-2 py-2.5">
                        <Badge variant={r.active ? "success" : "muted"} className="text-[11px]">
                          {r.active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="hidden px-2 py-2.5 lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {r.roles.length === 0 ? (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          ) : (
                            r.roles.map((x) => (
                              <Badge key={x} variant="secondary" className="text-[10px]">
                                {x}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="hidden px-2 py-2.5 xl:table-cell">
                        <span className="text-xs">
                          {r.databaseAccessCount} db · {r.datasourceAccessCount} ds
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <div
                          className="relative flex justify-end"
                          ref={openMenu === r.id ? menuRef : undefined}
                        >
                          <button
                            onClick={() => setOpenMenu((v) => (v === r.id ? null : r.id))}
                            className="text-muted-foreground hover:border-input hover:bg-accent grid h-7 w-7 place-items-center rounded-md border border-transparent"
                            aria-label="Actions"
                          >
                            <ChevronsUpDown className="h-4 w-4" />
                          </button>
                          {openMenu === r.id && (
                            <div className="border-border bg-popover absolute top-8 right-0 z-20 w-48 rounded-md border p-1 shadow-lg">
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  openEdit(r);
                                }}
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </button>
                              <div className="bg-border my-1 h-px" />
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  setConfirmRow(r);
                                }}
                                className="text-destructive hover:bg-destructive hover:text-destructive-foreground flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="border-border bg-muted/20 flex flex-col items-center justify-between gap-3 border-t px-3 py-3 sm:flex-row">
            <p className="text-muted-foreground text-xs">
              {total === 0
                ? "No results"
                : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: Math.min(5, pageCount) }).map((_, i) => {
                let n: number;
                if (pageCount <= 5) n = i + 1;
                else if (page <= 3) n = i + 1;
                else if (page >= pageCount - 2) n = pageCount - 4 + i;
                else n = page - 2 + i;
                return (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`grid h-7 min-w-7 place-items-center rounded-md border px-2 text-xs font-medium ${n === page ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"}`}
                  >
                    {n}
                  </button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          Data via <code className="bg-muted rounded px-1 py-0.5">/api/users</code> — Postgres +
          Drizzle.
        </p>
      </div>
      <UserEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        initial={editing}
        onSave={handleSave}
      />
      <ConfirmDialog
        open={!!confirmRow}
        onOpenChange={(o) => !o && setConfirmRow(null)}
        title={`Delete '${confirmRow?.username ?? String(confirmRow?.id ?? "")}'?`}
        description={`Delete '${confirmRow?.username ?? String(confirmRow?.id ?? "")}'? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (confirmRow) return handleDelete(confirmRow);
        }}
      />
      <ConfirmDialog
        open={confirmBulk}
        onOpenChange={setConfirmBulk}
        title={`Delete ${selected.size} users?`}
        description={`Delete ${selected.size} users? This cannot be undone.`}
        confirmLabel={`Delete ${selected.size}`}
        variant="destructive"
        onConfirm={handleBulkDelete}
      />
      {toast && (
        <div className="border-border bg-card fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border px-3 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </AppShell>
  );
}
