# Metrics BI

Dashboards, SQL Lab, and conversational analytics. Built on real PostgreSQL, no mock data.

[![License: MIT](https://img.shields.io/badge/License-MIT-8a5cf0.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-2e7d32.svg)](https://nodejs.org)
[![Build](https://img.shields.io/badge/build-passing-2e7d32.svg)](#)
[![React 19](https://img.shields.io/badge/react-19-149eca.svg)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/postgresql-14%2B-336791.svg)](https://www.postgresql.org)

> **Beta v1.0, `v1.0.0-beta.1`:** Every core Superset page has a working equivalent here, backed by real Postgres. The AI features live inside the pages you already use, not in a separate chat tab bolted on the side.

## Why this exists

Superset is powerful, but the loop from question to query to chart to dashboard still takes too long. Analysts know SQL and care about correctness. They just want a tool that gets out of the way.

Metrics BI keeps the Superset model you know and collapses that loop. It is React 19 plus Vite plus Nitro plus PostgreSQL plus Drizzle, with a small AI layer for turning plain language into SQL, healing broken queries, and flagging what changed on your dashboards. Every AI suggestion shows its SQL and waits for you to say yes. Nothing gets rewritten behind your back.

## What you get

- **Dashboards** that feel like a tool, not a template. Twelve column grid with headers, markdown, dividers, and charts. Click a bar to filter the other charts. Right click a bar or hit the table icon to see the rows behind it. An insights strip at the top flags trend, spike, drop, outlier, and correlation with severity and SQL you can inspect. List view has search, filter, sort, bulk delete and export, and favorites.
- **Charts** with TanStack Charts (`barY`, `lineY+dot`, `areaY`, `dot`, `rect`, `boxY` plus Table and Big Number). Explore gives you dataset and chart type selectors, live aggregation over your actual sample rows, and Save that posts to `POST /api/charts`.
- **SQL Lab** that actually runs against Postgres (`pg` Pool, read only, 10 second timeout). Schema browser from `GET /api/sqllab/databases`, multi tab editor with syntax highlighting, plus Saved Queries and Query History as real list pages with search, filter, and pagination.
- **AI, where you need it**
  - **Ask in plain language, get SQL you can edit.** The generated SQL appears as a preview first. Nothing runs until you insert it and hit Run yourself.
  - **When a query fails, get a fix you can see.** Diagnosis with a before and after diff and fixed SQL. You choose to apply it.
  - **Talk to your charts.** "Make it a line chart" or "filter to completed" turns into inspectable SQL plus a preview. Apply or dismiss.
  - **Dashboards surface what moved.** Each dataset is checked for trends and outliers, ranked by severity, with View SQL and a badge that highlights the affected chart.
  - **Any OpenAI compatible API.** OpenAI, Groq, Together, Ollama, vLLM. Pick host, API key, and model in Settings. Server side only (`POST /chat/completions`, 30 second timeout). Mock mode by default (`x-mock-ai: 1`) so it works with no key at all.
- **Data** for Databases, Datasets, and CSV or Excel upload (`/csvtodatabaseview/form` and `/exceltodatabaseview/form`) with client side preview, then `POST /api/uploads` which creates the table in `database_schemas` and `database_tables`.
- **Governance** for Alerts and Reports (cron, email, Slack, or webhook, with Test that validates), Tags, Annotation Layers, CSS Templates, Import and Export (ZIP, JSON, YAML), and Action Log.
- **Security** with RBAC (Admin, Analyst, Viewer, 22 permissions), Row Level Security filters, first run setup at `/setup` that creates the admin once, and session auth (`Authorization: Bearer` or `x-session-token`, checked on 85 handlers via `src/lib/requireAuth.ts` with a global `window.fetch` patch on the client).

## Screenshots

Add images to `/public/screenshots` and reference them here. Screenshots are not committed in the default seed. These placeholders are waiting for you:

<!-- ![Dashboard — Orders Overview](/public/screenshots/dashboard.png) -->
<!-- ![Chart Explore — bar chart builder](/public/screenshots/explore.png) -->
<!-- ![SQL Lab — schema browser and editor](/public/screenshots/sqllab.png) -->

Until you add them, run `npm run dev` and visit `/welcome`, `/dashboard/1`, `/explore`, and `/sqllab` to click around.

## Quick start

You need **Node 18+** and **PostgreSQL 14+**. That is it.

```bash
git clone <repo>
cd metrics
npm install
cp .env.example .env   # edit DATABASE_URL
npm run db:push        # create tables (Drizzle Kit, dev only, no migration file)
npm run db:seed        # seed a small sample (1 database, 2 datasets, 2 charts, 1 dashboard)
npm run dev            # open http://localhost:5000
```

First time you open it, you will land on `/setup` to create your admin account. It only shows up once, when no users exist yet. After that, add people from **Govern, Users**.

The dev server runs everything on one origin. React and the Nitro and H3 API both live on `/api/*` through the `nitro()` Vite plugin. For production, `npm run build` type checks and builds `dist/` and `.output/server/index.mjs`. Docker serves `dist/` through nginx. PM2 is an alternative via `ecosystem.config.js`.

## Configuration

| Variable       | Required | Default                                                    | Description                                                                                                                                                              |
| -------------- | -------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL` | yes      | `postgresql://postgres:postgres@localhost:5432/metrics_bi` | Postgres connection string. Read via `dotenv/config`. `drizzle.config.ts` uses the same value. Keep the real file in `.env` (gitignored) and commit only `.env.example`. |
| `PORT`         | no       | `5000`                                                     | Dev server port (`vite.config.ts` plus Nitro). Override with `PORT=3001 npm run dev`.                                                                                    |

**Turning on a real LLM.** AI works out of the box with no key in mock mode. It uses template logic plus your real schema and marks responses `x-mock-ai: 1`. That is perfect for local dev and demos. When you are ready:

1. Open **Settings, AI Settings** (`/settings/ai`).
2. Add a provider: **Host** (for example `https://api.openai.com/v1`), **API Key**, **Model** (for example `gpt-4o`), and set **Temperature** and **Max tokens** if you want.
3. Click **Test connection**. It sends a small "Say connected" request and shows latency.
4. Click **Set active**. Only one provider can be active at a time. Active calls are `x-mock-ai: 0` and hit `${host}/chat/completions` on the server. Keys never leave the server and are never exposed as `VITE_*` vars.

## Architecture

- **Frontend** is React 19, client rendered, Vite 7, `vite-plugin-pages` file routing (`src/pages`, `importMode: async`, per route code splitting), Tailwind CSS 4 with OKLCH tokens in `src/index.css` (`:root` and `.dark` and `@theme inline`), shadcn and `cva` plus `clsx` plus `tailwind-merge` via `src/utils/cn.ts`, Space Grotesk via `unplugin-fonts`.
- **Backend** is Nitro 3 and H3 file routing (`routes/api`, method suffixed handlers like `index.get.ts`), `defineHandler` and `defineEventHandler`, with a shared `pg` Pool in `src/db/index.ts`.
- **DB** is PostgreSQL plus Drizzle ORM (`src/db/schema.ts` mirrors `src/types/*`, `drizzle.config.ts` `dialect: postgresql`), seed in `src/db/seed.ts` (idempotent `TRUNCATE ... CASCADE` plus `setval` plus real `public.orders` and `public.customers` tables so `SELECT * FROM public.orders` hits actual Postgres).
- **Charts** use `@tanstack/charts` 0.14.0 (`barY`, `lineY+dot`, `areaY`, `dot`, `rect`, `boxY`), `ChartRenderer` with OKLCH `chart-1` through `chart-5` tokens, `React.lazy` code splitting.
- **AI** has a small OpenAI compatible client in `src/lib/llm/` (`getActiveLlmConfig`, `callLlm`). Handlers under `routes/api/ai/` pick mock or real based on `ai_settings.isActive`.
- **API client** is the shared typed helper `src/lib/api.ts` (`fetchApi`, `fetchList`, `fetchOne`, `mutate`, with `res.ok` check and `ApiError`). It does not inject auth. The global `window.fetch` patch in `src/main.tsx` does that.

## Development

| Script                | What it does                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run dev`         | Vite plus Nitro dev server on `http://localhost:5000` (frontend and `/api/*` together)              |
| `npm run build`       | `tsc` type check, then Vite plus Nitro production build (`dist/` and `.output/server/index.mjs`)    |
| `npm run start`       | Run the Nitro production server (`node .output/server/index.mjs`, respects `PORT` and `NITRO_PORT`) |
| `npm run preview`     | Preview the production build (Vite preview, dev only)                                               |
| `npm run lint`        | ESLint (`typescript-eslint`, `--max-warnings 0`)                                                    |
| `npm run lint-staged` | Prettier `--write` plus `eslint --fix` (Husky pre-commit, `concurrent: false`)                      |
| `npm run db:push`     | Drizzle Kit push, sync `src/db/schema.ts` to Postgres (dev only, no migration file)                 |
| `npm run db:seed`     | Seed DB from `src/data/*` via `tsx src/db/seed.ts`                                                  |
| `npm run db:generate` | Drizzle Kit generate, create SQL migration in `drizzle/`                                            |
| `npm run db:migrate`  | Drizzle Kit migrate, apply migrations from `drizzle/` (production path)                             |
| `npm run db:studio`   | Drizzle Studio, browser UI for your DB                                                              |

No test runner is set up (no jest, vitest, or playwright). `npm run lint` must pass with `--max-warnings 0`.

## Deployment

Production is a single Node.js server. No separate frontend and backend deploy. The Vite build emits `dist/` (static assets) and `.output/server/index.mjs` (Nitro and H3 server that serves both).

### One time setup (Railway, Render plus Neon or Supabase)

```bash
# 1. Set environment variables on the host (see Configuration table above).
#    DATABASE_URL must be the pooled connection string from Neon or Supabase,
#    including ?sslmode=require. PORT and NODE_ENV are usually injected
#    automatically by the host.

# 2. Deploy — the host runs these on each release:
npm ci
npm run build          # tsc plus vite build to .output/server/index.mjs
npm run db:migrate     # applies drizzle/ migrations to the production DB (run once per release, before start)
npm run start          # node .output/server/index.mjs — listens on $PORT (defaults to 3000 if unset)
```

For a local production smoke test:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/metrics_bi npm run build
PORT=3001 npm run start   # or: NODE_ENV=production npm run start
```

A note on migrations versus push. `db:push` is for dev only. It syncs the schema directly with no history. Production uses versioned migrations: `db:generate` creates `drizzle/*.sql`, `db:migrate` applies them. Never run `db:push` against production, it can drop data. The app does not auto migrate on boot. That avoids race conditions when multiple instances start. The deploy pipeline has to run `db:migrate` explicitly.

### CORS and sessions

- **Everything on one origin.** Frontend and API share the same origin (`/api/*` via the Nitro Vite plugin), so you do not need CORS. If you ever split them, add a `routeRules` CORS block in a `nitro.config.ts`.
- **Auth uses headers, not cookies.** The client keeps the session token in `localStorage` (`metrics_session_token`) and sends `Authorization: Bearer <token>` (or `x-session-token`) on every `/api/*` request. There are no cookies to set `secure: true` on. If you add cookies later, make them `httpOnly` and `Secure` when `NODE_ENV === 'production'`.

## Project structure

```
src/pages/          # Frontend routes (vite-plugin-pages, file based, default exports)
src/components/ui/  # shadcn primitives (cva plus cn helper)
src/components/charts/  # ChartRenderer, drill detail modal
src/components/layout/  # AppShell, navigation
src/hooks/          # useAuth (RequireAuth, session)
src/lib/            # api.ts, requireAuth.ts, llm/ (settings, client)
src/db/             # schema.ts, index.ts (single Pool), seed.ts, auth.ts
src/types/          # Chart, Dashboard, Dataset, Database, AI, etc.
src/data/           # Seed input only, used by src/db/seed.ts, never at runtime
routes/api/         # Nitro and H3 handlers (file based, method suffixed)
routes/api/ai/      # AI handlers (nl2sql, heal, converse, insights)
configs/            # fonts.config.ts (Space Grotesk)
drizzle/            # Generated SQL migrations (prod path)
```

## Roadmap and known limitations

Core parity is done for beta. A few bigger lifts are left as honest stubs. The full list lives in `CLAUDE.md` under Known gaps and Phase 2 progress and Remaining deferrals:

- More TanStack chart types (Pie, Donut, Violin, Treemap, Sunburst, Sankey, Gauge) are waiting on upstream exports. They render as a `DeferredCard` with a reason, not a fake chart.
- Dashboard native filter config, drag and drop reordering and resizing (today you add, remove, and pick spans), CSS template picker, dashboard tabs.
- Cross filtering and drill to detail for non Bar charts (Line, Area, Scatter, Heatmap, Box Plot), drill by dimension, and CSV export from the drill modal.
- AI: streaming LLM responses, multi model routing per task, conversation and insight persistence past the session, API key encryption at rest, browser DuckDB WASM, auto injected RLS.

## Contributing

Contributions are welcome. Open an issue or PR. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, conventions, and what we look for in PRs.

## License

MIT, see [LICENSE](LICENSE).
