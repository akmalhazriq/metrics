# Metrics BI

AI-native business intelligence — dashboards, SQL lab, and conversational analytics on real PostgreSQL.

[![License: MIT](https://img.shields.io/badge/License-MIT-8a5cf0.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-2e7d32.svg)](https://nodejs.org)
[![Build](https://img.shields.io/badge/build-passing-2e7d32.svg)](#)
[![React 19](https://img.shields.io/badge/react-19-149eca.svg)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/postgresql-14%2B-336791.svg)](https://www.postgresql.org)

> **Beta v1.0 — `v1.0.0-beta.1`:** Every Apache Superset reference page has a working equivalent, backed by real Postgres. Phase 2 AI surfaces are integrated directly into the relevant pages — not a bolted-on chatbot tab.

## What is this?

A modern, AI-native BI platform inspired by Apache Superset, built on React 19 + Vite + Nitro + PostgreSQL + Drizzle. Ships a configurable LLM layer for natural-language-to-SQL, self-healing queries, conversational BI, and anomaly detection — all as H3 handlers under `routes/api/ai/` with the underlying query always inspectable.

## Features

- **Dashboards** — 12-col grid builder (header / markdown / divider / chart), cross-filtering (click a bar to filter other charts), drill-to-detail (right-click or header icon → row-level modal with pagination), ambient insights strip (trend / spike / drop / outlier / correlation). List: search, filter, sort, bulk delete/export, favorites.
- **Charts** — TanStack Charts (`barY`, `lineY+dot`, `areaY`, `dot`, `rect`, `boxY` + Table / Big Number), Chart Explore with live `sampleRows` aggregation, dataset/viz selector, Save via `POST /api/charts`.
- **SQL Lab** — Real Postgres execution (`pg` Pool, `READ ONLY`, `statement_timeout 10s`), schema browser from `GET /api/sqllab/databases`, multi-tab editor with syntax highlighting, saved queries & query history (standalone list pages with search / filter / pagination).
- **AI**
  - **NL-to-SQL** — Plain language → editable SQL preview (never auto-run), real-schema-aware, `Apply / Dismiss`.
  - **Self-healing queries** — `Diagnose` on error → visible `before → after` diff + fixed SQL → `Apply fix` (explicit confirm).
  - **Conversational BI** — "Make it a line chart" / "filter to completed" → inspectable SQL + chart preview + `Apply / Dismiss`.
  - **Anomaly / Insight detection** — Ambient strip on dashboards with severity (`info | warning | critical`), `View SQL`, badge → highlight chart.
  - **Configurable provider** — Any OpenAI-compatible API (host + apiKey + model), single-active invariant, server-side only (`POST /chat/completions`, 30s timeout). Mock mode by default (`x-mock-ai: 1`).
- **Data** — Databases, Datasets, CSV/Excel upload (`/csvtodatabaseview/form`, `/exceltodatabaseview/form`) with client-side preview → `POST /api/uploads` → new table in `database_schemas → database_tables`.
- **Governance** — Alerts & Reports (cron, delivery: email / Slack / webhook, `Test` validates), Tags, Annotation Layers, CSS Templates, Import/Export (ZIP / JSON / YAML), Action Log.
- **Security** — RBAC (Admin / Analyst / Viewer, 22 permissions), Row Level Security (RLS) filters, first-run setup (`/setup` — one-time admin creation), session auth (`Authorization: Bearer` / `x-session-token`, server checks 85 handlers via `src/lib/requireAuth.ts`; client `RequireAuth` + global `window.fetch` patch).

## Screenshots

Add images to `/public/screenshots` and reference them here. Screenshots are not committed in the default seed — these are placeholders.

<!-- ![Dashboard — Orders Overview](/public/screenshots/dashboard.png) -->
<!-- ![Chart Explore — bar chart builder](/public/screenshots/explore.png) -->
<!-- ![SQL Lab — schema browser and editor](/public/screenshots/sqllab.png) -->

Until screenshots are added, run `npm run dev` and visit `/welcome`, `/dashboard/1`, `/explore`, and `/sqllab` for the live surfaces.

## Quick start

Prerequisites: **Node 18+**, **PostgreSQL 14+**.

```bash
git clone <repo>
cd metrics
npm install
cp .env.example .env   # edit DATABASE_URL
npm run db:push        # create tables (Drizzle Kit — dev, no migration file)
npm run db:seed        # seed minimal sample data (1 database · 2 datasets · 2 charts · 1 dashboard)
npm run dev            # start on http://localhost:5000
```

> **First-run note:** On first launch you'll be guided through creating your admin account at `/setup`. This screen only appears once (no users exist yet); later users are added from **Govern → Users**.

The dev server serves both the React frontend and the Nitro/H3 API on the same origin (`/api/*` via the `nitro()` Vite plugin). Production build is `npm run build` (type-check + Vite); Docker serves `dist/` via nginx, PM2 alternative via `ecosystem.config.js`.

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | yes | `postgresql://postgres:postgres@localhost:5432/metrics_bi` | Postgres connection string. Read via `dotenv/config`; `drizzle.config.ts` uses the same value. Keep the real file in `.env` (gitignored) and commit only `.env.example`. |
| `PORT` | no | `5000` | Dev server port (`vite.config.ts` + Nitro). Override with `PORT=3001 npm run dev`. |

**LLM setup.** AI features run in **mock mode** by default (template + real schema, `x-mock-ai: 1`, no key needed) — useful for local development and demos. To enable a real provider:

1. Open **Settings → AI Settings** (`/settings/ai`).
2. Add a provider: **Host** (e.g. `https://api.openai.com/v1`), **API Key**, **Model** (e.g. `gpt-4o`), **Temperature** / **Max tokens** as needed.
3. Click **Test connection** — the handler does a minimal `Say connected` call and reports latency.
4. Click **Set active** — only one provider can be active at a time (single-active invariant). Active calls are `x-mock-ai: 0` and hit `${host}/chat/completions` server-side only; keys never leave the server and are never exposed via `VITE_*` env vars.

## Architecture

- **Frontend** — React 19 (CSR, `react-jsx`), Vite 7, `vite-plugin-pages` file routing (`src/pages`, `importMode: async`, per-route code-splitting), Tailwind CSS 4 with OKLCH tokens in `src/index.css` (`:root` / `.dark` / `@theme inline`), shadcn/`cva` + `clsx` + `tailwind-merge` via `src/utils/cn.ts`, Space Grotesk via `unplugin-fonts`.
- **Backend** — Nitro 3 / H3 file routing (`routes/api`, method-suffixed handlers like `index.get.ts`), `defineHandler` / `defineEventHandler`, shared `pg` Pool in `src/db/index.ts`.
- **DB** — PostgreSQL + Drizzle ORM (`src/db/schema.ts` faithful to `src/types/*`, `drizzle.config.ts` `dialect: postgresql`), seed `src/db/seed.ts` (idempotent `TRUNCATE … CASCADE` + `setval` + live `public.orders` / `public.customers` tables so `SELECT * FROM public.orders` hits real Postgres).
- **Charts** — `@tanstack/charts` 0.14.0 (`barY` / `lineY+dot` / `areaY` / `dot` / `rect` / `boxY`), `ChartRenderer` with OKLCH `chart-1 … chart-5` tokens, `React.lazy` code-splitting.
- **AI** — Configurable OpenAI-compatible client in `src/lib/llm/` (`getActiveLlmConfig`, `callLlm`); handlers under `routes/api/ai/` branch mock vs real on `ai_settings.isActive`.
- **API client** — Shared typed client `src/lib/api.ts` (`fetchApi` / `fetchList` / `fetchOne` / `mutate`, `res.ok` check + `ApiError`); does not inject auth (relies on global `window.fetch` patch in `src/main.tsx`).

## Development

| Script | What it does |
|---|---|
| `npm run dev` | Vite + Nitro dev server on `http://localhost:5000` (frontend + `/api/*` same origin) |
| `npm run build` | `tsc` type-check, then Vite + Nitro production build (outputs `dist/` + `.output/server/index.mjs`) |
| `npm run start` | Run the Nitro production server (`node .output/server/index.mjs`, respects `PORT`/`NITRO_PORT`) |
| `npm run preview` | Preview the production build (Vite preview, dev only) |
| `npm run lint` | ESLint (`typescript-eslint`, `--max-warnings 0`) |
| `npm run lint-staged` | Prettier `--write` + `eslint --fix` (Husky pre-commit, `concurrent: false`) |
| `npm run db:push` | Drizzle Kit push — sync `src/db/schema.ts` to Postgres (dev only, no migration file) |
| `npm run db:seed` | Seed DB from `src/data/*` via `tsx src/db/seed.ts` |
| `npm run db:generate` | Drizzle Kit generate — create SQL migration in `drizzle/` |
| `npm run db:migrate` | Drizzle Kit migrate — apply migrations from `drizzle/` (production path) |
| `npm run db:studio` | Drizzle Studio — browser UI for the DB |

> No test runner is configured (no jest / vitest / playwright). `npm run lint` enforces `--max-warnings 0`.

## Deployment

Production is a standalone Node.js server — no separate frontend/backend deploy. The Vite build emits `dist/` (static assets) and `.output/server/index.mjs` (Nitro/H3 server that co-serves both).

### One-time setup (Railway / Render + Neon / Supabase)

```bash
# 1. Set environment variables on the host (see Configuration table above).
#    DATABASE_URL must be the pooled connection string from Neon/Supabase,
#    including ?sslmode=require. PORT and NODE_ENV are usually injected
#    automatically by the host.

# 2. Deploy — the host runs these on each release:
npm ci
npm run build          # tsc + vite build → .output/server/index.mjs
npm run db:migrate     # applies drizzle/ migrations to the production DB (run once per release, before start)
npm run start          # node .output/server/index.mjs — listens on $PORT (defaults to 3000 if unset)
```

For local production smoke-test:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/metrics_bi npm run build
PORT=3001 npm run start   # or: NODE_ENV=production npm run start
```

> **Migrations vs push.** `db:push` is dev-only (direct schema sync, no history). Production uses versioned migrations: `db:generate` creates `drizzle/*.sql`, `db:migrate` applies them. Never run `db:push` against production — it can drop data. The app does **not** auto-migrate on boot (avoids race conditions when multiple instances start); the deploy pipeline must run `db:migrate` explicitly.

### CORS & sessions

- **Co-served** — Frontend and API share the same origin (`/api/*` via the Nitro Vite plugin), so no CORS is needed. If you ever split them, add a `routeRules` CORS block in a `nitro.config.ts`.
- **Auth is header-based**, not cookie-based — the client stores the session token in `localStorage` (`metrics_session_token`) and sends `Authorization: Bearer <token>` (or `x-session-token`) on every `/api/*` request. There are no cookies to set `secure: true` on. If cookies are introduced later, they must be `httpOnly; Secure` when `NODE_ENV === 'production'`.

## Project structure

```
src/pages/          # Frontend routes (vite-plugin-pages, file-based, default exports)
src/components/ui/  # shadcn primitives (cva + cn helper)
src/components/charts/  # ChartRenderer, drill-detail modal
src/components/layout/  # AppShell, navigation
src/hooks/          # useAuth (RequireAuth, session)
src/lib/            # api.ts, requireAuth.ts, llm/ (settings, client)
src/db/             # schema.ts, index.ts (sole Pool), seed.ts, auth.ts
src/types/          # Chart, Dashboard, Dataset, Database, AI, etc.
src/data/           # Seed input only — consumed by src/db/seed.ts, never at runtime
routes/api/         # Nitro/H3 handlers (file-based, method-suffixed)
routes/api/ai/      # AI handlers (nl2sql, heal, converse, insights)
configs/            # fonts.config.ts (Space Grotesk)
drizzle/            # Generated SQL migrations (prod path)
```

## Roadmap / Known limitations

Core parity is complete for beta; a few deeper lifts are intentionally deferred as honest stubs. The full list lives in `CLAUDE.md` → **Known gaps (Phase 1)** and **Phase 2 progress → Remaining Phase 2 deferrals**:

- More TanStack chart types (Pie / Donut / Violin / Treemap / Sunburst / Sankey / Gauge) — pending upstream exports; rendered as `DeferredCard` with a reason, not faked.
- Dashboard native filter config, drag-and-drop reordering / resizing (currently add / remove / span-select), CSS template picker, dashboard tabs.
- Cross-filtering & drill-to-detail for non-Bar charts (Line / Area / Scatter / Heatmap / Box Plot), drill-by-dimension, CSV export from the drill modal.
- AI: streaming LLM responses, multi-model routing per task, conversation / insight persistence beyond session, API key encryption at rest, browser DuckDB-WASM, auto-injected RLS.

## Contributing

Contributions welcome — open an issue or PR. See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, conventions, and PR expectations.

## License

MIT — see [LICENSE](LICENSE).
