# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite + Nitro dev server on port 5000 (frontend + /api/* on same origin)
npm run build        # TypeScript check (tsc) then Vite production build
npm run preview      # Preview production build
npm run lint         # ESLint (typescript-eslint) — --max-warnings 0
npm run lint-staged  # Prettier --write + eslint --fix (lint-staged uses .lintstagedrc.json, concurrent false)
npm run db:push      # Drizzle Kit push — sync src/db/schema.ts to Postgres (dev, no migration file)
npm run db:generate  # Drizzle Kit generate — create SQL migration in drizzle/
npm run db:migrate   # Drizzle Kit migrate — apply migrations
npm run db:seed      # Seed DB from src/data/* via tsx src/db/seed.ts
npm run db:studio    # Drizzle Studio — browser UI for DB
```

- No test runner is configured (no jest/vitest/playwright). Do not assume `npm test` exists, and do not introduce one unless explicitly asked.
- Single-file lint: `npx eslint src/pages/about.tsx`
- Husky pre-commit hook runs `npm run lint-staged --concurrent false` automatically.

## Architecture

### Full-stack layout

This is a **client-side rendered (CSR)** React app with a co-located Nitro backend, both served by Vite in development.

- `src/` — React 19 frontend (TypeScript, JSX via `react-jsx`)
- `routes/` — Nitro 3 / H3 backend API handlers (file-based routing)
- Vite dev server on `0.0.0.0:5000` serves both; `nitro()` Vite plugin proxies `/api/*` to H3 handlers. Production uses `npm run build` output; Docker stage serves `dist/` via nginx, PM2 alternative via `ecosystem.config.js` (`.output/server/index.mjs`).

### Frontend routing (`src/pages/`)

File-based routing via `vite-plugin-pages` (dirs: `src/pages`, extensions `tsx`/`jsx`, `importMode: async` — per-route code-splitting; main chunk stays <500kB):

- `src/pages/index.tsx` -> `/`, `about.tsx` -> `/about`
- `src/pages/users/[id].tsx` -> `/users/:id` (dynamic param via `useParams()`)
- `src/pages/users/profile.tsx` -> `/users/profile`
- `src/pages/[...all].tsx` or `NotFound.tsx` -> catch-all / 404

`src/main.tsx` wires `BrowserRouter` + `useRoutes(routes)` where `routes` is the virtual `~react-pages` import. All page components must use **default exports**. Note `src/App.md` contains an outdated manual `BrowserRouter`/`Routes` example — `src/main.tsx` is the actual entry point.

### Backend routing (`routes/`)

File-based API routing via Nitro/H3:

- `routes/api/hello.ts` -> `/api/hello`, `routes/api/users/index.get.ts` -> `GET /api/users`
- Method-specific files: `index.get.ts` / `index.post.ts`; generic handlers inspect `event.method`.
- Dynamic segments: `routes/api/users/[id].ts` with `getRouterParam(event, "id")`.
- Handlers use `defineHandler` (from `nitro/h3`) / `defineEventHandler` (from `h3`). Common H3 utils: `readBody`, `getQuery`, `getRouterParam`, `getHeader`, `setResponseStatus`, `createError`.

### Vite plugins (`vite.config.ts`)

- `nitro()` — backend integration (must be first)
- `@vitejs/plugin-react-swc` — React Fast Refresh
- `vite-plugin-pages` — frontend file routing
- `vite-plugin-svgr` — import SVGs as components via `?react` suffix (`import Logo from "@/assets/react.svg?react"`)
- `@tailwindcss/vite` — Tailwind CSS 4
- `unplugin-fonts` — Google Fonts configured in `configs/fonts.config.ts` (currently Space Grotesk)
- `unplugin-auto-import` — auto-imports `react` and `react-router` hooks (no `import { useState }` needed); generates `auto-imports.d.ts` and `eslintrc` config
- `vite-plugin-inspect` — dev inspector
- `unplugin-imagemin` — present in deps, commented out in config (type issues)

### Import aliases and TypeScript

- `@/*` -> `./src/*` (configured in both `tsconfig.json` `paths` and `vite.config.ts` `resolve.alias`).
- `tsconfig.json` targets `ES2020`, `moduleResolution: bundler`, strict mode, `noUnusedLocals`/`noUnusedParameters`.
- `tsconfig.node.json` (project reference) covers `vite.config.ts` and `configs/`.
- Global types: `global.d.ts` references `vite-plugin-svgr/client`, `vite/client`, `vite-plugin-pages/client-react`. `auto-imports.d.ts` is generated.

### Styling

- Tailwind CSS 4 via `@import 'tailwindcss'` in `src/index.css`, with `tailwindcss-animate` plugin.
- shadcn/ui pattern: components in `src/components/ui/` (e.g., `button.tsx` using `class-variance-authority` + `clsx` + `tailwind-merge` via `src/utils/cn.ts` helper). Path alias usage: `@/components/ui/button`.
- Design tokens defined as OKLCH CSS variables in `src/index.css` (`:root` / `.dark` / `@theme inline`), wired to Tailwind via `@custom-variant` and `@theme`.

### Code quality

- ESLint flat config (`eslint.config.js`): `typescript-eslint` recommended + `react-hooks` + `react-refresh`, ignores `dist`, `dev-dist`, `node_modules`, `auto-imports.d.ts`. Scope is `**/src/**/*.{ts,tsx}` only.
- Prettier: `.prettierrc.json` — 2-space, `semi: true`, `trailingComma: all`, `printWidth: 100`, with `prettier-plugin-tailwindcss` (class sorting) and `prettier-plugin-organize-imports`.
- Husky + lint-staged (`.lintstagedrc.json`): `*.{js,jsx,ts,tsx}` -> `prettier --write`, `eslint --fix`, `eslint`; `*.{json,md,yml}` -> `prettier --write`.

### Deployment

- `Dockerfile` — multi-stage: `node:18` build stage (`npm install --legacy-peer-deps` + `npm run build`), `nginx:alpine` production stage serving `dist/`.
- `ecosystem.config.js` — PM2 config for Nitro server (`.output/server/index.mjs`, cluster mode, port 3000).
- `DEPLOYMENT.md` covers nginx/PM2/systemd/SSL on VPS.

### Database

- **PostgreSQL + Drizzle ORM** — schema at `src/db/schema.ts` (faithful normalization of `src/types/*`), connection at `src/db/index.ts` (`drizzle(pool, { schema })` via `pg` Pool — the ONLY place the pool is created; handlers import `{ db }` from `@/db`), seed at `src/db/seed.ts`.
- **`DATABASE_URL`** in `.env` (`postgresql://postgres:postgres@localhost:5432/metrics_bi`, in `.gitignore`) — read via `dotenv/config`. Drizzle config at `drizzle.config.ts` (`dialect: postgresql`, `schema: ./src/db/schema.ts`, `out: ./drizzle`).
- **Tables**: `users`, `databases` (text PK to preserve seed ids), `database_schemas` → `database_tables` → `database_table_columns`, `datasets` → `dataset_columns`/`dataset_metrics`/`dataset_sample_rows`, `tags` + `chart_tags`/`dashboard_tags`, `charts` (FK `datasetId`), `dashboards` (`layout` jsonb), `chart_owners`/`dashboard_owners`, `favorites`, `saved_queries`, `query_history`, `alerts` → `alert_runs`, `reports` → `report_runs`, `roles` → `role_permissions` → `permissions`, `user_roles`, `database_access`, `datasource_access`, `row_level_security_filters` → `rls_filter_tables`/`rls_filter_roles`, `action_log`, `ai_settings`/`sessions`/`password_hashes`.
- **Build splitting**: `vite.config.ts` uses `importMode: "async"` (per-route chunks) + `build.rollupOptions.output.manualChunks: { tanstack: ["@tanstack/charts", "@tanstack/charts/react"], vendor: ["react","react-dom","react-router"] }`. Main `index-*.js` ~192kB (<500kB budget), TanStack ~117kB, vendor ~33kB — verified via `.output/public/assets/`.
- **Workflow**: dev → `npm run db:push` (no migration files, direct sync; noted for dev), prod → `npm run db:generate` + `npm run db:migrate`. Seed is idempotent (`TRUNCATE … RESTART IDENTITY CASCADE` then inserts preserving all FK chains from `src/data/*`; prints summary; bumps serial sequences via `setval`).
- **Minimal seed (2026-08-16 reset)** — deliberate wipe, one coherent "orders & revenue" story. `src/data/*` now tiny: 1 database `analytics` (Postgres `metrics_bi` — same instance SQL Lab runs against), 2 datasets (`orders` 12 sample rows + `customers` 6), 2 charts (`Revenue by Status` Bar + `Orders — Recent` Table both on orders), 1 dashboard `Orders Overview` laying out those 2 charts (header/markdown/divider). All names human, owners bare `{"id":0,"name":"Sample"}` (handlers fallback `"Sample"` when `modifiedById` null/0), tags empty/favorite false — no fake people. Structural seed only: `roles` (Admin/Analyst/Viewer) + `permissions`/`role_permissions` (22) + inactive `ai_settings` (`isActive:false`). **NOT seeded:** `users`/`password_hashes`/`sessions`/`favorites`/`action_log`/`alerts`/`reports`/`RLS` — all start 0/empty. `src/db/seed.ts` after the Drizzle inserts creates real readable tables `public.orders`/`public.customers` via `pool.query DDL+INSERT` from the dataset `sampleRows` so `SELECT * FROM public.orders` hits live Postgres. Verify after `npm run db:seed`: `users=0` (expected 0), `roles=3`, `perms=22`, `databases=1`, `datasets=2`, `charts=2`, `dashboards=1`, `public.orders=12`.
- **First-run setup (2026-08-16)** — `/api/auth/status.get.ts` `{hasUsers,isAuthenticated}` via `SELECT EXISTS(SELECT 1 FROM users)` + Bearer/`x-session-token` expiry check; `/api/setup/initialize.post.ts` guarded `409 "Setup already completed"` once any user exists (permanently dead), validates firstName/lastName/username uniqueness/email `@`/password ≥8/roleIds default Admin, hashes via `src/db/auth.ts` (`hashPassword`/`generateToken`), transaction `users`+`password_hashes`+`user_roles`+`sessions` (7-day) → `{token,user}` 201. `src/pages/setup/index.tsx` full-screen centered *outside* `AppShell` (same shape as `/login`, `bg-[radial-gradient(ellipse_at_top,_var(--muted)_0%,_var(--background)_55%)]`, max-w 460, brand `M`/`Metric BI`, `Create your admin account` + `This is a fresh install — no users exist yet… You'll be signed in and taken to the sample "Orders Overview" dashboard`, step indicator `Shield` `Step 1 of 1 — initial setup` `Runs once`, 2-col name, username/email/password+confirm, pill role selector default Admin, error banner, `Create admin & continue`, footnote `This screen won't appear again — later users are added from Users`, footer `Sample data: 1 dashboard · 2 charts · Analytics / public.orders` + Health). `src/hooks/useAuth.tsx` `RequireAuth` checks `/api/auth/status` (public prefixes `/setup`/`/login`/`/health` bypass), no users→`/setup`, users+no token→`/login`, valid token→app; `src/pages/login` + `src/pages/index.tsx` also redirect to `/setup` when `hasUsers===false`. `GET /api/dashboards|charts|datasets|databases` all fallback `name:"Sample"` when `modifiedById` null/0.
- **Security (2026-08-16 fix)** — client + server enforcement, not just UI. **Public (no token):** UI `/setup`, `/login`, `/health` (and `/` redirects); API `/api/auth/*` (`status`, `login`), `/api/setup/*`, `/api/health`, `/api/about`. Everything else is **protected (401 without valid session)** — 85 handlers gate via `src/lib/requireAuth.ts` `requireAuth(event)` (`Authorization: Bearer` or `x-session-token` → `sessions` table, expiry check + delete, `createError 401`). `src/hooks/useAuth.tsx` `RequireAuth` was defined but never mounted — fixed in `src/main.tsx` (`BrowserRouter → AuthProvider → RequireAuth → App`); shows `Loading…` while `loading || !statusChecked` to avoid flash, redirects `hasUsers===false → /setup` else `!user → /login`. `src/components/layout/AppShell.tsx` has belt-and-suspenders `useEffect` (`!loading && !user → navigate("/login")`) so any route that forgets the wrapper still redirects. Verified incognito (no token): `GET /api/dashboards|charts|sqllab/databases|sqllab/execute|welcome → 401`, `GET /api/health|about|auth/status → 200`; with `Bearer` token → `200` and `GET /api/dashboards → total 1 Orders Overview Sample`. Token stored `localStorage metrics_session_token`, sent as `Authorization: Bearer` by `useAuth.refresh`/`logout` and every `fetch` that touches `/api/*` (server validates per-request, not just decoded).
- **Data flow**: pages fetch `/api/*` (Drizzle → Postgres, no `src/data` fallback); `src/data/*.ts` remains only as seed input (`src/db/seed.ts` imports it) — Phase E retirement (inlining) is deferred until handler coverage is fully verified. `routes/api/sqllab/execute.post.ts` now executes real SQL via the shared `pg` Pool (READ ONLY, statement_timeout 10s, history persisted to `query_history`); no handler imports `src/data/sqllab`.
- **Public/Open-Source Checklist (2026-08-16)** — full sweep for personal identifiers. Removed `akmalhazriq`/`ServBay.dev` DB URL → `postgres:postgres@localhost` (`.env` gitignored, `.env.example` generic), replaced seed/login/setup hardcoded names (`Akmal Hazriq`→`Admin User`, `Mira Chen`/`Jonah`→`Example`/`Data Analyst`, `aisha_khan_1`/`akmal_hazriq_1` usernames→`admin_user`, `akmal@example.com`→`admin@example.com`), sanitized `src/data/*.ts`, `src/db/seed.ts`, `src/pages/**/*.tsx` (login placeholder `your username`/`••••` — no demo credentials, setup `Admin`/`User`), `src/components/**/*.tsx` (`UserEditor` placeholders `Admin User`/`admin@example.com`), `routes/api/**/*.ts` fallback owners (`Admin User`), `CLAUDE.md` progress notes (`no demo credentials — "Use your admin credentials"`), removed `package.json` `author` field (none), verified `src/db/seed.ts` console output prints counts only (no names), `/login` shows no username hints, `/setup` shows no personal names, `grep -ri 'akmal\|hazriq\|mira\|chen\|aisha\|khan\|omar\|farouk' --include='*.ts' --include='*.tsx' --include='*.md' --include='*.json'` → 0 (extend for `jonah`/`amir` if found). `npm run lint` 0 · `npm run build` pass · `npm run db:seed` generic. Roles (`Admin/Analyst/Viewer`) and `Sample` owner retained — functional, not personal. `.git` internals untouched; local `git config user.name` not modified (machine-local, not committed).
- **Blank-screen regression (2026-08-17) — auth header gap, fixed; /settings missing fixed; 401 bounce hardened** — after bulk `requireAuth` patch (85 handlers gated), ~20 list pages (`Dashboards`, `Charts`, `Explore`, `SQL Lab`, `Datasets`, `Databases`, `Alerts`, `Reports`, `Users`, `Roles`, `Permissions`, `RLS`, `Annotation Layers`, `CSS Templates`, `Tags`, `Import/Export`, `Action Log`, etc.) called `fetch("/api/...")` without `Authorization` header → server `401 {error:true}` → client `r.json().then(res=>{setRows(res.data)})` set `undefined` → render `rows.length`/`rows.map` threw → React white screen. APIs themselves were healthy with valid token (`GET /api/alerts|roles|tags|log etc → 200 []` when `Authorization: Bearer <token>` supplied). Root cause was client fetch, not seed data (empty arrays `total:0` correctly handled with empty-state UI). **Fix (highest-impact, single file):** `src/main.tsx` now monkey-patches `window.fetch` to auto-inject `Authorization: Bearer <metrics_session_token>` for every `/api/*` request when token exists, respecting existing headers and `Request` objects. **Hardened 2026-08-17:** same patch now watches every `/api/*` response; if `res.status === 401` (expired/invalid session, `expiresAt`), clears `metrics_session_token` and `window.location.href = "/login"` — turns expired session into clean bounce instead of white screen. Excludes ` /api/auth/*` and `/api/setup/*` so `POST /api/auth/login` 401 on wrong password stays inline error on the login page, no redirect loop. Restores all 20 pages without touching each file. Verified: `npm run lint` 0, `npm run build` pass, `npm run db:seed` still `users=0`. **Missing route fixed:** `src/pages/settings/index.tsx` created as `<Navigate to="/settings/ai" replace />` — `Govern > Settings → /settings` now lands on `AI Settings`; `vite-plugin-pages` had no `settings/index.tsx` before, so it 404'd to `NotFound` without `AppShell` chrome. Chose redirect (smaller/safer) over hub; hub candidate noted for future.
- ~~**Known gap — no shared typed API client (2026-08-17)** — Pages call raw `fetch` and read `res.data` without checking `res.ok`; there's no shared typed API client.~~ **Resolved 2026-08-17 — shared typed API client (P0-2)** — `src/lib/api.ts` (`ApiError(status,message)`, `fetchApi<T>(url,options)` checks `res.ok` throws `ApiError` with `body.message||body.error||status`, `fetchList<T>(url,params)` builds `URLSearchParams` from `Record<string,string|number|boolean|undefined>` omitting empty, `fetchOne<T>`, `mutate<T>(url,method,body)` with JSON). Does NOT inject auth (relies on `src/main.tsx` global `window.fetch` patch). 15 pages refactored: `annotationlayer/list:30`, `csstemplates/list:27`, `tag/list:30`, `log:40`, `settings/ai:69` (using `fetchApi`/`mutate` for non-paginated `GET /api/settings/ai`), `alert/list:87`, `report/list:84`, `users/list:37`, `roles/list:31`, `permissions/list:24`, `rowlevelsecurity/list:36`, `dashboard/list:120`, `importexport:48,66` (mutate for import, fetchApi for export), `welcome:65` (401 swallow → `fetchApi<WelcomeResp>` + `error` banner + empty fallback, no silent `catch(()=>{})`), `sqllab/history:88` (removed `mockHistory` fallback masking 401, now `apiFetchList` + `error` state + toast, never substitutes fake data). Each page: `import { fetchList as apiFetchList, ApiError } from "@/lib/api"` aliased to avoid shadowing local `fetchList`, added `const [error,setError]=useState<string|null>(null)`, rewrote list fetch to `async try { const res=await apiFetchList<Row>(endpoint,params); setRows(res.data); setTotal(res.total)} catch(e){ const msg=e instanceof ApiError?e.message : e instanceof Error?e.message : fallback; setError(msg); showToast(msg)} finally setLoading(false)`, added `border-destructive/30 bg-destructive/10` banner above table. UI/filter/pagination/sort unchanged — only fetch+error handling. Verified: `npm run lint` 0, `npm run build` pass (Nitro 162kB), `GET /api/rowlevelsecurity|dashboard|welcome` list fetches throw `ApiError` with `res.status` on 401/500 instead of `rows.map` crash; with valid token pages load normally; with deleted token `window.fetch` 401 bounce clears `metrics_session_token` → `/login`; with 500 (e.g. `/api/nonexistent`) banner shows `Request failed with status 500` not white screen; `grep fetchList src/lib/api` clean, remaining raw `fetch("/api/...")` only for POST mutations (8 save handlers) not list fetches. Future pages: `import { fetchList, fetchOne, mutate, ApiError } from "@/lib/api"` — do NOT reintroduce `r.json()` without `res.ok`.
- **Resolved 2026-08-17 — P0-1, P0-3, P0-4 (audit bundle)** — P0-1 **Dead chart deep-links → 404**: created `src/pages/chart/[id].tsx` thin redirect — `useParams<{id}>()` + `<Navigate to={`/explore?chartId=${id}`} replace />` — makes `/chart/{id}` a semantic URL that hydrates via existing Explore `?chartId=` (Batch 3 wiring). Do NOT change links in `welcome`/`profile`/`log` (they already point to `/chart/{id}`, now resolved via route, not link rewrite). P0-3 **Error-state back button hits redirector**: changed both error branches in `src/pages/dashboard/[id].tsx:463,758` from `<Link to="/dashboard">` (redirector) to `<Link to="/dashboard/list">` (concrete list route) — avoids redirect hop and preserves chrome. P0-4 **Delete/BulkDelete without confirmation**: Part A created shared primitive `src/components/ui/confirm-dialog.tsx` (shadcn/cva — props `open`/`onOpenChange`/`title`/`description`/`confirmLabel="Delete"`/`cancelLabel="Cancel"`/`variant="destructive"|"default"`/`onConfirm`, fixed overlay `bg-black/40 backdrop-blur`, `role="dialog"` `max-w-[420px]` `rounded-lg border shadow-xl`, `Loader2` spinner while pending, tokens `destructive`/`default` via `buttonVariants`, exported via `src/components/ui/index.ts` barrel). Part B wired `ConfirmDialog` into 9 pages (`alert/list:96,104`, `report/list:91`, `users/list:44`, `roles/list:38`, `rowlevelsecurity/list:43`, `annotationlayer/list:37`, `csstemplates/list:34`, `tag/list:37`, `dashboard/list:179` via `dashboard/index.tsx`) — single-row: `setConfirmRow(row)` → dialog with item name → on confirm `await mutate(endpoint/id, "DELETE")` via `@/lib/api` + `ApiError` catch (`e instanceof ApiError ? e.message : ...`) → on success `fetchList()`/`setRows` + success toast, on failure error toast only (no unconditional success); bulk: dialog with count → sequential `for (const id of [...selected]) { try { await mutate(...); ok++ } catch(e){ fail++; lastErr=... } }` (not `Promise.all`) → toasts `Deleted N` / `Deleted N of M — X failed: err` / error, `setSelected(new Set())` + re-fetch after. Removed unconditional `showToast` before deletion. Pattern for future deletes: `import { ConfirmDialog } from "@/components/ui/confirm-dialog"` + `mutate`/`ApiError` + states `confirmRow`/`confirmBulk` + sequential bulk + two `<ConfirmDialog>` before toast. Verified: `npm run lint` 0, `npm run build` pass (Nitro 162kB), manual `/chart/1 → /explore?chartId=1`, dashboard error back → `/dashboard/list`, deletes show confirmation with proper success/failure toasts.
- **Resolved 2026-08-17 — P2-11, P2-12 + P1 quick wins (Scan/Share/Test/Favorite)** — P2-11 **Stale seedDatabases**: 6 pages read `src/data/databases.ts` statically so CSV Upload new tables invisible. Fixed: `datasets/index.tsx` (editor DB/Schema/Table selects + filter bar) + `csvtodatabaseview/form/index.tsx` (target DB/schema) + `savedquerylist/list:25` + `sqllab/history:21` now all fetch live via `fetchList<DatabaseConnection>("/api/databases", {page:1,pageSize:50})` with `liveDbs` state and `useEffect` on mount (shape matches seed — handler already returns `DatabaseConnection` with `schemas`); `databases/index.tsx` stray `seedDatabases` import removed (list already used `/api/databases`, scan now uses real endpoint). Verification `grep -r "seedDatabases" src/pages/ src/components/ → 0` (only `src/db/seed.ts` retains it). P1 **Share** `dashboard/list:841`: `showToast("Share link copied")` → `await navigator.clipboard.writeText(`${window.location.origin}/dashboard/${id}`) → "Link copied"` (async try/catch). P1 **Scan schemas/tables** `databases/index.tsx:249`: `await sleep(600)` counting `db.schemas` → `POST /api/databases/:id/scan` (`routes/api/databases/[id]/scan.post.ts` reads `database_schemas`/`database_tables` via Drizzle, returns `{schemas, tables}`, honest counts, `requireAuth`). P1 **Test** `alert/list:108`, `report/list:92`: placebo toast → `POST /api/alerts/:id/test` / `/api/reports/:id/test` (`routes/api/alerts/[id]/test.post.ts`, `reports/[id]/test.post.ts`, `requireAuth`, 404 if not found) returning `{success:true, message:"…validated — delivery not configured for this placeholder phase"}` shown in toast. P2-12 **Deep-link hydration for aliases**: `src/pages/dataset/edit/[id].tsx` and `src/pages/databaseview/edit/[id].tsx` were thin `export {default} from "../../datasets/index"` re-exports showing list, not editor. Replaced with hydration pages: `useParams<{id}>` + `fetchOne<Dataset|DatabaseConnection>(`/api/datasets|databases/${id}`)` + `fetchList<DatabaseConnection>("/api/databases")` for selects, loading/error states, form pre-filled (DB/Schema/Table selects from `liveDbs`), `mutate PUT` → navigate to list on save (`datasets/[id].get.ts`, `databases/[id].get.ts` created for this). Mirrors Chart Explore `?chartId=` hydration. **Deliberate deferrals now explicit**: Email report → "Email delivery requires SMTP configuration — not available in this phase" (`dashboard/list:850`), Change owners → "Ownership transfer coming in a future update" (`859`), Dashboard filters → "Dashboard filters are configured in the dashboard builder — coming in a future update" (`dashboard/[id]:576,584,595` + Apply), Visualize → "Chart creation from query results coming in a future update" (`sqllab:1136`). **Favorite now real**: `dashboard/[id]:526` was local-only `setFavorite(next)`; now `POST /api/dashboards/:id {favorite: next}` via existing `favorites` table (`dashboard/[id].post.ts` + `[id].get.ts` reading `favorites`), persists across refresh. Verified: `npm run lint` 0, `npm run build` pass (Nitro 164.9kB, new chunks `datasets/_id_.get 2.85kB`, `databases/_id_.get 3.77kB`, `_id/scan 1.2kB`, `_id/test 1.1kB`), `grep seedDatabases → 0`, manual Dataset editor live selects, CSV upload → new table appears, Share copies, Scan real counts, `/dataset/edit/1` opens editor not list, favorite persists.
- **Functional Audit (2026-08-17, read-only diagnostic)** — 31 pages audited in requested order (`/setup` → `/health`). Method: per-page inventory of every `Button`/`Link`/`Input`/`select`/`Checkbox`/`toggle`/`form`, click/submit check, `showToast` placeholder scan, `fetch` auth header check vs `src/lib/requireAuth.ts` (85 protected handlers), `r.ok` guard check, navigation target existence (`ls -R src/pages`). No fixes applied. Totals: **~564 interactive elements tested — ~468 working (83%), ~62 broken (11%), ~12 placeholder (2%)**, plus ~22 fragile `r.ok`-missing cases. P0 Broken (4 items — now resolved P0-1 via `src/pages/chart/[id].tsx`, P0-2 via `src/lib/api.ts`, P0-3 via `dashboard/[id].tsx:463,758`, P0-4 via `src/components/ui/confirm-dialog.tsx` + 9 pages): dead chart deep-links `Link to="/chart/${id}"` on `welcome`/`profile`/`log` (no `src/pages/chart/[id].tsx`, should be `/explore?chartId=`), 14 pages `fetchList` no `r.ok` → 401 parsed as `ApiResp` → `undefined` crash, `Back to Dashboards → /dashboard` hits redirector not `/dashboard/list`, destructive Delete/BulkDelete unconditional success toast + no confirm dialog. P1 Placeholder (8 items): `dashboard/list` Import/Share/Email/Change-owners, `alert|report/list` Test placebo, `sqllab` Visualize toast, `dashboard/[id]` Favorite local-only + Filters visual-only. P2 Minor (10 items): hardcoded role/tag filters stale, clause truncation, pagination `max(1,…)` on 0 results, per-keystroke search, missing `indeterminate` guard, welcome `—` on 401 swallow, about `href="#"` before load, `importexport` dead `Array.isArray` branch, `settings/ai` no `AppShell`. Zero generic `showToast("not yet implemented"/"coming soon")` strings — placeholders use honest copy line-referenced. Full report: `AUDIT.md` (per-page tables with file:line, summary, P0/P1/P2 with impact).

**Don't use git unless told!**

---

## Project brief: AI-native Superset clone

Everything above this line is fixed — the real stack in this repo. Do not introduce a second router, a second styling system, a second component library, or a second backend framework anywhere below. Every instruction here builds strictly on top of what's documented above.

The end goal: bring this app to feature parity with the core Apache Superset experience described in the reference spec below, then layer AI-native capabilities on top that Superset itself does not have (see "Current State Relevant to Proposed Additions" inside the spec). The result should feel like a real, opinionated product with its own visual identity — not a Superset re-skin, not a generic admin-dashboard template, and not something that reads as AI-generated.

### Phase 0 — Map what's already built before writing anything

The stack is known (see above), so this phase is about the app, not the tooling:

1. Walk `src/pages/` and `routes/` to see which pages and API handlers already exist versus which are still the Vite/starter placeholders (e.g. the default `about.tsx`, `users/[id].tsx` demo route).
2. Read `src/components/ui/` to see exactly which shadcn primitives already exist (built on `class-variance-authority` + `clsx` + `tailwind-merge` via `src/utils/cn.ts`) so new components extend that set instead of duplicating it.
3. Read `src/index.css` in full: the `:root` / `.dark` / `@theme inline` OKLCH variables are the existing design-token system. Know what's already named before adding anything.
4. Check `configs/fonts.config.ts` — Space Grotesk is already configured via `unplugin-fonts`. Note it, don't silently replace it.
5. Summarize back — what's real vs. placeholder, what's reusable — before proposing a plan. Use a todo list for this; don't jump straight to code.

### Phase 1 — Feature-parity reference

The document below is a page-by-page breakdown of Apache Superset's actual UI, routes, and components, provided as-is. Treat it as ground truth for what "feature parity with Superset" means — do not reinterpret or alter its meaning. Where a page from this list doesn't exist yet, build it using this repo's actual conventions: a frontend route in `src/pages/` (file-based via `vite-plugin-pages`, default export, dynamic segments as `[id].tsx`) backed by an API handler in `routes/api/` (H3, method-suffixed files, `defineHandler`/`defineEventHandler`). For example, Superset's `/dashboard/{id}/edit` maps to `src/pages/dashboard/[id]/edit.tsx` with data served from something like `routes/api/dashboards/[id].get.ts` / `.put.ts` — follow that same pattern for every other section (Charts, SQL Lab, Datasets, Databases, Alerts/Reports, Admin/Security) rather than inventing a different routing shape per section.

<reference_spec>
Apache Superset's deployed UI is composed of the following pages and routes, grouped by navigation area. Each page's primary functions, key UI components, and relevant code locations are listed.

**Authentication and General Pages**

- **Login page** — `/login`
  - Username/password login.
  - Optional OAuth/LDAP/OpenID/SSO provider buttons when configured.
  - Password reset link.
  - User registration if enabled in Flask-AppBuilder config.
  - Redirects to the Welcome page after authentication.
  - Code: `superset/views/core.py`, `superset-frontend/src/views/Login.tsx`

- **Welcome page** — `/welcome`
  - Displays recent dashboards, recent charts, favorite dashboards/charts, and created content.
  - Quick action cards: create dashboard, create chart, connect database, upload CSV, explore SQL Lab.
  - Shows onboarding resources and links to documentation.
  - Code: `superset-frontend/src/views/Welcome.tsx`

- **Profile page** — `/profile`
  - Displays current user info: username, first/last name, email, roles.
  - Lists user's favorite dashboards and charts.
  - Shows recent activity and content created by the user.
  - Links to security tokens if API access is enabled.
  - Code: `superset-frontend/src/views/Profile.tsx`

**Dashboards**

- **Dashboard List** — `/dashboard/list/`
  - Lists all dashboards with columns: title, modified by, status, modified, created by, owners, tags, favorite.
  - Search by title, filter by owner, favorite, tags, status.
  - Sort and pagination.
  - Actions per dashboard: view, edit, export, delete, share, email, change owners, toggle favorite, duplicate.
  - Bulk select for delete/export.
  - Create Dashboard button.
  - Import Dashboard button.
  - Code: `superset-frontend/src/views/CRUD/dashboard/DashboardList.tsx`

- **Dashboard View** — `/dashboard/{id}`
  - Renders the full dashboard layout: rows, columns, tabs, headers, markdown, dividers, and charts.
  - Dashboard header with title, tags, owners, last modified, favorite button, share button, email report button, export button, edit button, refresh button, auto-refresh interval, and fullscreen mode.
  - Native filter bar: global filters applied to charts on the dashboard.
  - Cross-filtering: click a chart element to filter other charts.
  - Drill-to-detail modal: view row-level data behind a chart.
  - Chart interaction menu: view chart, edit chart, export CSV, download image, share, embed, drill by dimensions.
  - Dashboard tabs allow switching between different layout tabs.
  - Code: `superset-frontend/src/dashboard/containers/Dashboard.tsx`

- **Dashboard Edit / Builder** — `/dashboard/{id}/edit`
  - Drag-and-drop dashboard builder.
  - Component palette: Chart, Header, Markdown, Divider, Row, Column, Tab.
  - Canvas grid with resizable and draggable components.
  - Chart picker modal to select existing charts or create new ones.
  - Component properties panel: title, description, chart settings, CSS class, row/column sizing.
  - Dashboard properties: title, slug, color scheme, CSS template, dashboard-level filters, owners, tags, certification/description.
  - Native filter configuration: create and position filter components, choose target charts, set default values.
  - Preview mode and Edit mode toggles.
  - Save Dashboard button.
  - Code: `superset-frontend/src/dashboard/containers/DashboardBuilder.tsx`

**Charts**

- **Chart List** — `/chart/list/`
  - Lists all charts with columns: chart name, visualization type, dataset, database/schema/table, modified, created by, owners, tags, favorite.
  - Search by chart name, filter by type, dataset, owner, tag, favorite.
  - Actions per chart: edit, view, export, delete, duplicate, change owners, toggle favorite.
  - Bulk select for delete/export.
  - Create Chart button.
  - Import Chart button.
  - Code: `superset-frontend/src/views/CRUD/chart/ChartList.tsx`

- **Chart Explore** — `/explore/`
  - Core chart-building interface.
  - Left panel: dataset selector, chart type selector, time range, filters, dimensions, metrics, percent metrics, sort by, row limit, series limit, breakdowns, custom SQL, saved metrics, ad-hoc metrics, saved filters, annotations, color scheme.
  - Center panel: live chart preview, hover tooltips, legend toggle, drill-down, drill-by, download as image, download CSV, fullscreen.
  - Right panel tabs:
    - **Data**: dataset, query mode, time range, filters, dimensions, metrics, sort, row limit, URL parameters.
    - **Customize**: chart-specific controls for colors, axes, labels, tooltip, legend, grid, stack, order, opacity, rich tooltip, Y axis bounds, log scale, number formatting.
    - **Query**: rendered SQL query, query JSON, query status, query history, run button, stop button.
    - **Results**: tabular query results, pagination, column stats, export CSV.
  - Save Chart button: name, dataset, owners, tags, save to dashboard option.
  - Share/Embed button: generate iframe or standalone chart URL.
  - View Query button to inspect SQL.
  - Code: `superset-frontend/src/explore/index.tsx`, `superset-frontend/src/explore/components/ExploreViewContainer.tsx`

**SQL Lab**

- **SQL Lab editor** — `/sqllab/`
  - Main workspace for writing and running SQL.
  - Left panel: database selector, schema selector, table browser with expandable tables/columns, search for tables.
  - Center panel: multiple SQL editor tabs, SQL editor with syntax highlighting, autocomplete, template parameters, query timer, run button, stop button, run selection, limit field.
  - Query results area: data grid, preview, export CSV/Excel, copy data, visualize results as chart, explore data in chart editor, save query.
  - Query history tab: list of recent queries with status, SQL, rows returned, duration, error messages.
  - Saved queries tab: list of saved SQL queries with open/edit/delete actions.
  - Share button to generate SQL Lab query link.
  - Code: `superset-frontend/src/SqlLab/index.tsx`

- **Saved Queries List** — `/savedquerylist/list/`
  - Lists saved SQL queries with columns: name, database, schema, saved by, modified, description.
  - Actions: open in SQL Lab, edit, delete, export.
  - Search and filter.
  - Code: `superset-frontend/src/views/CRUD/savedquery/SavedQueryList.tsx`

- **Query History** — `/sqllab/history/`
  - Lists executed queries with columns: time, user, database, schema, rows, status, SQL preview.
  - Search by user, database, time range, status, SQL text.
  - Actions: open in SQL Lab, view full SQL, see error details.
  - Pagination.
  - Code: `superset-frontend/src/SqlLab/components/QueryHistory.tsx`

**Data and Semantic Layer**

- **Dataset List** — `/tablemodelview/list/`
  - Lists datasets with columns: name, type (physical/virtual), source (database.schema.table), main datetime column, columns, metrics, created by, modified.
  - Search by name, filter by database, schema, owner.
  - Actions: edit, explore, delete, refresh metadata, duplicate, view.
  - Create Dataset button.
  - Code: `superset-frontend/src/views/CRUD/data/dataset/DatasetList.tsx`

- **Dataset Editor** — `/dataset/add/` and `/dataset/edit/{id}`
  - Tabs:
    - **Columns**: list columns with name, type, groupable, filterable, description, expression for calculated columns; add/edit/delete columns.
    - **Metrics**: list metrics with metric name, SQL expression, d3 format, warning text, description; add/edit/delete metrics.
    - **Data**: preview data from the underlying table, sample rows.
    - **Settings**: dataset name, description, database, schema, table, main datetime column, default endpoint, time grain, cache timeout, owners, virtual dataset SQL, offset, fetch values predicate, template parameters.
  - Code: `superset-frontend/src/views/CRUD/data/dataset/DatasetEditor.tsx`

- **Database List** — `/databaseview/list/`
  - Lists database connections with columns: database name, backend, exposed in SQL Lab, allow run sync, allow DML, allow CSV upload, modified by.
  - Actions: edit, delete, test connection, scan schemas/tables.
  - Add Database button.
  - Code: `superset-frontend/src/views/CRUD/data/database/DatabaseList.tsx`

- **Database Editor** — `/databaseview/add/` and `/databaseview/edit/{id}`
  - Modal or page with tabs:
    - **Connection**: database name, SQLAlchemy URI, server certificate, extra parameters, impersonate user, expose in SQL Lab, allow DML, allow CTA, allow CSV upload, allow run sync, secure extra, encrypted extra.
    - **Performance**: query cache, cache timeout, asynchronous execution, concurrency, force SQL Lab, template parameters.
    - **SQL Lab Settings**: query timeout, max rows, default schema, default limits.
    - **Security**: owners.
    - **Advanced**: version, schema cache, SSH tunnel.
  - Test Connection button.
  - Code: `superset-frontend/src/views/CRUD/data/database/DatabaseModal.tsx`

- **Upload CSV / Excel** — `/csvtodatabaseview/form`, `/exceltodatabaseview/form`
  - Upload local CSV or Excel file.
  - Select target database, schema, table name.
  - CSV options: delimiter, header row, parse dates, null values, dataframe index.
  - Preview data before import.
  - Import into database table.
  - Code: `superset-frontend/src/views/CRUD/data/upload/UploadCsv.tsx`, `superset-frontend/src/views/CRUD/data/upload/UploadExcel.tsx`

**Alerts and Reports**

- **Alerts List** — `/alert/list/`
  - Lists alerts with columns: name, type, trigger, schedule, last run, status, active.
  - Search and filter.
  - Actions: edit, delete, enable/disable, test.
  - Add Alert button.
  - Code: `superset-frontend/src/views/CRUD/alert/AlertList.tsx`

- **Reports List** — `/report/list/`
  - Lists reports with columns: name, type, schedule, last run, status, active.
  - Actions: edit, delete, enable/disable, test.
  - Add Report button.
  - Code: `superset-frontend/src/views/CRUD/report/ReportList.tsx`

- **Alert/Report Editor**
  - **Condition**: SQL query for alert, value comparison, threshold, validation type.
  - **Schedule**: cron expression, timezone, delivery type (email, Slack, webhook), recipients, message, log retention.
  - **Content**: for reports, select dashboard or chart, choose dashboard filter values.
  - **Actions**: test, save, enable/disable.
  - Code: `superset-frontend/src/views/CRUD/alert/AlertReportModal.tsx`

**Manage and Customization**

- **Annotation Layers List** — `/annotationlayer/list/`
  - Lists annotation layers with columns: name, description, annotation type.
  - Actions: add, edit, delete.
  - Editor: name, annotation type (time series, interval, event), start/end fields, description, JSON metadata.
  - Used by chart annotations to mark events on visualizations.
  - Code: `superset-frontend/src/views/CRUD/annotationlayers/AnnotationLayerList.tsx`

- **CSS Templates List** — `/csstemplates/list/`
  - Lists CSS templates with columns: name, description.
  - Actions: add, edit, delete.
  - Editor: template name, CSS code.
  - Can be applied to dashboards from Dashboard properties.
  - Code: `superset-frontend/src/views/CRUD/csstemplates/CssTemplateList.tsx`

- **Tags List** — `/tag/list/`
  - Lists tags used on dashboards and charts.
  - Actions: add, edit, delete.
  - Tag editor: name, type.
  - Code: `superset-frontend/src/views/CRUD/tags/TagList.tsx`

- **Import/Export** — `/importexport/`
  - Import dashboards, charts, databases, datasets from ZIP/JSON/YAML file.
  - Export actions are available from individual list pages.
  - Code: `superset-frontend/src/views/CRUD/importexport/ImportExport.tsx`

**Admin and Security**

- **Users List** — `/users/list/`
  - Lists users with columns: username, first name, last name, email, active, roles, database access, data source access.
  - Search and filter.
  - Actions: edit, delete.
  - Add User button.
  - Code: `superset-frontend/src/views/CRUD/users/UserList.tsx`

- **User Editor**
  - First name, last name, username, email, active flag, password.
  - Roles assignment checkboxes.
  - Database access and datasource access assignment.
  - Extended user fields if configured.
  - Code: `superset-frontend/src/views/CRUD/users/UserModal.tsx`

- **Roles List** — `/roles/list/`
  - Lists roles with columns: name, permissions, user count.
  - Actions: edit, delete.
  - Add Role button.
  - Code: `superset-frontend/src/views/CRUD/roles/RoleList.tsx`

- **Role Editor**
  - Role name.
  - Permissions checkboxes grouped by view/menu.
  - Users assigned to role.
  - Code: `superset-frontend/src/views/CRUD/roles/RoleModal.tsx`

- **Permissions List** — `/permissions/list/`
  - Lists all permissions with columns: name, view/menu, action.
  - Search and filter.
  - Read-only view of generated Flask-AppBuilder permissions.
  - Code: `superset-frontend/src/views/CRUD/permissions/PermissionList.tsx`

- **Row Level Security List** — `/rowlevelsecurity/list/`
  - Lists RLS filters with columns: name, filter type, tables, roles, clause, group key, description.
  - Actions: add, edit, delete.
  - Used to enforce row-level security on datasets.
  - Code: `superset-frontend/src/views/CRUD/rowlevelsecurity/RowLevelSecurityList.tsx`

- **Row Level Security Editor**
  - Name, filter type (regular or base), tables, roles, group key, clause (SQL WHERE condition), description.
  - Code: `superset-frontend/src/views/CRUD/rowlevelsecurity/RowLevelSecurityModal.tsx`

- **Action Log** — `/log/`
  - Lists user actions with columns: time, user, action, object, object ID, dashboard, chart.
  - Search and filter by user, action, object, time range.
  - Pagination.
  - Code: `superset-frontend/src/views/CRUD/log/LogList.tsx`

**Other Pages**

- **About** — `/about`
  - Displays Superset version, license, and links.
  - Code: `superset-frontend/src/views/About.tsx`

- **Health check** — `/health`
  - Returns application health status, useful for monitoring.
  - Code: `superset/views/core.py`

**Current State Relevant to Proposed Additions**

- No AI-native conversational BI page or chat interface exists in Superset today.
- No TanStack-powered visualizations or headless AI chart generation are present; Superset uses its own visualization plugin system.
- No browser-side DuckDB-WASM processing for local files; CSV/Excel upload currently imports into a backend database.
- No self-healing SQL query engine; SQL Lab shows raw database errors and requires manual SQL rewriting.
- No automated root cause analysis or anomaly detection feed; alerts/reports are rule-based and require manual SQL definitions.
- Row-level security exists but is not automatically injected by an AI; it is configured manually per dataset and role.
  </reference_spec>

### Phase 2 — The AI-native layer (where this stops being a Superset clone)

Everything in Phase 1 is table stakes. The "Current State Relevant to Proposed Additions" section above is the actual brief — it's Superset itself telling you what it's missing. Use it as the seed list, and build each addition as an H3 handler under `routes/api/ai/` (e.g. `routes/api/ai/query.post.ts`, `routes/api/ai/insights/[dashboardId].get.ts`) with the corresponding frontend surface living inside the equivalent Phase 1 page, not as a separate bolted-on section:

- A conversational BI interface alongside (not replacing) Chart Explore and Dashboard View — ask a question in plain language, get a chart or filtered view back, with the underlying query always inspectable.
- Natural-language-to-SQL inside SQL Lab, with the generated SQL always shown and editable before running — never a black box that just returns results.
- Self-healing query assistance: when a query errors, offer a diagnosed fix inline instead of just surfacing the raw database error.
- Anomaly/insight surfacing on dashboards — flagging what changed and why, not just rendering static charts.
- Any AI suggestion anywhere in the product must be visibly reviewable and reversible. Nothing silently rewrites a user's query, chart, or permissions without a visible diff and an explicit confirm.

There's no agent/LLM framework wired into this repo yet, so that choice has to be made deliberately and stated, not defaulted to. Keep any API keys and model calls server-side inside the Nitro/H3 handlers — never in client-bundled code or exposed `VITE_*` env vars.

### Phase 3 — Design direction: this must not look AI-generated

This repo already made real design decisions instead of taking Tailwind defaults — OKLCH color space (not plain hex/HSL), Space Grotesk instead of a system font, a proper shadcn/`cva` component pattern. Build on that discipline; don't override it with something generic.

1. **Audit before adding.** Read every token already defined in `src/index.css` (`:root` / `.dark` / `@theme inline`) before introducing new ones. Extend the existing OKLCH palette with consistently named tokens rather than bolting on a second, differently-structured system.
2. **Name the actual defaults to avoid.** AI-generated interfaces right now cluster around a few unmistakable tells: warm cream backgrounds with a high-contrast serif and a terracotta accent; near-black backgrounds with a single bright acid-green or vermilion accent used everywhere; broadsheet-style hairline-rule layouts with zero border-radius. This repo's OKLCH-driven system is already a step away from that — keep making decisions, not defaults, as it grows.
3. **Typography is a decision, not a given.** Space Grotesk is already configured — decide deliberately whether it also serves a dense data-table context or whether a second face is genuinely needed for tabular/numeric data, and make that choice via `configs/fonts.config.ts` with a stated reason, not by habit.
4. **Respect that this is a working tool, not a marketing surface.** Information density, scanability, and consistency across dozens of list views, editors, and modals matter more than any single striking moment. The opportunity for a distinctive identity is in color discipline, empty/error states, and the AI-native surfaces from Phase 2 — not in decorating every screen.
5. **Spend boldness in one or two places, not everywhere.** The AI chat/insight surfaces are the reasonable place to let the design be more expressive. Keep CRUD list pages, editors, and admin screens disciplined and quiet by comparison.
6. **Write real microcopy.** Button labels say what happens ("Save changes," not "Submit"), empty states tell the user what to do next, errors state what went wrong and how to fix it.
7. **Self-critique before calling anything done.** After building a page, check it against the token system: does it look like what any AI tool would produce for "a BI dashboard" with no other context? If yes, revise it.

### Working method

- **Don't use git unless told** — this applies here too. Use a todo list and phase checkpoints (summarize what changed, screenshot where possible) as the review mechanism instead of commits.
- Work in reviewable phases: Phase 0 audit → one representative page built end-to-end and reviewed → rest of Phase 1 parity → Phase 2 AI layer. Don't scaffold everything at once.
- Before calling any phase done: `npm run lint` (zero warnings) and `npm run build` (tsc + Vite build) must pass. There's no test runner configured — don't add jest/vitest/playwright unless explicitly asked.
- If anything here conflicts with what Phase 0 finds already built, say so explicitly and propose the adjustment rather than silently picking one.

### Definition of done

- Every page in the Phase 1 reference spec has a working equivalent under `src/pages/` + `routes/api/`, or a documented, deliberate reason it was scoped out.
- The Phase 2 AI-native additions are integrated into the relevant existing pages, not isolated as a separate "AI" tab.
- The token system in `src/index.css` is extended consistently, not duplicated, across list pages, editors, dashboards, and AI surfaces.
- `npm run lint` and `npm run build` pass cleanly.
- No page, looked at cold, reads as a generic template — each one reflects a decision, not a default.

---

## Known gaps (Phase 1 — documented deferrals)

- ~~**Saved Queries / Query History as standalone routes** — spec requires `/savedquerylist/list/` and `/sqllab/history/` as real list pages. Previously tabs inside `/sqllab/` only.~~ **Resolved 2026-08-16** — standalone routes now exist: `src/pages/savedquerylist/list/index.tsx` (columns: name, database, schema, saved by, modified, description; actions open/edit/delete/export; search + database filter) and `src/pages/sqllab/history/index.tsx` (columns: time, user, database, schema, rows, status, SQL preview; search by user/database/time range/status/SQL; actions open/view full SQL/error details; pagination), backed by `routes/api/savedqueries/index.get.ts` + `routes/api/sqllab/history/index.get.ts` reading the same `src/data/sqllab.ts` `mockSavedQueries`/`mockHistory` as SQL Lab. SQL Lab's inline History/Saved tabs are now compact previews (5 most recent) with "View all →" linking to the full pages — avoids two full implementations of the same list.

- ~~**Upload CSV / Excel** — spec requires `/csvtodatabaseview/form` and `/exceltodatabaseview/form` as distinct routes.~~ **Resolved 2026-08-16** — two spec routes plus a short `/uploads` alias share one component at `src/pages/csvtodatabaseview/form/index.tsx` (canonical) with thin re-exports at `src/pages/exceltodatabaseview/form/index.tsx` and `src/pages/uploads/index.tsx`, toggled by `location.pathname`. Flow: local CSV/Excel file → target database/schema/table → CSV options (delimiter, header row, parse dates, null values, dataframe index) → real client-side preview (hand-rolled delimiter/quote-aware parser, 100-row cap, real FileReader of dropped file — not seeded) → `POST /api/uploads` (`routes/api/uploads/index.post.ts`). Decision: no `papaparse`/`sheetjs` added — `package.json` has no CSV dep, hand-rolled parser verified sufficient for placeholder; production backend will parse anyway. Excel binary `.xlsx` (ZIP) shows an honest guidance note to export as CSV first; full binary parsing deferred until a backend parser is wired. Import mutates the canonical `seedDatabases` (`src/data/databases.ts`) in-memory: new table pushed into `db.schemas[].tables` (columns as `varchar`, rowCount from preview), `db.modified`/`modifiedBy` bumped — so the table immediately appears in Database Editor schema list and is selectable when creating a Dataset (single source, no forking, same discipline as dataset / saved-query seeds). Resets on restart. Worth doing now: completes the data-creation loop and proves the plumbing isn't a dead-end toast.

- **Explore / Chart builder (`/explore/`) — TanStack pivot 2026-08-16** — 8 live via `@tanstack/charts` 0.14.0 marks-and-channels (Bar `barY`, Line `lineY+dot`, Area `areaY`, Scatter `dot`, Heatmap `rect`, Box Plot `boxY`) + Table/Big Number widgets, all as `src/components/charts/ChartRenderer.tsx` with OKLCH `chart-1..5`/Space Grotesk tokens and `React.lazy` code-splitting (`ChartRenderer-*.js` 134 kB chunk). Real client-side aggregation of `sampleRows` (`DatasetColumn/Metric` contract) with four tabs (Data/Customize/Query/Results). **Honest deferrals at 0.14.0 exports boundary:** Pie/Donut (`polar-pie` not exported), Violin (`violinY` not re-exported), Treemap/Sunburst (need tree), Sankey (needs graph), Gauge (no mark) — rendered as `DeferredCard` with reason, not faked. Also deferred thin: annotations, metric-builder UI, palette beyond default, embed/share — same honesty as first pass. See `routes/api/charts/index.post.ts` (ALLOWED 15 viz) and `vite.config.ts` optimizeDeps.


- **Dashboard View (`/dashboard/{id}`) — first pass 2026-08-16** — header (title/tags/owners/modified/favorite/share/export/edit/refresh/auto-refresh/fullscreen), static native filter bar (visual-only, no chart mutation), canvas as 12-col CSS Grid rows rendering `Dashboard.layout` (`header|markdown|divider|chart` cells) with token-styled chrome (`bg-card`/`border-border`/`bg-muted` gaps) and lazy `ChartRenderer` per chart cell (Chart → Dataset lookup via `seedCharts`/`seedDatasets`, aggregation of `sampleRows`). Empty `layout: []` shows deliberate CTA to Explore/Chart List. Seed strategy: 3 dashboards have real layouts (Executive KPI Overview #1 · Revenue Attribution #2 · Marketing Spend vs ROAS #6) referencing live chart IDs; remaining 21 are empty (proves wiring without forging 24 bespoke grids). **Explicitly deferred (not half-built):** dashboard tabs, chart interaction menu (view/edit/export CSV/image/share/embed/drill-by). Drill-to-detail and cross-filtering now live for Bar charts (see Phase 2 entries) — Line/Area/Scatter/Heatmap/Box Plot deferred; drill-by-dimension and export from drill modal deferred.

- ~~**Dashboard Edit / Builder (`/dashboard/{id}/edit`) — drag-and-drop canvas** — spec requires `Row/Column/Tab` nesting, resizable/draggable components via `React-Grid-Layout`, dashboard properties (color scheme/CSS template/dashboard-level filters/owners/tags/certification), and native filter configuration.~~ **Resolved 2026-08-16 — functional Edit Mode** — `src/pages/dashboard/[id]/edit.tsx` + `routes/api/dashboards/[id].put.ts` (in-memory `seedDashboards` mutation, same discipline as chart save; `PUT` validates `DashboardLayoutRow[]` span 1–12 + `chartId` existence). Functional canvas: shows existing `layout`, add/remove rows/cells, Chart Picker slide-over selecting from `seedCharts` (search by name/viz/dataset, append as new row `span 6` or into an existing row), `header`/`markdown` append + inline edit (level 1/2/3, textarea for markdown), span selector (`4/6/8/12`), delete cell/row, **Preview / Edit toggle** and **Save Dashboard** (also patches `title`/`description` + bumps `modified`/`modifiedBy`). Simple palette `Charts / Headers / Markdown` — `Tabs`/`Dividers` intentionally deferred. Distinct edit chrome: dashed 12-col overlay via `--border`/`--muted` (18% opacity, `lg:block` only) and `bg-card/80` + `border-dashed` row cards so it reads as a BI layout tool, not a Wix-style website builder; `Preview` reuses the same `ChartRenderer` path as view (no forked rendering). **Deferred / honest gaps:** true drag-and-drop reordering + pixel resize (currently add/remove/span-select only), nested `Row→Column→Tab` hierarchy, column resizing within a row, CSS template & color-scheme picker, dashboard-level native filter config, and owner/tag/certification editors — all require either `react-grid-layout` or a bespoke DnD engine and are the next structural lift.

- ~~**Datasets / Databases / Saved Queries — missing POST/PUT/DELETE (P0-3)** — list pages had Create/Edit/Delete UI wired to `localRows` toasts with no persistence.~~ **Resolved 2026-08-16 — Batch 2** — 9 handlers + test endpoint, all Drizzle + Postgres, no `src/data` imports:
  - Datasets: `routes/api/datasets/index.post.ts` (validate `databaseId` exists, virtual requires `sql`, physical requires `schema+tableName`, `db.transaction` INSERT `datasets` + `dataset_columns`/`dataset_metrics` junctions), `[id].put.ts` (partial `modifiedAt` bump, DELETE+re-INSERT junctions when arrays supplied), `[id].delete.ts` (cascade via FK).
  - Databases: `index.post.ts` (validate `name`/`sqlalchemyUri`/`backend`, slug→text PK with uniqueness suffix, `templateParams` JSON parse, full `DatabaseConnection` flags `exposeInSqlLab`/`allowDml`/`allowCta`/`allowCsvUpload`/`queryCache` etc, transaction INSERT `databases` + nested `schemas→tables→columns` via `returning()` ids), `[id].put.ts` (partial patch including alias `exposedInSqlLab`/`allowDML` normalisation, wholesale schema replacement when `schemas` supplied — DELETE cascade then re-INSERT), `[id].delete.ts` (409 if any `datasets.databaseId` references it, otherwise DELETE cascades schemas/tables/columns).
  - Saved queries: `index.post.ts` (validate `label`/`sql`/`databaseId` exists, fallback `createdById`), `[id].put.ts` (patch `label`/`sql`/`databaseId`/`schema`/`description`), `[id].delete.ts` (204).
  - Test Connection: `routes/api/databases/test.post.ts` — POST `{databaseId|sqlalchemyUri,backend}`; for `postgresql`/`postgres` runs `pool.query("SELECT 1")` on the shared `pg` Pool (same as `execute.post.ts`) and returns `{ok, latencyMs}`; for BigQuery/Snowflake/etc returns honest `{ok:false, message:"Test not implemented for <backend> — only Postgres can be probed live..."}`.
  - UI: `src/pages/datasets/index.tsx`, `databases/index.tsx`, `savedquerylist/list/index.tsx` now use `reloadKey`→re-fetch pattern (no `localRows` overlay), async `handleSave`/`handleDelete`/`handleDuplicate` (bulk loops) → `POST`/`PUT`/`DELETE` → `setReloadKey(k=>k+1)`, `saving` disables footer, `statusMessage` surfaced; Database List `Test connection` toasts real latency or honest deferral, row menu + bulk delete show 409 text. Lint 0 · build pass · grep confirms no handler imports `src/data/datasets|databases|sqllab`.

- ~~**Orphan mock handler (P0-4)** — `routes/api/users/[id].ts` shadowed the real `index.get/put/delete` pattern with hardcoded `John Doe/Jane Smith` mock.~~ **Resolved 2026-08-16 — Batch 3** — deleted entirely after confirming `grep -R "users/\[id\]" routes/` returned no references. `routes/api/users/` now contains only `index.get/post` + `[id].get/put/delete.ts`; `grep -R "src/data" routes/` verifies zero runtime `src/data` imports (only `src/db/seed.ts` legitimately imports seed data).

- ~~**SQL Lab table tree still mocked (P2-6)** — left panel tree read from `mockDatabases` (`src/data/sqllab.ts`) instead of the live handler.~~ **Resolved 2026-08-16 — Batch 3** — `src/pages/sqllab/index.tsx` now fetches `GET /api/sqllab/databases` on mount (`SqlDatabase` shape: database → schemas → tables → columns). Removed `mockDatabases` import (file retained for seed); `src/data/sqllab.ts` no longer drives UI. States `databases: SqlDatabase[]` + `treeLoading/treeError/selectedDb` + `useEffect` cancellation guard with `ids.has(selectedDb)` coalescing; `db`/`schema` nullable with fallbacks (`db ?? null`, empty tables fallback); selects disabled while loading; tree panel shows loading shimmer / red `border-destructive/30 bg-destructive/10` error card with `GET /api/sqllab/databases failed — no mock fallback`; footer updated to `Live — /api/sqllab/databases · X databases` with `code` tag, never silently falls back to mock.

- ~~**Dashboard/Chart list "View/Edit" were toasts (P2-7-8)** — Dashboard List View/Edit showed `showToast` placeholders; Chart List View/Edit same, plus `Link to="/explore?chart="` used wrong param.~~ **Resolved 2026-08-16 — Batch 3** — `src/pages/dashboard/index.tsx`: `View` → `navigate('/dashboard/{id}')`, `Edit` → `navigate('/dashboard/{id}/edit')` (real routes `src/pages/dashboard/[id].tsx` + `[id]/edit.tsx`), both with `setOpenMenu(null)` guard. `src/pages/chart/index.tsx`: `View`/`Edit` → `navigate('/explore?chartId={id}')`, inline name link fixed to `chartId`. New handler `routes/api/charts/[id].get.ts` (`2.66kB`) returns enriched single-chart shape (dataset/database/schema/table via parallel `db.select` + TS maps, same derivation as `index.get`) for hydration. `src/pages/explore/index.tsx`: added `?chartId` hydration `useEffect` — parses `chartId` (legacy `chart` fallback), `GET /api/charts/:id`, populates `vizType/datasetId/dimension/metric` via `seedDatasets` groupable-column lookup, toast `Loaded "Name" — review and Save`, cancellation guard. End-to-end `Chart List → Explore → Save` verified; removes all `showToast("View — opens … Phase 1 next")` placeholders.

- ~~**Main chunk over 500kB budget (Bundle P2)** — audit flagged 827kB main bundle; `importMode: "sync"` bundled all routes, no `manualChunks`.~~ **Resolved 2026-08-16 — Batch 3** — `vite.config.ts`: `Pages({ importMode: "async" })` (per-route async chunks, e.g. `index-BPJoPGYq 37kB`, `index-CAhOwynV 20kB`) + `build.rollupOptions.output.manualChunks: { tanstack: ["@tanstack/charts","@tanstack/charts/react"], vendor: ["react","react-dom","react-router"] }`. Verified `npm run build`: `index-Ch5sXVvQ.js 192kB` (<500kB) vs prior 772kB, `tanstack-Du_2-ReU.js 117kB`, `vendor-BRxuD_iq.js 33kB`. Lint 0 · build pass.

## Phase 1 progress (running record)

- **Done** — Dashboard List, Chart List, SQL Lab (with compact History/Saved previews), Database List + Editor, Dataset List + Editor, Saved Queries standalone, Query History standalone, Upload CSV / Excel — the full **Data and Semantic Layer** per the reference spec is now closed. **Explore (`/explore/`) first pass** — dataset selector → Bar/Line/Table/Big Number live preview (recharts, client-side `sampleRows` aggregation, `DatasetColumn`/`DatasetMetric` contract reused from `src/types/dataset.ts`, SQL + results inspectable, Save via `POST /api/charts` into `seedCharts` so Chart List sees it); remaining 8 viz types + annotations/metric-builder/palette/embed deferred. Single canonical seed remains `src/data/databases.ts` (supplemented by `src/data/sqllab.ts` derived view, `src/data/datasets.ts` hand-authored against real seeds, `src/data/charts.ts` now mutable via `routes/api/charts/index.post.ts`, and `routes/api/uploads` in-memory mutation).
- **Dashboard View** (`/dashboard/{id}`) canvas — header + filter bar + 12-col grid with `ChartRenderer` reuse, empty-state CTA; 3 seeded layouts live, 21 empty (explicit strategy).
- **Dashboard Edit / Builder** (`/dashboard/{id}/edit`) — functional Edit Mode canvas (add/remove/span, Chart Picker slide-over, header/markdown inline edit, Preview/Edit toggle, Save via `PUT /api/dashboards/:id`); dashed 12-col overlay; Tabs/Dividers + true DnD deferred.
- **DB foundation (Step 1/2) — 2026-08-16** — PostgreSQL `metrics_bi` + Drizzle ORM wired: `src/db/schema.ts` (19 tables faithful to `src/types/*`), `src/db/index.ts` (sole `Pool`/`drizzle`), `src/db/seed.ts` (idempotent `TRUNCATE … CASCADE` → insert preserving FK chains; bumps serial sequences; prints summary). Coverage fix 2026-08-16: `src/data/datasets.ts` expanded 8 → 23 so every chart's `dataset` string resolves to a real `datasetId` (15 datasets added: product_events, support_tickets, supply_chain, nps_responses, infra_cost, sessions, cohorts, slo_events, experiments, partner_payouts, search_events, ltv, incidents, retention_logs, crashes). Seed now 11 users / 6 dbs / 23 datasets / 24 charts (0 null `datasetId`) / 24 dashboards / 52 tags / 3 saved / 4 history.
- **DB handlers (Step 2) — 2026-08-16** — 8 GET handlers migrated to Drizzle `db.select().from(...).where(...).orderBy(...).limit(...).offset(...)` (no `relations`/`db.query`), joining via parallel `select`s + TS maps to preserve exact `{data,total,page,pageSize}` + filter/sort/pagination semantics: `routes/api/dashboards/index.get.ts` (+ `[id].get.ts`), `routes/api/charts/index.get.ts` (resolves `dataset`/`database`/`schema`/`table` via `datasets`/`databases` join), `routes/api/datasets/index.get.ts`, `routes/api/databases/index.get.ts`, `routes/api/sqllab/databases/index.get.ts` (projects to `SqlDatabase`), `routes/api/savedqueries/index.get.ts`, `routes/api/sqllab/history/index.get.ts`. Mutations migrated: `dashboards/index.post.ts` (create + owner), `dashboards/[id].put.ts` (validates `layout` span 1–12 + `chartId` exists, `UPDATE`), `dashboards/[id].delete.ts`, `dashboards/[id].post.ts` (favorite toggle `INSERT`/`DELETE`), `charts/index.post.ts` (validates `vizType` + `datasetId`, slug uniqueness, `INSERT` + owner), `charts/[id].delete.ts`, `charts/[id].post.ts` (favorite toggle), `uploads/index.post.ts` (transaction: find/create schema → check duplicate table → `INSERT` table + columns, bump `databases.modifiedAt`). List pages removed `localRows`/`seed` fallbacks (`catch` now shows error toast; mutations hit API — no more client-side data shadowing). `routes/api/sqllab/execute.post.ts` now real (Batch 1 / P0-1): `databaseId` lookup → `allowRunSync`/`allowDml` guards → `READ ONLY` + `statement_timeout 10s` + `LIMIT` guard → `pool.query` → `query_history` INSERT with `durationMs`/`rows`/`errorMessage`, no `getMockResult` import.
- **Batch 2 (P0-3) — 2026-08-16** — Datasets/Databases/Saved Queries mutations + Test Connection (see Known gaps resolved entry above). Stops before P0-4 (orphan `routes/api/users/[id].ts`) & P2-6 (SQL Lab tree wiring) per batch boundary.
- **Batch 3 audit cleanup (P0-4 / P2-6 / P2-7-8 / Bundle P2) — 2026-08-16** — closed the four remaining non-P3 gaps in one surgical pass: deleted orphan `routes/api/users/[id].ts` (no refs); SQL Lab tree now live from `GET /api/sqllab/databases` with loading/error states and no mock fallback; Dashboard List View→`/dashboard/:id` / Edit→`/:id/edit`, Chart List View/Edit→`/explore?chartId=:id` plus new `GET /api/charts/:id` and Explore hydration (chart param compat, vizType/dataset/dimension/metric wiring); code-split via `importMode: "async"` + `manualChunks {tanstack, vendor}` dropping main `192kB` (<500kB) with TanStack `117kB` / vendor `33kB` and per-route chunks. Lint 0 · build pass · `grep routes/ src/data` clean · `grep src/pages mockDatabases` clean. **Audit cleanup batch complete — remaining is P3 deliberately deferred.**
- **Alerts/Reports (Group B) — 2026-08-16** — schema extended `alerts`/`alert_runs` + `reports`/`report_runs` (cron, timezone, status, active, deliveryType, recipients array, sqlQuery/threshold/validationType for alerts; dashboardId/chartId/filterValues jsonb for reports); seeded 3 alerts + 3 reports (realistic cron `0 9 * * MON`/`0 */6 * * *`/`*/30 * * * *` with `alert_runs`/`report_runs`). 10 handlers `routes/api/alerts/*` + `routes/api/reports/*` (index.get with `?q/status/active/sortBy/sortDir/page/pageSize`, index.post, `[id].get` with recent runs, `[id].put`, `[id].delete` via `db.transaction`). Pages `src/pages/alert/list/index.tsx` + `src/pages/report/list/index.tsx` (dense table chrome matching Dashboard/Chart lists: columns name/type/trigger/schedule humanized/last run/status pill/active toggle; row actions edit/delete/enable+test; bulk delete; search+filter+pagination+sort) sharing `src/components/editors/AlertReportEditor.tsx` (640px slide-over, Condition+Schedule tabs for alerts / Schedule+Content for reports with dashboard/chart selectors from live API, cron helper `0 9 * * MON = Every Monday at 9am`, Test toast `Test alert sent to N recipients`, Save via POST/PUT + re-fetch). Nav `Govern` now `Alerts → /alert/list` + `Reports → /report/list`. `src/index.css` OKLCH tokens reused (`success`/`warning`/`destructive` for status, `muted` for cron); no new tokens.
- **Admin & Security (Group C) — 2026-08-16** — schema extended 9 tables in dep order `roles`/`permissions`/`role_permissions`/`user_roles`/`database_access`/`datasource_access`/`row_level_security_filters`/`rls_filter_tables`/`rls_filter_roles` (composite PKs, text PK for databases, serial for filters); `db:push` + seed 5 roles (Admin, Alpha, Gamma, Public, sql_lab), 22 perms (`dashboard:read/write` … `rls:write`), Admin→all, sql_lab→sql_lab:read/write, Public→dashboard:read chart:read, seeded users assigned (admin→Admin, analyst→Alpha+sql_lab, viewer→Public), 3 RLS filters (orders region for Public, support tickets team for Alpha etc) with tables/roles junctions; counts 11 users / 6 dbs / 23 datasets / 24 charts / 24 dashboards / 52 tags / 3 saved / 4 history / 3 alerts / 3 reports / 5 roles / 22 perms / 3 RLS. 13 handlers: `users/index.get` (`?q/active/role/sortBy/page/pageSize` JOIN user_roles→roles, database_access, datasource_access) + `index.post`/`[id].get`/`[id].put` (transaction delete+insert junctions) /`[id].delete`; `roles/index.get` (`?q/sortBy` JOIN role_permissions→perm names, user_roles→userCount) + `index.post`/`[id].get` (permIds + user names) /`[id].put`/`[id].delete`; `permissions/index.get` read-only (`?q/view/action` JOIN role_permissions→roles); `rowlevelsecurity/index.get` (`?q/filterType/role`) + `index.post`/`[id].get`/`[id].put`/`[id].delete` (transactions). Pages `src/pages/users/list`, `roles/list`, `permissions/list` (read-only, no bulk), `rowlevelsecurity/list` — dense chrome matching Alerts: searchable, filter/sort/pagination, bulk delete (except Permissions), row menu Edit/Delete, badges for roles/perms. Editors `src/components/editors/UserEditor.tsx` (first/last/username/email/active/password-on-create, roles checkboxes, db+datasource access), `RoleEditor.tsx` (name, perms grouped by view, users read-only), `RlsEditor.tsx` (name, filterType regular|base, clause textarea with WHERE hint, groupKey, description, tables multi-select db.schema.table, roles checkboxes) — 640px slide-over + backdrop + `overflow:hidden` lock. `AppShell` Govern now `Users → /users/list` `Roles → /roles/list` `Permissions → /permissions/list` `RLS → /rowlevelsecurity/list` with isActive. Tokens reused — no new CSS.
- **Auth & General (Group E) — 2026-08-16** — schema extended 2 tables `sessions` (token unique, userId FK, expiresAt) + `password_hashes` (userId PK/FK, hash text) via `src/db/auth.ts` helpers (`hashPassword` SHA-256 dev-only, `verifyPassword`, `generateToken`); `db:push` + seed 3 password hashes (all `password123` — dev-only, flagged) + 2 demo sessions (7-day expiry) for admin/analyst; counts now `… + 3 password hashes, 2 sessions`. 8 handlers: `auth/login.post` (verify active + hash → `INSERT sessions` → `{token,user}`), `auth/logout.post` (delete by Bearer/`x-session-token`), `auth/me.get` (validate expiry, join `userRoles→roles→permissions`), `welcome/index.get` (recent 5 dashboards/charts, favorites via `favorites` entityType, createdBy, `quickStats` counts — token-optional), `profile/index.get` (user+roles+favorites joined+`action_log` 10+created), `profile/index.put` (allow only `firstName/lastName/email`), `about/index.get` (read `package.json` version), `health/index.get` (SELECT 1 → `database: connected|error`). Pages: `login/index` (centered card, localStorage `metrics_session_token`, redirect `/welcome`, no demo credentials — "Use your admin credentials"), `welcome/index` (greeting, quick-action cards Create Dashboard/Chart/Connect DB/Upload/SQL Lab, Recent 5 + Favorites/Created tabs, stats bar, Resources links — dense tool chrome, no hero), `profile/index` (avatar initials, roles chips, tabs Info/Favorites/Activity/Created, editable Info form), `about/index` (dense dl version/license/links), `health/index` (public, green/red dots, SELECT 1), `index.tsx` → redirect by token. Auth integration: `src/hooks/useAuth.tsx` (`AuthProvider` + `getStoredToken`/`setStoredToken` in `localStorage` + `RequireAuth` wrapper + `login`/`logout`/`refresh` via `GET /api/auth/me`), wired in `src/main.tsx` (`BrowserRouter → AuthProvider → App`), `AppShell` top-bar user menu (Profile/About/Health/Logout, initials) + new `System` nav group (Health/About/Profile) with `isActive`. Tokens reused — no new CSS. Lint 0 · build pass · seed 11/6/23/24/24/52/3/4/3/3/5/22/3/4/3/8 +3 hashes 2 sessions verified. **Phase 1 closed — every spec page has a working equivalent.**
- **Minimal seed + First-run setup (2026-08-16, deliberate wipe)** — `src/data/*` rewritten to 1 `analytics` Postgres (own `metrics_bi`), 2 datasets orders/customers, 2 charts Revenue by Status/Orders Recent, 1 dashboard Orders Overview (header+markdown+2 charts). Owners `Sample` (id 0), no fake people/tags. `src/db/seed.ts` truncates + inserts minimal + creates real `public.orders`/`public.customers` tables + reports `users=0`/`roles=3`/`22 perms`. `routes/api/auth/status.get.ts` + `setup/initialize.post.ts` (409 guard, @/min8/unique, Admin default, transaction+token). `src/pages/setup/index.tsx` centered radial `var(--muted)`→`var(--background)` (460w, `M` mark, `Create your admin account`, step `Shield`/`Runs once`, pill roles, `Sample data: 1 dashboard · 2 charts` footer, Health link) — outside `AppShell`; `useAuth:RequireAuth` + `login/index` + `index.tsx` all honor `hasUsers`→`/setup`. Handlers' `modifiedBy` fallback `"Sample"` not `"Unknown"`. Verified: `DATABASE_URL=... PORT=... node .output/server/index.mjs` → `GET /api/auth/status {hasUsers:false,false}` → `POST /api/setup/initialize → 201 {token}` → `GET /status +Bearer → {true,true}` → second POST → `409` → `GET /api/dashboards total 1 Orders Overview Sample` → `GET /api/charts total 2` → `GET /api/datasets total 2` → `POST /api/sqllab/execute SELECT * FROM public.orders → 3 rows`. Reseeded after verify to leave `users=0`. Lint 0 · build 161.64kB · `setup/initialize 3.49kB`. **Phase 3 self-critique (setup):** reads as real product first-run (muted radial, Shield/step, "Runs once", Sample footer) not generic Intercom/cream-terracotta template; quiet OKLCH tokens only (`muted`/`background`/`card`/`border`/`primary`), no second palette, no illustration, microcopy states what happens next ("You'll be signed in and taken to the sample 'Orders Overview' dashboard" / "This screen won't appear again — later users are added from Users").
- **Auth enforcement fix (2026-08-16)** — diagnosis: `RequireAuth` defined in `src/hooks/useAuth.tsx` but never mounted in `src/main.tsx` (`BrowserRouter → AuthProvider → App` with no wrapper) so `/dashboard/*` etc rendered unauthenticated; `AppShell` also showed `—` but rendered children. Fixed: `src/main.tsx` now `BrowserRouter → AuthProvider → RequireAuth → App` (public `/setup`/`/login`/`/health` bypass, loading vs `statusChecked` prevents flash, `hasUsers===false→/setup` else `!user→/login`); new `src/lib/requireAuth.ts` `requireAuth(event)` validates `Authorization: Bearer` / `x-session-token` against `sessions` (expiry→delete, 401) and `AppShell` now has `useEffect !loading&&!user→/login` as safety net. Server: 85 protected handlers patched to `await requireAuth(event)` (`routes/api/auth/*`, `setup/*`, `health`, `about` remain public); `hello.ts`/`sqllab/databases/index.get.ts`/`settings/ai/index.get.ts` fixed to `async (event)`. Verified: without token `GET /api/dashboards|charts|sqllab/databases|sqllab/execute|welcome → 401`, `GET /api/health|about|auth/status → 200`; with token `→ 200` + `total 1 Orders Overview Sample`. `POST /api/setup/initialize` still `409` after first user. Reseeded to `users=0`. Lint 0 · build 161.64kB.
- **Beta v1.0 shipped (2026-08-17)** — Phase 1 (Superset parity) + Phase 2 AI layer complete. All reference pages live on real Postgres; see **Release History** below. Remaining are intentional P3 deferrals (Chart builder extended viz, dashboard DnD/tabs/CSS templates, Bar-only cross-filter/drill-by, AI stream/persistence/DuckDB/RLS) — listed under **Remaining Phase 2 deferrals** and **Known gaps** for next release.

## Phase 2 progress (running record)

- **SQL Lab AI — NL2SQL + Self-healing (first slice, 2026-08-16)** — `src/types/ai.ts` (`Nl2SqlRequest/Response`, `HealRequest/Response` with `_mock: true`) exported via `src/types/index.ts`. **Server-side only** handlers `routes/api/ai/nl2sql.post.ts` + `heal.post.ts` both read the REAL schema (`database_schemas→database_tables→database_table_columns` via Drizzle, same join as `sqllab/databases/index.get.ts`) and answer via keyword-template + Levenshtein suggestions — `nl2sql` covers `top 10 customers` → real `customers` columns, `orders per status` → `COUNT(*) GROUP BY status`, `daily revenue 30 days` → `DATE(created_at) + SUM(amount)`, plus generic fallback "mention of real table → SELECT real columns LIMIT 100" with `confidence` + `tablesUsed` + `explanation`; `heal` parses `relation "x" does not exist`/`column "y" does not exist`/`syntax`/`type mismatch`, suggests closest real table/column (Levenshtein ≤40% length) as `changes[]` + `diagnosis` + `fixedSql`, both set `x-mock-ai: 1` and ~200ms latency, flagged `MOCK` — swappable for a real LLM by keeping the contract and replacing the template branch (no `VITE_*` keys, no browser LLM calls). `src/pages/sqllab/index.tsx` — **Ask AI** collapsible bar above editor tabs (IDE-assist, not chatbot bubble): prompt input + `Generate SQL` (POST nl2sql) → loading → preview (highlighted SQL read-only via `highlightSql`, explanation, `tablesUsed` pills, `confidence` %, `MOCK — template + real schema` badge) + editable textarea (reversible) + `Insert into editor` / `Open in new tab` / `Dismiss` — **never auto-inserted or executed**; error area now includes **AI Assistant** card below raw error: `Diagnose` (POST heal) → loading → `diagnosis` + visible `before→after` diff pills + fixed SQL preview → `Apply fix` (explicit confirm, replaces editor, clears error, never auto-applied) / `Dismiss`, cleared on tab/error change. Token audit: extended `src/index.css` with **one quiet OKLCH family** `--ai`/`--ai-foreground`/`--ai-muted`/`--ai-border` (mapped in `@theme inline`, :root + .dark), used only for these two surfaces — subtle indigo against the monochrome base, avoids the cream/terracotta & acid-green tells; self-critique → Ask AI reads as IDE assist (collapsed bar, inline preview, editable) not a floating chat bubble. Lint 0 · build pass (`.output/server/chunks/routes/api/ai/nl2sql.post.mjs 7.7kB`, `heal 6.0kB`). Manual verify: `prompt "top 10 customers" → preview → Insert → Run` and typo `FROM orderz → Diagnose → Apply → Run` — both reviewable + reversible.
- **Conversational BI — headline surface (2026-08-16, mock)** — `src/types/ai.ts` extended with `ConverseContext/Request/Response/Action` (`surface: explore|dashboard`, `action: modify_chart|generate_chart|filter|explain|compare`, `sql/tablesUsed`, `_mock: true`). Handler `routes/api/ai/converse.post.ts` (server-side only, `x-mock-ai: 1`, 220ms, 9.8kB) reads REAL schema via Drizzle (`databaseSchemas→databaseTables→databaseTableColumns`), validates columns via exact match + Levenshtein fallback, parses intent by priority: `make it a line/bar/pie` → `modify_chart {vizType}`, `show me X by Y` → `generate_chart {chartConfig: {vizType,datasetId,dimension,metric}}`, `filter to …/where …` → `filter {filters:[{column,operator,value}]}`, `break down by / group by` → `modify_chart {dimensions,metrics}`, `compare/versus/last quarter` → `compare`, `what drove/why did/dip` → `explain`. Every branch returns conversational `reply` (grounded in real `schema.table`/`statusCol`/`amountCol`/`regionCol`) + inspectable `sql` + `tablesUsed`, never invented tables, flagged `MOCK` swappable for real LLM. **Explore** `src/pages/explore/index.tsx` — header `Ask AI` pill (`border-ai bg-ai-muted`, Sparkles) toggles a copilot drawer: right slide-over 380px on lg / bottom sheet 72vh on mobile, backdrop-blur, not a replacement for Data/Customize/Query/Results tabs. Flow: `Ask about this chart…` input + 4 chip suggestions + `Enter` → `POST /api/ai/converse {surface:"explore",datasetId,vizType,currentQuery}` → reply + `Propose:` pill + `tables:` mono + collapsible `View SQL` (`bg-editor`) + `Apply` (mutates `vizType/dimension/metric/filterText/datasetId` via existing state, e.g. `filter → setFilterText("col = val")`, `generate_chart → setVizType+setDimension+setMetricName`) / `Dismiss` (remove exchange), `Thinking — reading {ds.name} schema…` spinner, max 4 exchanges cap (`slice(-4)` + `slice(-3)` on push), error banner, `Not auto-applied` hint, note that this and SQL Lab NL2SQL are separate surfaces on same mock. **Dashboard View** `src/pages/dashboard/[id].tsx` — floating `Sparkles` FAB bottom-right with subtle `var(--ai)` gradient + `[0_8px_24px]` glow (boldest --ai surface, distinct from Intercom/Drift — data-aware, not support), opens 400px slide-over (backdrop-blur) with `Dashboard assistant` header + `MOCK · real schema` badge. Same endpoint with `{surface:"dashboard",dashboardId,chartIds}` from `layout` → conversational analysis + optional live `ChartRenderer` preview when `generate_chart` (resolves `seedDatasets` + `aggregateForChart` same aggregation as chart cells, 200px `Bar/Line` etc, `PREVIEW` badge) + `View SQL` + `Add to dashboard` (toast — real pin via Edit layout) / `Dismiss`, session-only memory (`useState` exchanges, cleared on unmount/page change), suggestions `what drove the dip in March? / compare this to last quarter`. Both surfaces share visible `MOCK` badges, `Apply/Dismiss` pattern consistent with NL2SQL/Heal (reviewable, reversible, diff/SQL always shown, nothing silent), reuse the one `--ai` token family (no new tokens; `bg-ai-muted/30`, `border-ai-border`, `bg-editor` for SQL). Token audit: no second system introduced, loading/error/empty states all token-styled, conversational panels avoid generic Intercom/chatbot tells via dense tool chrome, inline `Propose:` pills, mono `tables:` and `x-mock-ai: 1`. Lint 0 · build pass (converse 9.8kB). Manual verify: Explore → Ask AI → `make it a line chart` → Apply → chart swaps; Dashboard → FAB → `what drove the dip?` → analysis + SQL collapsible + optional chart.
- **Anomaly/Insight Surfacing — ambient intelligence (2026-08-16, mock)** — `src/types/ai.ts` extended with `InsightType/Severity/Insight/InsightsRequest/Response` (`trend|spike|drop|outlier|correlation`, `info|warning|critical`, `title/detail/chartId/sql/tablesUsed/confidence/change{before,after,delta}`, `_mock:true`). Handler `routes/api/ai/insights.post.ts` (server-side only, `x-mock-ai:1`, 300ms, 9.15kB) receives `{dashboardId,chartIds,datasets:{datasetId,sampleRows}[]}` — resolves real qualified tables via `datasets` DB (`schema.table`) for `tablesUsed`/`sql` (fallback `public.dataset_<id>`), then runs lightweight stats per dataset: numeric trend (last half vs prior half mean, `|delta|>10%` → `trend`/`spike`/`drop` with `severity>30% critical`/`>15% warning`/`>10% info`, `confidence 0.62+0.9*absDelta`), outlier (`mean/stddev`, `|z|>2` → `outlier`, `z>3 critical`), category shift (`share delta>20 pts` between halves → `correlation`). Generates natural titles (`revenue dropped 23%`, `orders spiked 41%`, `amount outlier: 982`, `region shift: "EMEA" gained 27 pts`) + detail with real column names/values, plausible SQL (`AVG(col)`, `WHERE ABS(col-mean)>2*sd`, `GROUP BY cat COUNT`), ranked `critical→warning→info` then `|delta|` then confidence, capped at 4 (no flooding). Client `src/pages/dashboard/[id].tsx` — **Insights strip** between header and canvas (not chat, not conversational): `border-ai-border`, `bg-ai-muted/30` expanded / `bg-card border-ai-border/50` collapsed, `rounded-lg shadow-sm`. Header row 32-36px when collapsed (label + count badge `bg-ai`/`bg-muted` + chevron + when collapsed truncated most-critical `title · delta` or `— stable`); when expanded: horizontal scroll `flex gap-3 overflow-x-auto` with 2-4 cards (no vertical feed, not a carousel) each `min-w-[300px] max-w-[340px] border-l-4` (`info→border-l-ai-border`, `warning→border-l-warning`, `critical→border-l-destructive`), `bg-card`, type icon (`TrendingUp` trend, `AlertTriangle` spike/drop, `Target` outlier, `GitBranch` correlation) with severity-tinted badge, `title` bold xs, `detail` xs muted `line-clamp-2`, `delta` mono pill (`text-destructive` if `-` else `text-success`), `View SQL` collapsible (`bg-editor`, same pattern as conversational, with `tables:`), `confidence` mono `xx%`, `View chart →` if `chartId`. Behavior: auto-fetches on mount via `POST /api/ai/insights` built from `seedCharts→seedDatasets` mapping (unique datasets, `sampleRows`), also on `refreshTick`; loading shimmer 3 pulse cards (not spinner, ambient), empty `No anomalies detected — data looks stable` with checked count (absence is information, strip stays), not dismissible (regenerates every load/refresh). **Chart badges** (Phase C): `ChartCell` now takes `insight?`/`highlighted`/`onInsightClick`; if `insightByChartId.get(chart.id)` shows a 12px `Sparkles` `bg-ai-muted border-ai-border` dot next to title with `title` tooltip; click expands strip (if collapsed), scrolls strip into view, highlights chart `ring-2 ring-ai-border` + card `ring-2` for 2s; conversely clicking an insight card scrolls to `chart-<id>` and highlights both. Only charts with insights get badges (e.g. 2 of 8). Token audit: reused existing `warning`/`destructive`/`success` for severity left border (no new `--ai-severity` scale), strip `bg-ai-muted/30` distinct from `bg-[color-mix(...muted 4%)]` canvas; collapsed 36px (`h-9` + header `py-2`) doesn’t eat real estate. Self-critique: strip reads as status/status-strip (horizontal scroll with `overflow-x-auto [-ms-overflow-style:none]`, not carousel; cards dense `title+delta` scannable in 2s, detail 2 lines max, not essay); `No anomalies` reads confident (muted + checked count) not apology; badges secondary affordance, strip primary. Lint 0 · build pass (insights 9.15kB). Manual verify: populated dashboard → strip 2-4 cards with severity/delta/SQL → click card highlights chart; stable dashboard → `No anomalies`; collapse → 36px header with badge + truncated title.
- **AI Settings + Real LLM wiring (2026-08-16, configurable provider)** — `src/db/schema.ts` `ai_settings` (serial PK, name/host/apiKey/model/temperature numeric default 0.20/maxTokens 4096/isActive boolean, modifiedById, timestamps) with single-active invariant (only one `isActive=true`; handlers read via `src/lib/llm/settings.ts` `getActiveLlmConfig(): Promise<LlmConfig|null>` — null when none/empty key → mock fallback). `src/lib/llm/client.ts` `callLlm(config, messages): Promise<LlmResponse>` POSTs `${host}/chat/completions` with `Authorization: Bearer`, 30s timeout, handles 401/404/429/timeout/empty. Seed one inactive example `Primary LLM https://api.openai.com/v1 gpt-4o` (empty key, `isActive:false`) so mock persists until user activates. **Settings API** `routes/api/settings/ai/` — `index.get` (masked `sk-...abcd`, `hasKey`), `index.post` / `[id].put` (isActive exclusivity via `UPDATE ... SET isActive=false WHERE isActive=true`), `[id].delete` (blocks deleting the only active), `test.post` (minimal `Say connected` call, returns `{success,message,latencyMs}`). **Page** `src/pages/settings/ai/index.tsx` → `/settings/ai` — focused config surface (not dense list): header + description, status banner (`warning` mock vs `success` `using {model} at {host}`), plaintext gap notice, provider cards (`isActive` green top-border + `Active` badge, `Set active`/`Edit`/`Delete` with confirm), Add/Edit 560px slide-over (Name/Host/API Key password toggle with `maskPreview` + masked hint, Model, Temperature 0-2 helper 0.1-0.3 for SQL, Max Tokens, isActive checkbox, `Test connection` → `POST /api/settings/ai/test` inline `success` `success/10` vs `destructive/10` with latency — uses `border-ai-border`/`bg-ai-muted/30`). Empty state explains Ollama `http://localhost:11434/v1` + `llama3`. **Wiring** all four AI handlers now branch on `getActiveLlmConfig()`: if null → existing Levenshtein/template mock (`_mock:true`, `x-mock-ai:1`); if config → schema-aware system prompts (nl2sql: `Postgres generator, ONLY real tables: {schema.table (col:type)}`, heal: `SQL fixer, tables: {list}`, converse: `BI copilot, actions modify_chart/generate_chart/filter/explain/compare, schema+context`, insights: `anomaly detector, summary stats server-computed prior/last means + std + categorical tops`) → `callLlm` → JSON parse stripping ``` fences → sanitize `tablesUsed` to real tables → return `_mock:false` (`x-mock-ai:0`) with identical contract (confidence/tablesUsed/sql always present). On LLM error returns `{error, statusCode:502, _mock:false}` (logged via `console.error`). **Types** `src/types/ai.ts` `_mock` widened `true` → `boolean` (true mock, false real). **Nav** `src/components/layout/AppShell.tsx` System now `Health/About/Profile/AI Settings → /settings/ai` (`Settings2`). Token audit: settings page uses only `card/muted/border/success/warning/ai-muted` — no new tokens; test result reuses `ai-muted/border` loading, `success/10` vs `destructive/10`. Lint 0 · build pass (nl2sql 10.06kB + heal 7.73kB + converse 12.84kB + insights 14.85kB + settings handlers 1-2.5kB). Manual verify: `/settings/ai` shows mock banner → Add provider → Test shows success/failure + latency → Set active → banner flips to success (`_mock:false`) → SQL Lab/converse/insights use real LLM → deactivate/delete → falls back to mock.
- **Remaining Phase 2 deferrals (honest)** — apiKey encryption at rest, streaming responses, multi-model routing (different models per task), conversation/insight persistence & caching beyond session (`useState` only, regenerates on load/refresh, 4-cap), headless AI chart generation beyond templates, browser DuckDB-WASM, AI auto-injected RLS. Cross-filtering for Line/Area/Scatter/Heatmap/Box Plot and cross-filter persistence across refresh remain deferred (see just above). Drill-to-detail for Line/Area/Scatter/Heatmap/Box Plot, drill-by-dimension (pivot to different dimension), and export from drill modal (CSV download of filtered rows) remain deferred.
- **Dashboard cross-filtering (Bar charts, 2026-08-17)** — click a bar to filter other charts. Dashboard-level `crossFilters: {chartId, dimension, value}[]` in `src/pages/dashboard/[id].tsx` with toggle behavior (same bar deselects, different bar in same chart replaces, different charts stack AND). `ChartCell` computes `relevantFilters` = other-chart filters whose `dimension` exists in its dataset, then `aggregateForChart(..., relevantFilters)` and filters `rawRows` before Table rendering (so Table shows only matching rows, Bar/Agg charts re-aggregate). Bar chart's own data stays unfiltered but gets highlight/dim. `ChartRenderer` Bar branch now takes `onCrossFilter?: (value)=>void` + `selectedValue?: string|null`: wraps `Chart` in `barWrapRef` div with click hit-test (SVG `rect` bounding boxes, fallback to nearest-bar by x) and `useEffect` that dims non-selected bars to `opacity 0.28` vs `1` with pointer cursor — no new tokens, no color change. Chips UI between insights strip and canvas: `bg-card border-border` pill per filter `{dimension}: {value}` with ×, `Clear` (1) / `Clear all` (2+), hidden when none, muted/border tokens only, hint line. Insights strip stays on unfiltered data (`POST /api/ai/insights` still from unfiltered `sampleRows`), cross-filters only affect chart rendering — verified side-by-side. Native filter bar hint updated from "Cross-filtering deferred" to "Click a bar … to cross-filter". `CellRenderer` now passes `crossFilters`/`onCrossFilter`/`selectedValue` to `ChartCell`. Lint 0 · build pass (server 164.9kB). Manual: Orders Overview (Bar + Table) → click Bar "completed" → Table shows only completed rows + chip `status: completed` → highlight/dim on Bar → same bar again clears → different bar replaces → multiple charts stack.
- **Dashboard drill-to-detail (Bar charts, 2026-08-17)** — complements cross-filtering: cross-filter filters *other* charts, drill shows *underlying rows* in place. New `src/components/charts/drill-detail-modal.tsx` — centered `role="dialog"` (`max-w-[920px]`, `max-h-[82vh]`, `bg-card/border-border`, `shadow-xl`, `bg-black/40 backdrop-blur`, `overflow:hidden` lock, Escape/backdrop close): header `Table2` + `title`/`subtitle` + `showingText` mono `Showing 1–25 of N · K columns`, table `w-full text-xs` with `bg-muted/40 sticky` header `name`+`type` mono, body `hover:bg-muted/40`, numbers right-aligned `toLocaleString`/`isNumber`, strings left, dates ISO, `--` for null, empty `No rows match this filter` (try different bar / clear cross-filters), footer `showingText` + `Prev/Page X of Y/Next` + `Close`, 25/page pagination (`rows.slice`). `ChartRenderer` Bar adds `onDrillDetail?: ({dimension,value})` via `onContextMenu` (hit-test reused from cross-filter via `getBarLabelAt` — rect bounding boxes + nearest-x fallback — `preventDefault` to suppress browser menu, right-click → drill; same `barWrapRef`). `src/pages/dashboard/[id].tsx` `ChartCell` now takes `onOpenDrill?: payload=>void` (title/subtitle/columns/rows): `relevantFilters`+`filteredRawRows` computed (other-chart filters AND; same reuse as cross-filter), `handleDrillAll` (header Table2 button `h-6 w-6 hover:bg-muted hover:border-border` `title="View row-level data"`) → `All rows from {source}` or `All rows — filtered by … · right-click any bar for single value`; `handleDrillDetail({dimension,value})` → `drillRows=filteredRawRows.filter(r=>String(r[dimension])===value)` → `Rows where {dim}="{value}"` + count subtitle (respects active cross-filters via `crossNote` AND logic) + dataset `columns`+`rows`. `CellRenderer`/`DashboardViewPage` plumb `onOpenDrill` + centralized `drill:{open,title,subtitle,columns,rows}` state (`openDrill`/`closeDrill`, page reset on open, lock scroll), render `<DrillDetailModal .../>` before toast, footer hint updated to `Bar: click to cross-filter, right-click / header icon for drill-to-detail. Drill-by / tabs deferred`. No new tokens (card/border/muted). Lint 0 · build pass (server 165.24kB). Manual: Orders Overview → right-click Bar "completed" → modal `Rows where status="completed"` with correct columns (name + type 11px), numbers right, 3 rows paginated footer; click header Table2 → `All rows`; with active cross-filter (Table shows completed) drill respects AND → filtered count; Close/Esc/backdrop returns to canvas with chips intact.
- **Null-reference sweep — comprehensive (2026-08-17)** — sweep for `Cannot read properties of null (reading 'name')` covered every remaining page. Greps: `modifiedBy.` (0 unguarded), `createdBy.` (0), `.owners[` (0), `o.name|owner.name` (2 weak), `dataset.name|database.name` (0); broader `confirmRow as unknown` found 6 pages with unsafe title prop `String((confirmRow as unknown as Record)["name"] ?? ...)` evaluated even when `confirmRow === null` (dialog closed) -> crash at render. Patched: `src/pages/csstemplates/list:192`, `annotationlayer/list:213`, `tag/list:209`, `rowlevelsecurity/list:236`, `roles/list:216` all now `confirmRow?.name ?? String(confirmRow?.id ?? "")`, `users/list:232` now `confirmRow?.username ?? String(confirmRow?.id ?? "")`; plus `databases/index:1147` + `datasets/index:1408` `editing.owners.map((o) => o.name)` -> `(o as {name?:string})?.name ?? "Sample"`. Backend handlers checked: `csstemplates/tags/annotationlayers/rowlevelsecurity/roles/users/permissions` list handlers return no `modifiedBy/createdBy` shape (simple tables) so no normalization needed; `alerts/reports` already normalize `{id:0,name:"Sample"}` when fk null (from prior sweep). Dashboard/chart/dataset/database pages already guarded `?.name ?? "Sample"` + handlers already fallback Sample. Verified: `grep confirmRow as unknown -> 0`, `npm run lint -> 0`, `npm run build -> 163.91kB pass`, manual open of every sidebar list page (/dashboard/list, /chart/list, /sqllab, /savedquerylist/list, /sqllab/history, /tablemodelview/list, /databaseview/list, /csvtodatabaseview/form, /alert/list, /report/list, /users/list, /roles/list, /permissions/list, /rowlevelsecurity/list, /annotationlayer/list, /csstemplates/list, /tag/list, /importexport, /log, /settings/ai) renders empty or data without tripping boundary.
- **React error boundary (2026-08-17)** — `src/pages/RootErrorBoundary.tsx` was a plain function (no `getDerivedStateFromError`/`componentDidCatch`) and was never mounted, so any render throw (e.g. `rows.map` on `undefined`) crashed to a white screen. Fixed: converted to a real class component (`extends React.Component` with `static getDerivedStateFromError(error){return{hasError:true,error}}` + `componentDidCatch` → `console.error`) rendering a centered `bg-card border-border` card (`AlertTriangle` `destructive/10`, heading `Something went wrong`, truncated `error.message` mono `bg-muted border`, `Reload page` via `window.location.reload()` + `Go to dashboard` → `/dashboard/list`); uses only existing tokens (`card/border/muted/destructive/10`). Mounted in `src/main.tsx` inside `BrowserRouter` (`BrowserRouter → RootErrorBoundary → AuthProvider → RequireAuth → App`) with fallback using plain `<a href>` not `<Link>` to avoid router-context crash, keeping existing auth/window.fetch patch intact. Verified: `npm run lint` 0, `npm run build` pass (server 163.91kB), inject `throw new Error("test crash")` in `TagListPage` → boundary shows fallback instead of white screen, remove → `/tag/list`, `/csstemplates/list`, `/annotationlayer/list`, `/rowlevelsecurity/list` still show correct empty states (0 rows → `No … match` with CTA, not crash).
- **Mock elimination — last 4 runtime seams (2026-08-17)** — audit found 4 pages still importing `src/data/*` at runtime; all now live Postgres via `src/lib/api.ts` (`fetchList`/`fetchOne` with `ApiError` + `res.ok` check). **Explore** `src/pages/explore/index.tsx:31,182` — removed `seedDatasets`, now `fetchList<Dataset>("/api/datasets",{page:1,pageSize:50})` on mount (`datasets`/`datasetsLoading`/`datasetsError` + `datasetId:number|null` + `ds = datasets.find(d=>d.id===datasetId) ?? datasets[0]` nullable), hydrates `?chartId` via live `GET /api/charts/:id` → `datasetId` then syncs `dimension/metric` once `datasets` arrive, selector `disabled` while loading, per-section loading/error/empty states, save uses live `ds`. **Dashboard View** `src/pages/dashboard/[id].tsx:30` — removed `seedCharts`/`seedDatasets`, now batch `Promise.all(chartIds.map(cid=>fetch(/api/charts/${cid})))` → `chartMap:Map<number,Chart>` (+ `datasetId?:number|null` added to `src/types/chart.ts`) then `fetchList<Dataset>("/api/datasets")` filtered to needed ids → `datasetMap`; `CellRenderer` now `(chartMap,datasetMap,chartErrors,chartsLoading)` with per-cell `Failed to load` / `Chart not found — Check database` / `Dataset missing` + `h-[280px] animate-pulse` skeletons, insights `POST /api/ai/insights` now built from live `payloadMap` (`chartMap.get(cid)` + `datasetMap` rows), conversational preview `genDataset = datasetMap.get(cfg.datasetId)`. **Dashboard Edit** `src/pages/dashboard/[id]/edit.tsx:9` — removed `seedCharts`, now `fetchList<Chart>("/api/charts",{page:1,pageSize:20,q})` with `?q=` server search (`pickerCharts`/`pickerLoading`/`pickerError` + `editChartMap` cache), `pickerDatasets:Map<number,Dataset>` via `fetchList<Dataset>`, plus missing-ids fetch (`layout.flatMap(chartId)` not in `editChartMap` → `Promise.all fetch /api/charts/:id`), canvas `chart=editChartMap.get(cell.chartId)` / `dataset=pickerDatasets.get(...)`, picker list `pickerLoading ? Loading : pickerError ? error : No match`. **SQL Lab** `src/pages/sqllab/index.tsx:302` — removed `mockHistory`/`mockSavedQueries`/`getMockResult`, `history:[]`/`savedQueries:[]` empty, deep-link `sessionStorage` only (no `mockHistory.find` fallback), `runQuery` now direct `fetch("/api/sqllab/execute",{sql,limit})` → `if(!res.ok) throw Error(err?.error ?? Query failed (status))` (no inner `try/catch` mock fallback), error surfaces from handler; footer `src/data/sqllab.ts` → `Postgres via /api/sqllab/databases + /api/sqllab/execute (pg Pool 10s timeout)`; `src/pages/sqllab/history/index.tsx` footer likewise. Verification: `npm run lint 0` (fixed `datasetId` optional on `Chart` + `ExecData` typed + parsing `:` on dataset-missing ternary + `datasets` dep disable), `npm run build pass` (`163.17kB`, `chart 2.85kB` chunk), `grep -rn seedDatasets|seedCharts|mockHistory|getMockResult src/pages src/components src/lib → 0`, `grep -rn "from.*@/data" src/pages src/components routes/api src/lib → 0` (only `src/db/seed.ts` imports `src/data/*`). `src/types/chart.ts` now `datasetId?:number|null` to reflect enriched `GET /api/charts/:id`.

## Release History

### v1.0.0-beta.1 (2026-08-17)
- Initial beta release
- All Superset reference pages implemented
- Real PostgreSQL backing (Drizzle ORM)
- Phase 2 AI surfaces (NL2SQL, self-healing, conversational BI, anomaly detection)
- Configurable LLM provider
- Dashboard cross-filtering + drill-to-detail
- RBAC (Admin/Analyst/Viewer)
- First-run setup flow
- Auth enforcement (client + server)
- React error boundary
- Open-source sanitized (no personal identifiers)
