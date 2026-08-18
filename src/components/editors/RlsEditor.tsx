import { useEffect, useState } from "react";
import { Database, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onClose: () => void;
  initial: Record<string, unknown> | null;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

type RoleOpt = { id: number; name: string };
type DbTableOpt = { databaseId: string; dbName: string; schema: string; table: string };

export function RlsEditor({ open, onClose, initial, onSave }: Props) {
  const isEdit = !!initial;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [roleOpts, setRoleOpts] = useState<RoleOpt[]>([]);
  const [tableOpts, setTableOpts] = useState<DbTableOpt[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const init = (initial ?? {}) as Record<string, unknown>;
    const tables =
      (init.tables as { table: string; schema: string; databaseId: string }[]) ??
      (init.tables as unknown as DbTableOpt[] | undefined) ??
      [];
    setForm({
      name: (init.name as string) ?? "",
      filterType: (init.filterType as string) ?? "regular",
      clause: (init.clause as string) ?? "",
      groupKey: (init.groupKey as string) ?? "",
      description: (init.description as string) ?? "",
      roleIds: (init.roleIds as number[]) ?? (init.roles as string[]) ?? [],
    });
    setSelectedTables(tables.map((t) => `${t.databaseId}.${t.schema}.${t.table}`));
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/roles?pageSize=50")
      .then((r) => r.json())
      .then((j: { data: RoleOpt[] }) => setRoleOpts(j.data ?? []))
      .catch(() => {});
    fetch("/api/databases?pageSize=50")
      .then((r) => r.json())
      .then(
        (j: {
          data: {
            id: string;
            name: string;
            schemas?: { name: string; tables: { name: string }[] }[];
          }[];
        }) => {
          const opts: DbTableOpt[] = [];
          for (const db of j.data ?? []) {
            const schemas: { name: string; tables: { name: string }[] }[] =
              (db as unknown as { schemas: { name: string; tables: { name: string }[] }[] })
                .schemas ?? [];
            // fallback: if no schemas, at least offer db.public.table placeholder not selectable — skip
            for (const s of schemas)
              for (const t of s.tables ?? [])
                opts.push({ databaseId: db.id, dbName: db.name, schema: s.name, table: t.name });
          }
          // if empty, fetch from datasets as fallback (datasets have databaseId/schema/tableName)
          if (opts.length === 0) {
            fetch("/api/datasets?pageSize=50")
              .then((rr) => rr.json())
              .then(
                (jj: {
                  data: {
                    databaseId: string;
                    schema: string;
                    tableName: string | null;
                    name: string;
                  }[];
                }) => {
                  for (const d of jj.data ?? [])
                    if (d.tableName)
                      opts.push({
                        databaseId: d.databaseId,
                        dbName: d.databaseId,
                        schema: d.schema,
                        table: d.tableName,
                      });
                  setTableOpts(opts);
                },
              )
              .catch(() => setTableOpts(opts));
          } else setTableOpts(opts);
        },
      )
      .catch(() => {});
    if (initial && (initial as Record<string, unknown>).id) {
      const id = (initial as Record<string, unknown>).id as number;
      fetch(`/api/rowlevelsecurity/${id}`)
        .then((r) => r.json())
        .then((j: { data: Record<string, unknown> }) => {
          if (j.data) {
            setForm((p) => ({
              ...p,
              roleIds: (j.data.roleIds as number[]) ?? p.roleIds,
              name: (j.data.name as string) ?? p.name,
              filterType: (j.data.filterType as string) ?? p.filterType,
              clause: (j.data.clause as string) ?? p.clause,
              groupKey: (j.data.groupKey as string) ?? p.groupKey,
              description: (j.data.description as string) ?? p.description,
            }));
            const tbls =
              (j.data.tables as { tableName: string; schemaName: string; databaseId: string }[]) ??
              [];
            setSelectedTables(tbls.map((t) => `${t.databaseId}.${t.schemaName}.${t.tableName}`));
          }
        })
        .catch(() => {});
    }
  }, [open, initial]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;
  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));
  const toggleRole = (id: number) => {
    const arr = (form.roleIds as number[]) ?? [];
    set("roleIds", arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  };
  const toggleTable = (key: string) =>
    setSelectedTables((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );

  const handleSave = async () => {
    const name = String(form.name ?? "").trim();
    const clause = String(form.clause ?? "").trim();
    if (!name || !clause) return;
    const tables = selectedTables.map((k) => {
      const [databaseId, schemaName, tableName] = k.split(".");
      return { databaseId, schemaName, tableName };
    });
    const payload = {
      name,
      filterType: String(form.filterType ?? "regular"),
      clause,
      groupKey: String(form.groupKey ?? "").trim() || null,
      description: String(form.description ?? "").trim() || null,
      roleIds: (form.roleIds as number[]) ?? [],
      tables,
    };
    setSaving(true);
    try {
      await onSave(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <button
        aria-label="Close editor"
        onClick={onClose}
        className="bg-foreground/20 flex-1 backdrop-blur-sm"
      />
      <div className="bg-card border-border flex w-full max-w-[640px] flex-col border-l shadow-xl">
        <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight">
              {isEdit ? "Edit RLS filter" : "Add RLS filter"}
            </h2>
            <p className="text-muted-foreground mt-1 max-w-[44ch] text-xs leading-relaxed">
              Row-level clause applied per role. Use{" "}
              <code className="bg-muted rounded px-1">WHERE</code> syntax; groupKey scopes the
              filter to a dataset group.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-accent grid h-8 w-8 place-items-center rounded-md"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-medium">Name *</span>
                <Input
                  value={String(form.name ?? "")}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Orders, Public region"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium">Filter type</span>
                <div className="relative">
                  <select
                    value={String(form.filterType ?? "regular")}
                    onChange={(e) => set("filterType", e.target.value)}
                    className="border-input bg-background h-9 w-full rounded-md border px-3 pr-8 text-sm"
                  >
                    <option value="regular">regular</option>
                    <option value="base">base</option>
                  </select>
                </div>
              </label>
            </div>
            <label className="space-y-1.5">
              <span className="text-xs font-medium">
                Clause *{" "}
                <span className="text-muted-foreground font-normal">— SQL WHERE condition</span>
              </span>
              <textarea
                value={String(form.clause ?? "")}
                onChange={(e) => set("clause", e.target.value)}
                rows={3}
                placeholder="region = 'EMEA'  or  owner_id = current_user_id()"
                className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-xs"
              />
              <span className="text-muted-foreground text-[11px]">
                Appended as <code className="bg-muted rounded px-1">WHERE clause</code> to queries
                on the selected tables.
              </span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-medium">Group key</span>
                <Input
                  value={String(form.groupKey ?? "")}
                  onChange={(e) => set("groupKey", e.target.value)}
                  placeholder="orders"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium">Description</span>
                <Input
                  value={String(form.description ?? "")}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Why this filter exists."
                />
              </label>
            </div>

            <div className="space-y-2">
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <Shield className="h-3.5 w-3.5" /> Roles
              </span>
              {roleOpts.length === 0 ? (
                <p className="text-muted-foreground text-xs">No roles.</p>
              ) : (
                <div className="border-border grid gap-1.5 rounded-md border p-3 sm:grid-cols-2">
                  {roleOpts.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={((form.roleIds as number[]) ?? []).includes(r.id)}
                        onChange={() => toggleRole(r.id)}
                        className="accent-primary h-3.5 w-3.5"
                      />
                      {r.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <Database className="h-3.5 w-3.5" /> Tables — db.schema.table
              </span>
              {tableOpts.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  No tables discovered. Pick from datasets fallback; or create a database/table
                  first.
                </p>
              ) : (
                <div className="border-border grid max-h-48 gap-1.5 overflow-y-auto rounded-md border p-3">
                  {tableOpts.map((t) => {
                    const key = `${t.databaseId}.${t.schema}.${t.table}`;
                    return (
                      <label key={key} className="flex items-center gap-2 font-mono text-xs">
                        <input
                          type="checkbox"
                          checked={selectedTables.includes(key)}
                          onChange={() => toggleTable(key)}
                          className="accent-primary h-3.5 w-3.5"
                        />
                        <span className="truncate">
                          {t.dbName}.{t.schema}.{t.table}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {selectedTables.length > 0 && (
                <p className="text-muted-foreground text-[11px]">
                  {selectedTables.length} table(s) selected.
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="border-border flex items-center gap-2 border-t px-5 py-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="ml-auto"
            disabled={
              saving || !String(form.name ?? "").trim() || !String(form.clause ?? "").trim()
            }
            onClick={handleSave}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create filter"}
          </Button>
        </div>
      </div>
    </div>
  );
}
