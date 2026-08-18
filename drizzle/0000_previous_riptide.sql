CREATE TABLE "action_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" varchar(64) NOT NULL,
	"object_type" varchar(64) NOT NULL,
	"object_id" integer,
	"dashboard_id" integer,
	"chart_id" integer,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"host" text NOT NULL,
	"api_key" text DEFAULT '' NOT NULL,
	"model" varchar(128) NOT NULL,
	"temperature" numeric(3, 2) DEFAULT '0.20' NOT NULL,
	"max_tokens" integer DEFAULT 4096 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"modified_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"alert_id" integer NOT NULL,
	"status" varchar(16) NOT NULL,
	"triggered" boolean DEFAULT false NOT NULL,
	"error_message" text,
	"rows_returned" integer,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(64) NOT NULL,
	"trigger" varchar(128) NOT NULL,
	"schedule" varchar(64) NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"last_run" timestamp with time zone,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"validation_type" varchar(64),
	"threshold" varchar(64),
	"sql_query" text,
	"delivery_type" varchar(16) DEFAULT 'email' NOT NULL,
	"recipients" text[],
	"message" text,
	"log_retention_days" integer DEFAULT 30 NOT NULL,
	"created_by_id" integer,
	"modified_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "annotation_layers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"annotation_type" varchar(32) NOT NULL,
	"start_field" text,
	"end_field" text,
	"json_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "annotation_layers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "chart_owners" (
	"chart_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	CONSTRAINT "chart_owners_chart_id_user_id_pk" PRIMARY KEY("chart_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "chart_tags" (
	"chart_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "chart_tags_chart_id_tag_id_pk" PRIMARY KEY("chart_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "charts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"viz_type" varchar(32) NOT NULL,
	"dataset_id" integer,
	"description" text,
	"certified" boolean DEFAULT false NOT NULL,
	"modified_by_id" integer,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "css_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"css_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "css_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "dashboard_owners" (
	"dashboard_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	CONSTRAINT "dashboard_owners_dashboard_id_user_id_pk" PRIMARY KEY("dashboard_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "dashboard_tags" (
	"dashboard_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "dashboard_tags_dashboard_id_tag_id_pk" PRIMARY KEY("dashboard_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "dashboards" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"status" varchar(16) NOT NULL,
	"description" text,
	"certified" boolean DEFAULT false NOT NULL,
	"layout" jsonb,
	"css_template_id" integer,
	"modified_by_id" integer,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dashboards_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "database_access" (
	"user_id" integer NOT NULL,
	"database_id" text NOT NULL,
	CONSTRAINT "database_access_user_id_database_id_pk" PRIMARY KEY("user_id","database_id")
);
--> statement-breakpoint
CREATE TABLE "database_schemas" (
	"id" serial PRIMARY KEY NOT NULL,
	"database_id" text NOT NULL,
	"name" varchar(128) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "database_table_columns" (
	"id" serial PRIMARY KEY NOT NULL,
	"table_id" integer NOT NULL,
	"name" varchar(128) NOT NULL,
	"type" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "database_tables" (
	"id" serial PRIMARY KEY NOT NULL,
	"schema_id" integer NOT NULL,
	"name" varchar(128) NOT NULL,
	"row_count" integer
);
--> statement-breakpoint
CREATE TABLE "databases" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"backend" varchar(32) NOT NULL,
	"sqlalchemy_uri" text NOT NULL,
	"expose_in_sql_lab" boolean DEFAULT true NOT NULL,
	"allow_run_sync" boolean DEFAULT true NOT NULL,
	"allow_dml" boolean DEFAULT false NOT NULL,
	"allow_cta" boolean DEFAULT false NOT NULL,
	"allow_csv_upload" boolean DEFAULT false NOT NULL,
	"secure_extra" text,
	"encrypted_extra" text,
	"server_cert" text,
	"extra" text,
	"impersonate_user" boolean DEFAULT false NOT NULL,
	"query_cache" boolean DEFAULT false NOT NULL,
	"cache_timeout" integer,
	"async_execution" boolean DEFAULT false NOT NULL,
	"concurrency" integer,
	"force_sql_lab" boolean DEFAULT false NOT NULL,
	"template_params" jsonb,
	"query_timeout" integer,
	"max_rows" integer,
	"default_schema" varchar(128),
	"default_limit" integer,
	"version" varchar(32),
	"schema_cache" boolean DEFAULT false NOT NULL,
	"ssh_tunnel_host" varchar(255),
	"ssh_tunnel_port" integer,
	"modified_by_id" integer,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dataset_columns" (
	"id" serial PRIMARY KEY NOT NULL,
	"dataset_id" integer NOT NULL,
	"name" varchar(128) NOT NULL,
	"type" varchar(64) NOT NULL,
	"groupable" boolean DEFAULT false NOT NULL,
	"filterable" boolean DEFAULT false NOT NULL,
	"description" text,
	"expression" text
);
--> statement-breakpoint
CREATE TABLE "dataset_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"dataset_id" integer NOT NULL,
	"name" varchar(128) NOT NULL,
	"sql_expression" text NOT NULL,
	"d3_format" varchar(32),
	"warning_text" text,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "dataset_sample_rows" (
	"id" serial PRIMARY KEY NOT NULL,
	"dataset_id" integer NOT NULL,
	"row_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "datasets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"database_id" text NOT NULL,
	"schema" varchar(128) NOT NULL,
	"table_name" varchar(128),
	"type" varchar(16) NOT NULL,
	"main_datetime_column" varchar(128),
	"description" text,
	"sql" text,
	"default_endpoint" varchar(255),
	"time_grain" varchar(32),
	"cache_timeout" integer,
	"offset" integer,
	"fetch_values_predicate" text,
	"template_params" jsonb,
	"modified_by_id" integer,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "datasource_access" (
	"user_id" integer NOT NULL,
	"dataset_id" integer NOT NULL,
	CONSTRAINT "datasource_access_user_id_dataset_id_pk" PRIMARY KEY("user_id","dataset_id")
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"entity_type" varchar(16) NOT NULL,
	"entity_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_hashes" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"view" varchar(64) NOT NULL,
	"action" varchar(32) NOT NULL,
	"description" text,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "query_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"sql" text NOT NULL,
	"database_id" text,
	"schema" varchar(128),
	"user_id" integer,
	"status" varchar(16) NOT NULL,
	"rows" integer,
	"duration_ms" integer,
	"error_message" text,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"status" varchar(16) NOT NULL,
	"error_message" text,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(64) NOT NULL,
	"schedule" varchar(64) NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"last_run" timestamp with time zone,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"delivery_type" varchar(16) DEFAULT 'email' NOT NULL,
	"recipients" text[],
	"message" text,
	"log_retention_days" integer DEFAULT 30 NOT NULL,
	"dashboard_id" integer,
	"chart_id" integer,
	"filter_values" jsonb,
	"created_by_id" integer,
	"modified_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rls_filter_roles" (
	"filter_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	CONSTRAINT "rls_filter_roles_filter_id_role_id_pk" PRIMARY KEY("filter_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "rls_filter_tables" (
	"id" serial PRIMARY KEY NOT NULL,
	"filter_id" integer NOT NULL,
	"table_name" varchar(128) NOT NULL,
	"schema_name" varchar(128) NOT NULL,
	"database_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "row_level_security_filters" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"filter_type" varchar(16) NOT NULL,
	"clause" text NOT NULL,
	"group_key" varchar(128),
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "row_level_security_filters_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "saved_queries" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" varchar(255) NOT NULL,
	"sql" text NOT NULL,
	"database_id" text,
	"schema" varchar(128),
	"description" text,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"type" varchar(32),
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(64) NOT NULL,
	"first_name" varchar(64) NOT NULL,
	"last_name" varchar(64) NOT NULL,
	"email" varchar(255) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "action_log" ADD CONSTRAINT "action_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_log" ADD CONSTRAINT "action_log_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_log" ADD CONSTRAINT "action_log_chart_id_charts_id_fk" FOREIGN KEY ("chart_id") REFERENCES "public"."charts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_modified_by_id_users_id_fk" FOREIGN KEY ("modified_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_runs" ADD CONSTRAINT "alert_runs_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_modified_by_id_users_id_fk" FOREIGN KEY ("modified_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_owners" ADD CONSTRAINT "chart_owners_chart_id_charts_id_fk" FOREIGN KEY ("chart_id") REFERENCES "public"."charts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_owners" ADD CONSTRAINT "chart_owners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_tags" ADD CONSTRAINT "chart_tags_chart_id_charts_id_fk" FOREIGN KEY ("chart_id") REFERENCES "public"."charts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_tags" ADD CONSTRAINT "chart_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charts" ADD CONSTRAINT "charts_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charts" ADD CONSTRAINT "charts_modified_by_id_users_id_fk" FOREIGN KEY ("modified_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charts" ADD CONSTRAINT "charts_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_owners" ADD CONSTRAINT "dashboard_owners_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_owners" ADD CONSTRAINT "dashboard_owners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_tags" ADD CONSTRAINT "dashboard_tags_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_tags" ADD CONSTRAINT "dashboard_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_modified_by_id_users_id_fk" FOREIGN KEY ("modified_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_access" ADD CONSTRAINT "database_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_access" ADD CONSTRAINT "database_access_database_id_databases_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."databases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_schemas" ADD CONSTRAINT "database_schemas_database_id_databases_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."databases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_table_columns" ADD CONSTRAINT "database_table_columns_table_id_database_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."database_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_tables" ADD CONSTRAINT "database_tables_schema_id_database_schemas_id_fk" FOREIGN KEY ("schema_id") REFERENCES "public"."database_schemas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "databases" ADD CONSTRAINT "databases_modified_by_id_users_id_fk" FOREIGN KEY ("modified_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "databases" ADD CONSTRAINT "databases_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataset_columns" ADD CONSTRAINT "dataset_columns_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataset_metrics" ADD CONSTRAINT "dataset_metrics_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataset_sample_rows" ADD CONSTRAINT "dataset_sample_rows_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_database_id_databases_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."databases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_modified_by_id_users_id_fk" FOREIGN KEY ("modified_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "datasource_access" ADD CONSTRAINT "datasource_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "datasource_access" ADD CONSTRAINT "datasource_access_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_hashes" ADD CONSTRAINT "password_hashes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_history" ADD CONSTRAINT "query_history_database_id_databases_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."databases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_history" ADD CONSTRAINT "query_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_runs" ADD CONSTRAINT "report_runs_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_chart_id_charts_id_fk" FOREIGN KEY ("chart_id") REFERENCES "public"."charts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_modified_by_id_users_id_fk" FOREIGN KEY ("modified_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rls_filter_roles" ADD CONSTRAINT "rls_filter_roles_filter_id_row_level_security_filters_id_fk" FOREIGN KEY ("filter_id") REFERENCES "public"."row_level_security_filters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rls_filter_roles" ADD CONSTRAINT "rls_filter_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rls_filter_tables" ADD CONSTRAINT "rls_filter_tables_filter_id_row_level_security_filters_id_fk" FOREIGN KEY ("filter_id") REFERENCES "public"."row_level_security_filters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rls_filter_tables" ADD CONSTRAINT "rls_filter_tables_database_id_databases_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."databases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_queries" ADD CONSTRAINT "saved_queries_database_id_databases_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."databases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_queries" ADD CONSTRAINT "saved_queries_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;