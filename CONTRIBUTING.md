# Contributing

Thanks for thinking about contributing to Metrics BI.

## Getting started

You need **Node 18+** and **PostgreSQL 14+**.

```bash
git clone <repo>
cd metrics
npm install
cp .env.example .env   # edit DATABASE_URL (default: postgresql://postgres:postgres@localhost:5432/metrics_bi)
npm run db:push        # create tables (Drizzle Kit, dev only, no migration file)
npm run db:seed        # seed a small sample
npm run dev            # open http://localhost:5000
```

Open `http://localhost:5000`. On first launch you will be sent to `/setup` to create your admin account.

Useful commands:

| Script                                 | Purpose                                     |
| -------------------------------------- | ------------------------------------------- |
| `npm run dev`                          | Vite plus Nitro dev server                  |
| `npm run build`                        | `tsc` type check plus Vite production build |
| `npm run lint`                         | ESLint (`--max-warnings 0`)                 |
| `npm run lint-staged`                  | Prettier plus eslint fix (Husky pre-commit) |
| `npm run db:push`                      | Sync schema to Postgres (dev)               |
| `npm run db:generate` and `db:migrate` | Migration workflow (prod)                   |
| `npm run db:seed`                      | Re-seed the small sample                    |

No test runner is set up, so do not add one without talking about it first.

## What we care about in code

- **Lint is the gate.** `npm run lint` must pass with **0 warnings** and `npm run build` must pass before a PR is reviewed. Husky runs `lint-staged` (Prettier `--write` plus `eslint --fix`) on every commit.
- **File based routing, both sides.** Frontend routes live in `src/pages/` via `vite-plugin-pages` (default export, `[id].tsx` for dynamic segments, `importMode: async`). Backend handlers live in `routes/api/` via Nitro and H3 (method suffixed files, `defineHandler` or `defineEventHandler`). Add new sections the same way. Do not add a second router.
- **One styling system.** Tailwind CSS 4 plus OKLCH tokens in `src/index.css` (`:root` and `.dark` and `@theme inline`) plus shadcn and `cva` plus `clsx` plus `tailwind-merge` via `src/utils/cn.ts`. Add to the existing palette with a name that matches the set. Do not bolt on another system. Space Grotesk is configured in `configs/fonts.config.ts`. Change it there if you need to, not inline.
- **Check what exists before adding a token.** Read `src/index.css` and `src/components/ui/` first. This is a dense tool. Scannability and consistent list chrome matter more than one flashy screen.
- **If a new token is justified, wire it properly.** Name it like the OKLCH set and thread it through `@theme inline` so light and dark stay in sync.
- **Use the typed API client.** Pages have to go through `src/lib/api.ts` (`fetchApi`, `fetchList`, `fetchOne`, `mutate`) which checks `res.ok` and throws `ApiError`. Do not bring back raw `fetch(...).then(r => r.json())` without an `ok` guard. That is how you get a blank screen. Auth is injected by the global `window.fetch` patch in `src/main.tsx`, so do not duplicate it.
- **Keep secrets on the server.** API keys and model calls live in Nitro and H3 handlers (`routes/api/ai/`) only. Never in client bundled code and never as `VITE_*` env vars. Any AI suggestion has to be reviewable and reversible (you see the diff and you confirm it, it never rewrites silently).
- **Database discipline.** Schema in `src/db/schema.ts`, one `pg` Pool in `src/db/index.ts`, seed in `src/db/seed.ts` (seed is the only place that reads `src/data/*`, runtime handlers read Postgres through Drizzle). Migrations: `db:push` for dev, `db:generate` plus `db:migrate` for prod.
- **Naming.** Path alias `@/*` points to `./src/*` (both `tsconfig.json` and `vite.config.ts`). TypeScript is strict (`noUnusedLocals` and `noUnusedParameters`).

## How to submit a PR

1. For anything beyond a small fix, open an issue first so we can talk through the approach.
2. Create a focused branch from `main`, one concern per PR.
3. Make your changes and keep the diff reviewable (separate formatting and logic where it helps).
4. Run `npm run lint` and `npm run build` locally and fix every warning or error.
5. Try the affected pages and API handlers by hand (see the PR template checklist).
6. Open a PR against `main` using the template in `.github/PULL_REQUEST_TEMPLATE.md`.
7. Respond to review comments and keep the branch up to date with `main`.

## Commit messages

Keep the subject short and imperative, 72 chars or less. For example:

```
fix: guard dataset name against null owner in chart list
feat: add Sankey chart type via TanStack plugin
docs: clarify first run setup in README
```

Add a body if you need to explain context, motivation, or how you verified it. We do not enforce conventional commits strictly, but `fix:` and `feat:` and `docs:` and `chore:` prefixes help reviewers.

## Reporting issues

Use the templates in `.github/ISSUE_TEMPLATE/` (Bug report and Feature request) so triage has the detail it needs. For security issues, see [SECURITY.md](SECURITY.md). Do not file them as public issues.
