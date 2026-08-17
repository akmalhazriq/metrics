import "dotenv/config";
import { sql } from "drizzle-orm";

import { db, pool } from "./index";
import {
  aiSettings,
  charts,
  dashboards,
  databaseSchemas,
  databaseTableColumns,
  databaseTables,
  databases,
  datasetColumns,
  datasetMetrics,
  datasetSampleRows,
  datasets,
  permissions,
  rolePermissions,
  roles,
} from "./schema";

import { seedCharts } from "../data/charts";
import { seedDashboards } from "../data/dashboards";
import { seedDatabases } from "../data/databases";
import { seedDatasets } from "../data/datasets";

async function truncateAll() {
  await db.execute(sql`
    TRUNCATE
      ai_settings,
      sessions,
      password_hashes,
      annotation_layers,
      css_templates,
      rls_filter_roles,
      rls_filter_tables,
      row_level_security_filters,
      datasource_access,
      database_access,
      user_roles,
      role_permissions,
      permissions,
      roles,
      report_runs,
      alert_runs,
      reports,
      alerts,
      action_log,
      query_history,
      saved_queries,
      favorites,
      dashboard_owners,
      chart_owners,
      dashboard_tags,
      chart_tags,
      tags,
      dataset_sample_rows,
      dataset_metrics,
      dataset_columns,
      datasets,
      database_table_columns,
      database_tables,
      database_schemas,
      dashboards,
      charts,
      databases,
      users
    RESTART IDENTITY CASCADE
  `);
}

function tryJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return raw; }
}

function nullableUserId(id: number | undefined): number | null {
  if (!id || id === 0) return null;
  return id;
}

async function main() {
  console.log("Seeding metrics_bi (minimal)…");
  await truncateAll();

  // Databases → schemas → tables → columns
  for (const d of seedDatabases) {
    await db.insert(databases).values({
      id: d.id,
      name: d.name,
      backend: d.backend,
      sqlalchemyUri: d.sqlalchemyUri,
      serverCert: d.serverCert ?? null,
      extra: d.extraParams ?? null,
      impersonateUser: d.impersonateUser,
      exposeInSqlLab: d.exposedInSqlLab,
      allowDml: d.allowDML,
      allowCta: d.allowCTA,
      allowCsvUpload: d.allowCsvUpload,
      allowRunSync: d.allowRunSync,
      secureExtra: (d.secureExtra as string) || null,
      encryptedExtra: (d.encryptedExtra as string) || null,
      queryCache: d.cacheEnabled,
      cacheTimeout: d.cacheTimeout ?? null,
      asyncExecution: d.asyncExecution,
      concurrency: d.concurrency ?? null,
      forceSqlLab: d.forceSqlLab,
      templateParams: d.templateParams ? tryJson(d.templateParams) : null,
      queryTimeout: d.queryTimeout ?? null,
      maxRows: d.maxRows ?? null,
      defaultSchema: d.defaultSchema ?? null,
      defaultLimit: d.defaultLimit ?? null,
      version: d.version ?? null,
      schemaCache: d.schemaCacheEnabled,
      sshTunnelHost: d.sshTunnelHost ?? null,
      sshTunnelPort: d.sshTunnelPort ?? null,
      modifiedById: nullableUserId(d.modifiedBy?.id),
      createdById: nullableUserId(d.owners[0]?.id ?? d.modifiedBy?.id),
    });
    for (const schema of d.schemas) {
      const [row] = await db.insert(databaseSchemas).values({ databaseId: d.id, name: schema.name }).returning({ id: databaseSchemas.id });
      for (const tbl of schema.tables) {
        const [trow] = await db.insert(databaseTables).values({ schemaId: row.id, name: tbl.name, rowCount: tbl.rowCount ?? null }).returning({ id: databaseTables.id });
        for (const col of tbl.columns) {
          await db.insert(databaseTableColumns).values({ tableId: trow.id, name: col.name, type: col.type });
        }
      }
    }
  }

  // Datasets → columns / metrics / sample rows
  const datasetNameToId = new Map<string, number>();
  for (const ds of seedDatasets) {
    const [row] = await db.insert(datasets).values({
      id: ds.id,
      name: ds.name,
      databaseId: ds.databaseId,
      schema: ds.schema,
      tableName: ds.table,
      type: ds.type,
      mainDatetimeColumn: ds.mainDatetimeColumn,
      description: ds.description ?? null,
      sql: ds.sql ?? null,
      defaultEndpoint: ds.defaultEndpoint ?? null,
      timeGrain: ds.timeGrain ?? null,
      cacheTimeout: ds.cacheTimeout ?? null,
      offset: ds.offset ?? null,
      fetchValuesPredicate: ds.fetchValuesPredicate ?? null,
      templateParams: ds.templateParams ? tryJson(ds.templateParams) : null,
      modifiedById: nullableUserId(ds.modifiedBy?.id),
      createdById: nullableUserId(ds.createdBy?.id),
    }).returning({ id: datasets.id });
    datasetNameToId.set(ds.name, row.id);
    for (const c of ds.columns) {
      await db.insert(datasetColumns).values({
        datasetId: row.id,
        name: c.name,
        type: c.type,
        groupable: c.groupable,
        filterable: c.filterable,
        description: c.description ?? null,
        expression: c.expression ?? null,
      });
    }
    for (const m of ds.metrics) {
      await db.insert(datasetMetrics).values({
        datasetId: row.id,
        name: m.name,
        sqlExpression: m.sqlExpression,
        d3Format: m.d3Format ?? null,
        warningText: m.warningText ?? null,
        description: m.description ?? null,
      });
    }
    if (ds.sampleRows?.length) {
      for (const r of ds.sampleRows) {
        await db.insert(datasetSampleRows).values({ datasetId: row.id, rowData: r as unknown as Record<string, unknown> });
      }
    }
  }
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('datasets','id'), (SELECT COALESCE(MAX(id),1) FROM datasets))`);

  // Charts (no tags/owners/favorites in minimal seed)
  for (const c of seedCharts) {
    const datasetId = datasetNameToId.get(c.dataset) ?? null;
    await db.insert(charts).values({
      id: c.id,
      name: c.name,
      slug: c.slug,
      vizType: c.vizType,
      datasetId,
      description: c.description ?? null,
      certified: c.certified ?? false,
      modifiedById: nullableUserId(c.modifiedBy?.id),
      createdById: nullableUserId(c.createdBy?.id),
      createdAt: new Date(c.modified),
      modifiedAt: new Date(c.modified),
    });
  }
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('charts','id'), (SELECT COALESCE(MAX(id),1) FROM charts))`);

  // Dashboard
  for (const d of seedDashboards) {
    await db.insert(dashboards).values({
      id: d.id,
      title: d.title,
      slug: d.slug,
      status: d.status,
      description: d.description ?? null,
      certified: d.certified ?? false,
      layout: (d.layout ?? []) as unknown as Record<string, unknown>,
      cssTemplateId: null,
      modifiedById: nullableUserId(d.modifiedBy?.id),
      createdById: nullableUserId(d.createdBy?.id),
      createdAt: new Date(d.modified),
      modifiedAt: new Date(d.modified),
    });
  }
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('dashboards','id'), (SELECT COALESCE(MAX(id),1) FROM dashboards))`);

  // Roles / permissions — minimal but complete
  const roleSeeds: { name: string; description: string }[] = [
    { name: "Admin", description: "Full access" },
    { name: "Analyst", description: "Can create and edit" },
    { name: "Viewer", description: "Read-only" },
  ];
  const roleIdByName = new Map<string, number>();
  for (const r of roleSeeds) {
    const [row] = await db.insert(roles).values({ name: r.name, description: r.description }).returning({ id: roles.id });
    roleIdByName.set(r.name, row.id);
  }
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('roles','id'), (SELECT COALESCE(MAX(id),1) FROM roles))`);

  const permSeeds: { name: string; view: string; action: string; description: string }[] = [
    { name: "dashboard:read", view: "dashboard", action: "read", description: "View dashboards" },
    { name: "dashboard:write", view: "dashboard", action: "write", description: "Create/edit dashboards" },
    { name: "dashboard:delete", view: "dashboard", action: "delete", description: "Delete dashboards" },
    { name: "chart:read", view: "chart", action: "read", description: "View charts" },
    { name: "chart:write", view: "chart", action: "write", description: "Create/edit charts" },
    { name: "chart:delete", view: "chart", action: "delete", description: "Delete charts" },
    { name: "sql_lab:read", view: "sql_lab", action: "read", description: "Use SQL Lab" },
    { name: "sql_lab:write", view: "sql_lab", action: "write", description: "Run SQL" },
    { name: "dataset:read", view: "dataset", action: "read", description: "View datasets" },
    { name: "dataset:write", view: "dataset", action: "write", description: "Edit datasets" },
    { name: "database:read", view: "database", action: "read", description: "View databases" },
    { name: "database:write", view: "database", action: "write", description: "Edit databases" },
    { name: "alert:read", view: "alert", action: "read", description: "View alerts" },
    { name: "alert:write", view: "alert", action: "write", description: "Manage alerts" },
    { name: "report:read", view: "report", action: "read", description: "View reports" },
    { name: "report:write", view: "report", action: "write", description: "Manage reports" },
    { name: "user:read", view: "user", action: "read", description: "View users" },
    { name: "user:write", view: "user", action: "write", description: "Manage users" },
    { name: "role:read", view: "role", action: "read", description: "View roles" },
    { name: "role:write", view: "role", action: "write", description: "Manage roles" },
    { name: "rls:read", view: "rls", action: "read", description: "View RLS filters" },
    { name: "rls:write", view: "rls", action: "write", description: "Manage RLS filters" },
  ];
  const permIdByName = new Map<string, number>();
  for (const p of permSeeds) {
    const [row] = await db.insert(permissions).values(p).returning({ id: permissions.id });
    permIdByName.set(p.name, row.id);
  }
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('permissions','id'), (SELECT COALESCE(MAX(id),1) FROM permissions))`);

  const adminId = roleIdByName.get("Admin")!;
  const analystId = roleIdByName.get("Analyst")!;
  const viewerId = roleIdByName.get("Viewer")!;
  for (const pid of permIdByName.values()) await db.insert(rolePermissions).values({ roleId: adminId, permissionId: pid }).onConflictDoNothing();
  for (const n of ["dashboard:read", "dashboard:write", "chart:read", "chart:write", "dataset:read", "dataset:write", "sql_lab:read", "sql_lab:write"] as const) {
    const pid = permIdByName.get(n);
    if (pid) await db.insert(rolePermissions).values({ roleId: analystId, permissionId: pid }).onConflictDoNothing();
  }
  for (const n of ["dashboard:read", "chart:read", "dataset:read"] as const) {
    const pid = permIdByName.get(n);
    if (pid) await db.insert(rolePermissions).values({ roleId: viewerId, permissionId: pid }).onConflictDoNothing();
  }

  // AI settings — inactive default
  await db.insert(aiSettings).values({
    name: "Primary LLM",
    host: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o",
    temperature: "0.20",
    maxTokens: 4096,
    isActive: false,
    modifiedById: null,
  });
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('ai_settings','id'), (SELECT COALESCE(MAX(id),1) FROM ai_settings))`);

  // Real readable tables for the dataset — analytics.public.orders / customers
  // Use the same Pool that the app runs SQL Lab against. Drop + recreate for idempotency.
  await pool.query(`DROP TABLE IF EXISTS public.customers CASCADE`);
  await pool.query(`DROP TABLE IF EXISTS public.orders CASCADE`);
  await pool.query(`
    CREATE TABLE public.orders (
      order_id integer PRIMARY KEY,
      customer_id integer NOT NULL,
      amount numeric NOT NULL,
      status varchar(32) NOT NULL,
      created_at timestamp NOT NULL,
      region varchar(32) NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE public.customers (
      customer_id integer PRIMARY KEY,
      email varchar(255) NOT NULL,
      region varchar(32) NOT NULL,
      created_at date NOT NULL
    )
  `);
  // Insert rows matching the dataset sampleRows (orders)
  const ordersRows = seedDatasets.find(d => d.name === "orders")!.sampleRows!;
  for (const r of ordersRows as unknown as { order_id: number; customer_id: number; amount: number; status: string; created_at: string; region: string }[]) {
    await pool.query(`INSERT INTO public.orders (order_id, customer_id, amount, status, created_at, region) VALUES ($1,$2,$3,$4,$5,$6)`, [r.order_id, r.customer_id, r.amount, r.status, r.created_at, r.region]);
  }
  const custRows = seedDatasets.find(d => d.name === "customers")!.sampleRows!;
  for (const r of custRows as unknown as { customer_id: number; email: string; region: string; created_at: string }[]) {
    await pool.query(`INSERT INTO public.customers (customer_id, email, region, created_at) VALUES ($1,$2,$3,$4)`, [r.customer_id, r.email, r.region, r.created_at]);
  }

  const ucRes = await pool.query(`SELECT COUNT(*)::int AS count FROM users`);
  const rcRes = await pool.query(`SELECT COUNT(*)::int AS count FROM roles`);
  const uc = (ucRes.rows[0] as { count: number }).count;
  const rc = (rcRes.rows[0] as { count: number }).count;
  console.log(`Seeded 1 database, ${seedDatasets.length} datasets, ${seedCharts.length} charts, ${seedDashboards.length} dashboard, ${rc} roles, ${permSeeds.length} permissions. users=${uc} (expected 0). public.orders=${ordersRows.length} rows, public.customers=${custRows.length} rows.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await pool.end(); });
