import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onClose: () => void;
  initial: Record<string, unknown> | null;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

type Perm = { id: number; name: string; view: string; action: string; description: string | null };

export function RoleEditor({ open, onClose, initial, onSave }: Props) {
  const isEdit = !!initial;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [perms, setPerms] = useState<Perm[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const init = (initial ?? {}) as Record<string, unknown>;
    setForm({
      name: (init.name as string) ?? "",
      description: (init.description as string) ?? "",
      permissionIds: (init.permissionIds as number[]) ?? [],
    });
    setAssignedUsers([]);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/permissions?pageSize=100").then((r) => r.json()).then((j: { data: Perm[] }) => setPerms(j.data ?? [])).catch(() => {});
    if (initial && (initial as Record<string, unknown>).id) {
      const id = (initial as Record<string, unknown>).id as number;
      fetch(`/api/roles/${id}`).then((r) => r.json()).then((j: { data: Record<string, unknown> }) => {
        if (j.data) {
          setForm((p) => ({ ...p, permissionIds: (j.data.permissionIds as number[]) ?? p.permissionIds, name: (j.data.name as string) ?? p.name, description: (j.data.description as string) ?? p.description }));
          setAssignedUsers((j.data.users as string[]) ?? []);
        }
      }).catch(() => {});
    }
  }, [open, initial]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const grouped = useMemo(() => {
    const m = new Map<string, Perm[]>();
    for (const p of perms) {
      const arr = m.get(p.view) ?? [];
      arr.push(p);
      m.set(p.view, arr);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [perms]);

  if (!open) return null;
  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const toggle = (id: number) => {
    const arr = (form.permissionIds as number[]) ?? [];
    set("permissionIds", arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  };

  const handleSave = async () => {
    const name = String(form.name ?? "").trim();
    if (!name) return;
    const payload = { name, description: String(form.description ?? "").trim() || null, permissionIds: (form.permissionIds as number[]) ?? [] };
    setSaving(true);
    try { await onSave(payload); onClose(); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <button aria-label="Close editor" onClick={onClose} className="bg-foreground/20 flex-1 backdrop-blur-sm" />
      <div className="bg-card border-border flex w-full max-w-[640px] flex-col border-l shadow-xl">
        <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight">{isEdit ? "Edit role" : "Add role"}</h2>
            <p className="text-muted-foreground mt-1 max-w-[44ch] text-xs leading-relaxed">Name the role and choose which permissions it grants. Applied to users immediately.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:bg-accent grid h-8 w-8 place-items-center rounded-md"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-5">
            <label className="space-y-1.5"><span className="text-xs font-medium">Name *</span><Input value={String(form.name ?? "")} onChange={(e) => set("name", e.target.value)} placeholder="Alpha" /></label>
            <label className="space-y-1.5"><span className="text-xs font-medium">Description</span><textarea value={String(form.description ?? "")} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="What this role is for." className="border-input bg-background w-full rounded-md border px-3 py-2 text-xs" /></label>

            <div className="space-y-2">
              <span className="text-xs font-medium">Permissions — grouped by view</span>
              {grouped.length === 0 ? <p className="text-muted-foreground text-xs">No permissions seeded.</p> : (
                <div className="border-border divide-border divide-y rounded-md border">
                  {grouped.map(([view, list]) => (
                    <div key={view} className="p-3">
                      <p className="text-xs font-semibold capitalize">{view}</p>
                      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                        {list.map((p) => (
                          <label key={p.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={((form.permissionIds as number[]) ?? []).includes(p.id)} onChange={() => toggle(p.id)} className="accent-primary h-3.5 w-3.5" /><span className="truncate" title={p.description ?? p.name}>{p.name}</span></label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isEdit && assignedUsers.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-medium">Users with this role — read only</span>
                <div className="border-border bg-muted/30 rounded-md border px-3 py-2">
                  <p className="text-xs">{assignedUsers.join(", ")}</p>
                  <p className="text-muted-foreground mt-1 text-[11px]">Edit membership from Users → pick roles per user.</p>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="border-border flex items-center gap-2 border-t px-5 py-4">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="ml-auto" disabled={saving || !String(form.name ?? "").trim()} onClick={handleSave}>{saving ? "Saving…" : isEdit ? "Save changes" : "Create role"}</Button>
        </div>
      </div>
    </div>
  );
}
