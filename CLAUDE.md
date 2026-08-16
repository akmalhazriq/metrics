# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite + Nitro dev server on port 5000 (frontend + /api/* on same origin)
npm run build        # TypeScript check (tsc) then Vite production build
npm run preview      # Preview production build
npm run lint         # ESLint (typescript-eslint) — --max-warnings 0
npm run lint-staged  # Prettier --write + eslint --fix (lint-staged uses .lintstagedrc.json, concurrent false)
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

File-based routing via `vite-plugin-pages` (dirs: `src/pages`, extensions `tsx`/`jsx`, `importMode: sync`):

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
