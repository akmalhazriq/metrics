# Contributing

Thanks for considering a contribution to Metrics BI!

## Development setup

Prerequisites: **Node 18+**, **PostgreSQL 14+**.

```bash
git clone <repo>
cd metrics
npm install
cp .env.example .env   # edit DATABASE_URL (default: postgresql://postgres:postgres@localhost:5432/metrics_bi)
npm run db:push        # create tables (Drizzle Kit — dev, no migration file)
npm run db:seed        # seed minimal sample data
npm run dev            # start on http://localhost:5000
```

On first launch, open `http://localhost:5000` — you'll be guided through creating your admin account at `/setup`.

Key commands:

| Script | Purpose |
|---|---|
| `npm run dev` | Vite + Nitro dev server |
| `npm run build` | `tsc` type-check + Vite production build |
| `npm run lint` | ESLint (`--max-warnings 0`) |
| `npm run lint-staged` | Prettier + eslint fix (Husky pre-commit) |
| `npm run db:push` | Sync schema to Postgres (dev) |
| `npm run db:generate` / `db:migrate` | Migration workflow (prod) |
| `npm run db:seed` | Re-seed minimal data |

No test runner is configured — don't add one without discussion.

## Coding conventions

- **Lint is the gate.** `npm run lint` must pass with **0 warnings** and `npm run build` must pass before any PR is considered. Husky runs `lint-staged` (Prettier `--write` + `eslint --fix`) on commit.
- **File-based routing.** Frontend routes in `src/pages/` via `vite-plugin-pages` (default export, `[id].tsx` for dynamic segments, `importMode: async`). Backend handlers in `routes/api/` via Nitro/H3 (method-suffixed files, `defineHandler` / `defineEventHandler`). Follow the same shape for every new section — don't invent a second router.
- **Single styling system.** Tailwind CSS 4 + OKLCH tokens in `src/index.css` (`:root` / `.dark` / `@theme inline`) + shadcn/`cva` + `clsx` + `tailwind-merge` via `src/utils/cn.ts`. Extend the existing palette with consistently named tokens — never bolt on a second system. Space Grotesk is configured in `configs/fonts.config.ts`; change it deliberately via that file, not ad hoc.
- **Token discipline.** Before adding a color, spacing, or typography token, read `src/index.css` and `src/components/ui/` to see what's already named and reused. Information density and scanability matter more than a striking single screen.
- **No new tokens without an audit.** If a new token is justified, name it consistently with the OKLCH set and wire it through `@theme inline` so both light and dark modes track.
- **Typed API client.** Pages must use `src/lib/api.ts` (`fetchApi` / `fetchList` / `fetchOne` / `mutate`) which checks `res.ok` and throws `ApiError`. Don't reintroduce raw `fetch(...).then(r => r.json())` without an `ok` guard — that's the blank-screen class of bug. Auth is injected by the global `window.fetch` patch in `src/main.tsx`; don't duplicate it.
- **Server-side secrets.** API keys and model calls live in Nitro/H3 handlers (`routes/api/ai/`) only — never in client-bundled code or `VITE_*` env vars. Any AI suggestion must be visibly reviewable and reversible (visible diff + explicit confirm, never silent rewrite).
- **Database.** Schema in `src/db/schema.ts`, sole `pg` Pool in `src/db/index.ts`, seed in `src/db/seed.ts` (seed is the only consumer of `src/data/*` — runtime handlers read Postgres via Drizzle, never seed files). Migrations: dev via `db:push`, prod via `db:generate` + `db:migrate`.
- **Naming.** Path alias `@/*` → `./src/*` (both `tsconfig.json` and `vite.config.ts`). Keep TypeScript strict (`noUnusedLocals` / `noUnusedParameters`).

## How to submit a PR

1. Open an issue first for anything non-trivial so the approach can be discussed.
2. Create a focused branch from `main` — one concern per PR.
3. Make your changes, keeping diffs reviewable (separate formatting and logic where practical).
4. Run `npm run lint` and `npm run build` locally and fix every warning/error.
5. Manually verify the affected pages and API handlers (see the PR template checklist).
6. Open a PR against `main` using the template in `.github/PULL_REQUEST_TEMPLATE.md`.
7. Respond to review comments; keep the branch up to date with `main`.

## Commit messages

Use a short, imperative subject line (≤ 72 chars), e.g.:

```
fix: guard dataset name against null owner in chart list
feat: add Sankey chart type via TanStack plugin
docs: clarify first-run setup in README
```

Optional body for context, motivation, and verification notes. No strict conventional-commit enforcement, but `fix:` / `feat:` / `docs:` / `chore:` prefixes help reviewers.

## Reporting issues

Use the templates in `.github/ISSUE_TEMPLATE/` (Bug report / Feature request) so triage has the context it needs. For security issues, see [SECURITY.md](SECURITY.md) — don't file them as public issues.
