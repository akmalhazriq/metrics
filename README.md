# Metrics BI — AI-Native Superset Alternative

AI-native BI platform — real PostgreSQL, conversational analytics, NL-to-SQL, anomaly detection. Built on React 19 + Nitro 3 + Drizzle ORM.

This is **beta v1.0 (v1.0.0-beta.1)** — every Apache Superset reference page has a working equivalent, backed by real Postgres, with Phase 2 AI surfaces integrated directly into the relevant pages (not a bolted-on chatbot tab).

---

## Quick Start

**Prerequisites:** Node 18+, PostgreSQL 14+

```bash
git clone <repo>
cd metrics
npm install
cp .env.example .env   # edit DATABASE_URL
npm run db:push        # create tables (Drizzle Kit — dev, no migration file)
npm run db:seed        # seed minimal sample data (1 database · 2 datasets · 2 charts · 1 dashboard)
npm run dev            # start on http://localhost:5000
```

> **First-run note:** On first launch, open http://localhost:5000 — you'll be guided through creating your admin account. The setup screen only appears once (no users exist yet); later users are added from **Govern → Users**.

The dev server serves both the React frontend and the Nitro/H3 API on the same origin (`/api/*` via the `nitro()` Vite plugin). Production builds via `npm run build` (TS check + Vite); Docker stage serves `dist/` via nginx, PM2 alternative via `ecosystem.config.js`.

---

## Features

- **Dashboard Builder** — 12-col grid (header/markdown/divider/chart), cross-filtering (click a bar to filter other charts), drill-to-detail (right-click / header icon → row-level modal with pagination)
- **Chart Explore** — TanStack Charts (Bar `barY`, Line `lineY+dot`, Area `areaY`, Scatter `dot`, Heatmap `rect`, Box `boxY` + Table/Big Number), client-side aggregation of `sampleRows`, Save via `POST /api/charts`
- **SQL Lab** — real Postgres execution via shared `pg` Pool (READ ONLY, `statement_timeout 10s`), table tree from `GET /api/sqllab/databases`, query history + saved queries (standalone list pages with search/filter/pagination)
- **Conversational BI** — plain-language → chart/filter/explain/compare, always inspectable SQL + `Apply/Dismiss` (reviewable, reversible)
- **NL-to-SQL** — describe → editable SQL preview (never auto-run), real schema-aware
- **Self-healing queries** — `Diagnose` on error → visible `before→after` diff + fixed SQL → `Apply fix` (explicit confirm)
- **Anomaly / Insight surfacing** — ambient strip on dashboards (trend/spike/drop/outlier/correlation, severity `info|warning|critical`, `View SQL`, badge → highlight chart)
- **Configurable LLM provider** — OpenAI-compatible (`/settings/ai`, single-active invariant, `x-mock-ai: 1 → 0`, `POST /chat/completions` server-side only, 30s timeout)
- **RBAC** — Admin / Analyst / Viewer, `roles` → `role_permissions` → `permissions` (22), `database_access`/`datasource_access`, RLS filters
- **Alerts & Reports** — cron, delivery (email/Slack/webhook), `Test` validates via real handler
- **Manage** — Annotation Layers, CSS Templates, Tags, Import/Export (ZIP/JSON/YAML)
- **Admin** — Users, Roles, Permissions, Row Level Security, Action Log (`/log`), About (`/about`), Health (`/health`)
- **Auth** — first-run setup → sessions (Bearer/`x-session-token`), `RequireAuth` on both client (`src/hooks/useAuth.tsx` + global `window.fetch` patch + `AppShell` guard) and server (`src/lib/requireAuth.ts`, 85 handlers gated; `/api/auth/*`, `/api/setup/*`, `/api/health`, `/api/about` public)

---

## Screenshots

> Screenshots coming in the next docs pass. In the meantime, run `npm run dev` and visit:
> - `/welcome` — recent dashboards/charts, quick actions
> - `/dashboard/1` — Orders Overview (Bar + Table) with insights strip + cross-filtering
> - `/explore` — chart builder (try `?chartId=1` from Chart List)
> - `/sqllab` — SQL Lab with Ask AI + history

---

## Database

- `DATABASE_URL` in `.env` (gitignored, example in `.env.example`): `postgresql://postgres:postgres@localhost:5432/metrics_bi`
- Drizzle ORM — schema `src/db/schema.ts`, connection `src/db/index.ts` (sole `drizzle(pool,{schema})` via `pg` Pool), seed `src/db/seed.ts`
- Workflow: **dev** → `npm run db:push` (direct sync, no migration file), **prod** → `npm run db:generate` + `npm run db:migrate`
- Minimal seed: 1 database (`analytics` → Postgres `metrics_bi`), 2 datasets (`orders` 12 rows + `customers` 6), 2 charts, 1 dashboard — owners `Sample`, empty tags/favorites. Real tables `public.orders`/`public.customers` created via `pool.query DDL+INSERT` so `SELECT * FROM public.orders` hits live Postgres.

---

## Known Limitations / Deferred Features

This is a beta — core parity is complete, a few deeper lifts are intentionally deferred as honest stubs (see `CLAUDE.md` → **Known gaps (Phase 1)** and **Phase 2 progress → Remaining Phase 2 deferrals** for the full list):

- Chart builder: Pie/Donut/Violin/Treemap/Sunburst/Sankey/Gauge + annotations/metric-builder/embedded share are stubbed with honest `DeferredCard` reasons (TanStack 0.14.0 export boundary)
- Dashboard: tabs, drag-and-drop reordering/resizing (currently add/remove/span-select), CSS template picker, dashboard-level native filter config
- SQL Lab cross-filtering + drill-to-detail is Bar-only (Line/Area/Scatter/Heatmap/Box Plot deferred); drill-by-dimension + CSV export from drill modal deferred
- AI: API key encryption at rest, streaming, multi-model routing, persistence/caching beyond session, DuckDB-WASM, auto-injected RLS

---

## License

MIT
