import { useEffect, useState } from "react";
import { Database, Layers, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onClose: () => void;
  initial: Record<string, unknown> | null;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

type RoleOpt = { id: number; name: string };
type DbOpt = { id: string; name: string };
type DsOpt = { id: number; name: string };

export function UserEditor({ open, onClose, initial, onSave }: Props) {
  const isEdit = !!initial;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [roleOpts, setRoleOpts] = useState<RoleOpt[]>([]);
  const [dbOpts, setDbOpts] = useState<DbOpt[]>([]);
  const [dsOpts, setDsOpts] = useState<DsOpt[]>([]);

  useEffect(() => {
    if (!open) return;
    const init = (initial ?? {}) as Record<string, unknown>;
    setForm({
      firstName: (init.firstName as string) ?? "",
      lastName: (init.lastName as string) ?? "",
      username: (init.username as string) ?? "",
      email: (init.email as string) ?? "",
      active: (init.active as boolean) ?? true,
      password: "",
      roleIds: (init.roleIds as number[]) ?? (init.roles as string[] ?? []),
      databaseIds: (init.databaseIds as string[]) ?? [],
      datasetIds: (init.datasetIds as number[]) ?? [],
    });
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/roles?pageSize=50").then((r) => r.json()).then((j: { data: RoleOpt[] }) => setRoleOpts(j.data ?? [])).catch(() => {});
    fetch("/api/databases?pageSize=50").then((r) => r.json()).then((j: { data: DbOpt[] }) => setDbOpts(j.data ?? [])).catch(() => {});
    fetch("/api/datasets?pageSize=50").then((r) => r.json()).then((j: { data: DsOpt[] }) => setDsOpts(j.data ?? [])).catch(() => {});
    // hydrate from server when editing (roleIds/databaseIds/datasetIds)
    if (initial && (initial as Record<string, unknown>).id) {
      const id = (initial as Record<string, unknown>).id as number;
      fetch(`/api/users/${id}`).then((r) => r.json()).then((j: { data: Record<string, unknown> }) => {
        if (j.data) setForm((p) => ({ ...p, roleIds: (j.data.roleIds as number[]) ?? p.roleIds, databaseIds: (j.data.databaseIds as string[]) ?? p.databaseIds, datasetIds: (j.data.datasetIds as number[]) ?? p.datasetIds }));
      }).catch(() => {});
    }
  }, [open, initial]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;
  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const toggle = (key: string, id: number | string) => {
    const arr = (form[key] as (number | string)[]) ?? [];
    set(key, arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  };

  const handleSave = async () => {
    const payload: Record<string, unknown> = {
      firstName: String(form.firstName ?? "").trim(),
      lastName: String(form.lastName ?? "").trim(),
      username: String(form.username ?? "").trim(),
      email: String(form.email ?? "").trim(),
      active: !!form.active,
      roleIds: (form.roleIds as number[]) ?? [],
      databaseIds: (form.databaseIds as string[]) ?? [],
      datasetIds: (form.datasetIds as number[]) ?? [],
    };
    if (!isEdit && String(form.password ?? "").trim()) payload.password = String(form.password);
    if (!payload.username || !payload.firstName || !payload.email) return;
    setSaving(true);
    try { await onSave(payload); onClose(); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <button aria-label="Close editor" onClick={onClose} className="bg-foreground/20 flex-1 backdrop-blur-sm" />
      <div className="bg-card border-border flex w-full max-w-[640px] flex-col border-l shadow-xl">
        <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight">{isEdit ? "Edit user" : "Add user"}</h2>
            <p className="text-muted-foreground mt-1 max-w-[44ch] text-xs leading-relaxed">Create or update a user, assign roles and data access.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:bg-accent grid h-8 w-8 place-items-center rounded-md"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5"><span className="text-xs font-medium">First name *</span><Input value={String(form.firstName ?? "")} onChange={(e) => set("firstName", e.target.value)} placeholder="Admin" /></label>
              <label className="space-y-1.5"><span className="text-xs font-medium">Last name</span><Input value={String(form.lastName ?? "")} onChange={(e) => set("lastName", e.target.value)} placeholder="User" /></label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5"><span className="text-xs font-medium">Username *</span><Input value={String(form.username ?? "")} onChange={(e) => set("username", e.target.value)} placeholder="admin_user" /></label>
              <label className="space-y-1.5"><span className="text-xs font-medium">Email *</span><Input value={String(form.email ?? "")} onChange={(e) => set("email", e.target.value)} placeholder="admin@example.com" /></label>
            </div>
            {!isEdit && (
              <label className="space-y-1.5"><span className="text-xs font-medium">Password {isEdit ? "" : "*"}</span><Input type="password" value={String(form.password ?? "")} onChange={(e) => set("password", e.target.value)} placeholder="Set on create" /></label>
            )}
            <label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={!!form.active} onChange={(e) => set("active", e.target.checked)} className="accent-primary h-3.5 w-3.5" /> Active</label>

            <div className="space-y-2">
              <span className="flex items-center gap-1.5 text-xs font-medium"><Shield className="h-3.5 w-3.5" /> Roles</span>
              {roleOpts.length === 0 ? <p className="text-muted-foreground text-xs">No roles. Create one in Roles first.</p> : (
                <div className="border-border grid gap-1.5 rounded-md border p-3 sm:grid-cols-2">
                  {roleOpts.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={((form.roleIds as number[]) ?? []).includes(r.id)} onChange={() => toggle("roleIds", r.id)} className="accent-primary h-3.5 w-3.5" />{r.name}</label>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <span className="flex items-center gap-1.5 text-xs font-medium"><Database className="h-3.5 w-3.5" /> Database access</span>
              {dbOpts.length === 0 ? <p className="text-muted-foreground text-xs">No databases.</p> : (
                <div className="border-border grid gap-1.5 rounded-md border p-3 sm:grid-cols-2">
                  {dbOpts.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={((form.databaseIds as string[]) ?? []).includes(d.id)} onChange={() => toggle("databaseIds", d.id)} className="accent-primary h-3.5 w-3.5" />{d.name}</label>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <span className="flex items-center gap-1.5 text-xs font-medium"><Layers className="h-3.5 w-3.5" /> Datasource access</span>
              {dsOpts.length === 0 ? <p className="text-muted-foreground text-xs">No datasets.</p> : (
                <div className="border-border grid max-h-40 gap-1.5 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                  {dsOpts.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={((form.datasetIds as number[]) ?? []).includes(d.id)} onChange={() => toggle("datasetIds", d.id)} className="accent-primary h-3.5 w-3.5" /><span className="truncate">{d.name}</span></label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="border-border flex items-center gap-2 border-t px-5 py-4">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="ml-auto" disabled={saving || !String(form.username ?? "").trim() || !String(form.email ?? "").trim()} onClick={handleSave}>{saving ? "Saving…" : isEdit ? "Save changes" : "Create user"}</Button>
        </div>
      </div>
    </div>
  );
}
