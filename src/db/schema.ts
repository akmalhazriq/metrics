import { boolean, integer, jsonb, numeric, pgTable, serial, text, timestamp, varchar, primaryKey } from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Users — mirrors src/types/database.ts owners / modifiedBy references
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  firstName: varchar("first_name", { length: 64 }).notNull(),
  lastName: varchar("last_name", { length: 64 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Databases — faithful to DatabaseConnection in src/types/database.ts
// id is TEXT PK to preserve seed ids ("analytics", "warehouse", …)
// ---------------------------------------------------------------------------
export const databases = pgTable("databases", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  backend: varchar("backend", { length: 32 }).notNull(),
  sqlalchemyUri: text("sqlalchemy_uri").notNull(),
  exposeInSqlLab: boolean("expose_in_sql_lab").notNull().default(true),
  allowRunSync: boolean("allow_run_sync").notNull().default(true),
  allowDml: boolean("allow_dml").notNull().default(false),
  allowCta: boolean("allow_cta").notNull().default(false),
  allowCsvUpload: boolean("allow_csv_upload").notNull().default(false),
  secureExtra: text("secure_extra"),
  encryptedExtra: text("encrypted_extra"),
  serverCert: text("server_cert"),
  // extraParams in type → extra column in spec
  extra: text("extra"),
  impersonateUser: boolean("impersonate_user").notNull().default(false),
  // Performance
  queryCache: boolean("query_cache").notNull().default(false),
  cacheTimeout: integer("cache_timeout"),
  asyncExecution: boolean("async_execution").notNull().default(false),
  concurrency: integer("concurrency"),
  forceSqlLab: boolean("force_sql_lab").notNull().default(false),
  templateParams: jsonb("template_params"),
  // SQL Lab settings
  queryTimeout: integer("query_timeout"),
  maxRows: integer("max_rows"),
  defaultSchema: varchar("default_schema", { length: 128 }),
  defaultLimit: integer("default_limit"),
  // Advanced
  version: varchar("version", { length: 32 }),
  schemaCache: boolean("schema_cache").notNull().default(false),
  sshTunnelHost: varchar("ssh_tunnel_host", { length: 255 }),
  sshTunnelPort: integer("ssh_tunnel_port"),
  // Ownership / audit
  modifiedById: integer("modified_by_id").references(() => users.id),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Database sub-entities — mirrors SqlSchema / SqlTable / SqlColumn
// ---------------------------------------------------------------------------
export const databaseSchemas = pgTable("database_schemas", {
  id: serial("id").primaryKey(),
  databaseId: text("database_id")
    .notNull()
    .references(() => databases.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 128 }).notNull(),
});

export const databaseTables = pgTable("database_tables", {
  id: serial("id").primaryKey(),
  schemaId: integer("schema_id")
    .notNull()
    .references(() => databaseSchemas.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 128 }).notNull(),
  rowCount: integer("row_count"),
});

export const databaseTableColumns = pgTable("database_table_columns", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id")
    .notNull()
    .references(() => databaseTables.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 128 }).notNull(),
  type: varchar("type", { length: 64 }).notNull(),
});

// ---------------------------------------------------------------------------
// Datasets — mirrors Dataset in src/types/dataset.ts
// ---------------------------------------------------------------------------
export const datasets = pgTable("datasets", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  databaseId: text("database_id")
    .notNull()
    .references(() => databases.id),
  schema: varchar("schema", { length: 128 }).notNull(),
  tableName: varchar("table_name", { length: 128 }),
  type: varchar("type", { length: 16 }).notNull(), // physical | virtual
  mainDatetimeColumn: varchar("main_datetime_column", { length: 128 }),
  description: text("description"),
  sql: text("sql"),
  defaultEndpoint: varchar("default_endpoint", { length: 255 }),
  timeGrain: varchar("time_grain", { length: 32 }),
  cacheTimeout: integer("cache_timeout"),
  offset: integer("offset"),
  fetchValuesPredicate: text("fetch_values_predicate"),
  templateParams: jsonb("template_params"),
  modifiedById: integer("modified_by_id").references(() => users.id),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull().defaultNow(),
});

export const datasetColumns = pgTable("dataset_columns", {
  id: serial("id").primaryKey(),
  datasetId: integer("dataset_id")
    .notNull()
    .references(() => datasets.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 128 }).notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  groupable: boolean("groupable").notNull().default(false),
  filterable: boolean("filterable").notNull().default(false),
  description: text("description"),
  expression: text("expression"),
});

export const datasetMetrics = pgTable("dataset_metrics", {
  id: serial("id").primaryKey(),
  datasetId: integer("dataset_id")
    .notNull()
    .references(() => datasets.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 128 }).notNull(),
  sqlExpression: text("sql_expression").notNull(),
  d3Format: varchar("d3_format", { length: 32 }),
  warningText: text("warning_text"),
  description: text("description"),
});

export const datasetSampleRows = pgTable("dataset_sample_rows", {
  id: serial("id").primaryKey(),
  datasetId: integer("dataset_id")
    .notNull()
    .references(() => datasets.id, { onDelete: "cascade" }),
  rowData: jsonb("row_data").notNull(),
});

// ---------------------------------------------------------------------------
// Tags + M2M
// ---------------------------------------------------------------------------
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  type: varchar("type", { length: 32 }),
});

export const chartTags = pgTable(
  "chart_tags",
  {
    chartId: integer("chart_id")
      .notNull()
      .references(() => charts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.chartId, t.tagId] })],
);

export const dashboardTags = pgTable(
  "dashboard_tags",
  {
    dashboardId: integer("dashboard_id")
      .notNull()
      .references(() => dashboards.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.dashboardId, t.tagId] })],
);

// ---------------------------------------------------------------------------
// Owners — single junction pattern per spec
// ---------------------------------------------------------------------------
export const chartOwners = pgTable(
  "chart_owners",
  {
    chartId: integer("chart_id")
      .notNull()
      .references(() => charts.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.chartId, t.userId] })],
);

export const dashboardOwners = pgTable(
  "dashboard_owners",
  {
    dashboardId: integer("dashboard_id")
      .notNull()
      .references(() => dashboards.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.dashboardId, t.userId] })],
);

// ---------------------------------------------------------------------------
// Favorites — mirrors favorite boolean on charts/dashboards per user
// ---------------------------------------------------------------------------
export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  entityType: varchar("entity_type", { length: 16 }).notNull(), // chart | dashboard
  entityId: integer("entity_id").notNull(),
});

// ---------------------------------------------------------------------------
// Charts — mirrors Chart in src/types/chart.ts (normalized: dataset FK)
// ---------------------------------------------------------------------------
export const charts = pgTable("charts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  vizType: varchar("viz_type", { length: 32 }).notNull(),
  datasetId: integer("dataset_id").references(() => datasets.id),
  description: text("description"),
  certified: boolean("certified").notNull().default(false),
  modifiedById: integer("modified_by_id").references(() => users.id),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Dashboards — mirrors Dashboard in src/types/dashboard.ts
// ---------------------------------------------------------------------------
export const dashboards = pgTable("dashboards", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  status: varchar("status", { length: 16 }).notNull(), // published | draft | archived
  description: text("description"),
  certified: boolean("certified").notNull().default(false),
  layout: jsonb("layout"),
  cssTemplateId: integer("css_template_id"), // nullable FK — added later
  modifiedById: integer("modified_by_id").references(() => users.id),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// SQL Lab — mirrors SavedQuery / QueryHistoryEntry in src/types/sqllab.ts
// ---------------------------------------------------------------------------
export const savedQueries = pgTable("saved_queries", {
  id: serial("id").primaryKey(),
  label: varchar("label", { length: 255 }).notNull(),
  sql: text("sql").notNull(),
  databaseId: text("database_id").references(() => databases.id),
  schema: varchar("schema", { length: 128 }),
  description: text("description"),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull().defaultNow(),
});

export const queryHistory = pgTable("query_history", {
  id: serial("id").primaryKey(),
  sql: text("sql").notNull(),
  databaseId: text("database_id").references(() => databases.id),
  schema: varchar("schema", { length: 128 }),
  userId: integer("user_id").references(() => users.id),
  status: varchar("status", { length: 16 }).notNull(), // success | error | running
  rows: integer("rows"),
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Alerts & Reports — per Group B spec
// ---------------------------------------------------------------------------
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  trigger: varchar("trigger", { length: 128 }).notNull(),
  schedule: varchar("schedule", { length: 64 }).notNull(), // cron
  timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
  lastRun: timestamp("last_run", { withTimezone: true }),
  status: varchar("status", { length: 16 }).notNull().default("active"), // active | paused | error
  active: boolean("active").notNull().default(true),
  validationType: varchar("validation_type", { length: 64 }),
  threshold: varchar("threshold", { length: 64 }),
  sqlQuery: text("sql_query"),
  deliveryType: varchar("delivery_type", { length: 16 }).notNull().default("email"), // email | slack | webhook
  recipients: text("recipients").array(),
  message: text("message"),
  logRetentionDays: integer("log_retention_days").notNull().default(30),
  createdById: integer("created_by_id").references(() => users.id),
  modifiedById: integer("modified_by_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull().defaultNow(),
});

export const alertRuns = pgTable("alert_runs", {
  id: serial("id").primaryKey(),
  alertId: integer("alert_id")
    .notNull()
    .references(() => alerts.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 16 }).notNull(), // success | error | skipped
  triggered: boolean("triggered").notNull().default(false),
  errorMessage: text("error_message"),
  rowsReturned: integer("rows_returned"),
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  schedule: varchar("schedule", { length: 64 }).notNull(),
  timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
  lastRun: timestamp("last_run", { withTimezone: true }),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  active: boolean("active").notNull().default(true),
  deliveryType: varchar("delivery_type", { length: 16 }).notNull().default("email"),
  recipients: text("recipients").array(),
  message: text("message"),
  logRetentionDays: integer("log_retention_days").notNull().default(30),
  dashboardId: integer("dashboard_id").references(() => dashboards.id, { onDelete: "set null" }),
  chartId: integer("chart_id").references(() => charts.id, { onDelete: "set null" }),
  filterValues: jsonb("filter_values"),
  createdById: integer("created_by_id").references(() => users.id),
  modifiedById: integer("modified_by_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reportRuns = pgTable("report_runs", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 16 }).notNull(),
  errorMessage: text("error_message"),
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Admin — roles, permissions, junctions, user access, RLS
// ---------------------------------------------------------------------------
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull().defaultNow(),
});

export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  view: varchar("view", { length: 64 }).notNull(),
  action: varchar("action", { length: 32 }).notNull(),
  description: text("description"),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: integer("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

export const databaseAccess = pgTable(
  "database_access",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    databaseId: text("database_id")
      .notNull()
      .references(() => databases.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.databaseId] })],
);

export const datasourceAccess = pgTable(
  "datasource_access",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    datasetId: integer("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.datasetId] })],
);

export const rowLevelSecurityFilters = pgTable("row_level_security_filters", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  filterType: varchar("filter_type", { length: 16 }).notNull(), // regular | base
  clause: text("clause").notNull(),
  groupKey: varchar("group_key", { length: 128 }),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rlsFilterTables = pgTable("rls_filter_tables", {
  id: serial("id").primaryKey(),
  filterId: integer("filter_id")
    .notNull()
    .references(() => rowLevelSecurityFilters.id, { onDelete: "cascade" }),
  tableName: varchar("table_name", { length: 128 }).notNull(),
  schemaName: varchar("schema_name", { length: 128 }).notNull(),
  databaseId: text("database_id")
    .notNull()
    .references(() => databases.id, { onDelete: "cascade" }),
});

export const rlsFilterRoles = pgTable(
  "rls_filter_roles",
  {
    filterId: integer("filter_id")
      .notNull()
      .references(() => rowLevelSecurityFilters.id, { onDelete: "cascade" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.filterId, t.roleId] })],
);

// ---------------------------------------------------------------------------
// Manage — annotation layers, CSS templates
// ---------------------------------------------------------------------------
export const annotationLayers = pgTable("annotation_layers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  annotationType: varchar("annotation_type", { length: 32 }).notNull(), // time series | interval | event
  startField: text("start_field"),
  endField: text("end_field"),
  jsonMetadata: jsonb("json_metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cssTemplates = pgTable("css_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  cssCode: text("css_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Action log — for later audit, defined now
// ---------------------------------------------------------------------------
export const actionLog = pgTable("action_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: varchar("action", { length: 64 }).notNull(),
  objectType: varchar("object_type", { length: 64 }).notNull(),
  objectId: integer("object_id"),
  dashboardId: integer("dashboard_id").references(() => dashboards.id),
  chartId: integer("chart_id").references(() => charts.id),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Auth — sessions + password hashes (dev-only plain-hash for seed)
// ---------------------------------------------------------------------------
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const passwordHashes = pgTable("password_hashes", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  hash: text("hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// AI settings — one active row drives all AI handlers; multiple allowed
// ---------------------------------------------------------------------------
export const aiSettings = pgTable("ai_settings", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  host: text("host").notNull(),
  apiKey: text("api_key").notNull().default(""),
  model: varchar("model", { length: 128 }).notNull(),
  temperature: numeric("temperature", { precision: 3, scale: 2 }).notNull().default("0.20"),
  maxTokens: integer("max_tokens").notNull().default(4096),
  isActive: boolean("is_active").notNull().default(true),
  modifiedById: integer("modified_by_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull().defaultNow(),
});
