# Product

## Register

product

## Users

Data analysts and technical users — the people who live in SQL Lab, build datasets, shape charts in Explore, and assemble dashboards for stakeholders. They are interrupted, context-switching between ad-hoc questions and recurring reporting, often under time pressure. Their primary job: get from a business question to a trustworthy answer fast — query the right table, shape the right chart, put it on a dashboard, and share it without rework. They know SQL, they care about correctness, and they measure the tool by how little it gets in the way.

## Product Purpose

Metrics BI is an AI-native business intelligence platform inspired by Apache Superset. It exists to collapse the query → chart → dashboard loop for teams who run on PostgreSQL. Every Superset reference page has a working equivalent (Dashboard Builder, Chart Explore, SQL Lab, datasets/databases, governance, alerts, RBAC), backed by real Postgres + Drizzle. The AI layer (NL-to-SQL, self-healing queries, conversational BI, anomaly detection) lives inside those surfaces — not as a bolted-on chat tab — and every suggestion is inspectable and reversible. Success is: an analyst lands, finds the table, builds or heals a query, drops a chart on a dashboard, and shares it — all without leaving the app or wondering if the SQL is lying.

## Brand Personality

Quietly confident, clinical, and precise. Linear meets Vercel: premium enterprise SaaS that earns trust through restraint.

- **Precise** — numbers are exact, language is exact, UI is exact. No decorative noise.
- **Calm** — the tool stays out of the way while the analyst thinks. Low ambient tension, high legibility.
- **Earnest** — it explains itself. No magic steps, no hidden rewrites. Every AI move shows its work.

Voice: concise, neutral, authoritative without being cold. Labels say what happens; empty states say what to do next; errors say what went wrong and how to fix it.

## Anti-references

What this should NOT look like:

- Flashy SaaS gradients, glassmorphism cards, and frosted-glass overlays used decoratively — the 2024-2025 AI-demo tell.
- Overly colorful dashboards where every widget shouts in a different hue — the rainbow admin template.
- Warm cream / sand / beige paper backgrounds as the default body — the first-order AI reflex (even the "slightly warm off-white" variant).
- The hero-metric template (big number + small label + duplicate supporting stats) repeated as a grid.
- Dense marketing landing page language, eyebrow kickers on every section, and numbered 01/02/03 scaffolding.

## Design Principles

1. **Data first, chrome second.** — Tables, charts, and queries are the product. Navigation, headers, and controls earn their pixels; data earns the most. If a decoration competes with a number, remove the decoration.
2. **Reveal, don't obscure.** — Every AI suggestion shows its SQL, its source tables, and an explicit Apply / Dismiss. Nothing rewrites a user's query, chart, or permissions silently. Trust comes from visible diffs.
3. **Quiet density over empty monument.** — Enterprise analysts scan dozens of rows, filters, and editors in one sitting. Design for information density that stays scannable: tight but not cramped spacing, strong hierarchy, consistent list chrome — not generous whitespace that pushes data off-screen.
4. **One system, many surfaces.** — Dashboards, Explore, SQL Lab, and governance share the same tokens, typography, and list language. Distinctiveness comes from composition and restraint, not from decorating each section differently.
5. **Clinical, not cold.** — Minimal doesn't mean lifeless. Small, precise moments of motion (blur, clip, shadow), single-accent color, and real microcopy make the tool feel considered — but never at the cost of legibility.

## Accessibility & Inclusion

Target WCAG 2.1 AA. Body text ≥4.5:1, large text ≥3:1, placeholder text held to the same 4.5:1 bar. Keyboard-navigable tables and editors; visible focus; reduced-motion fallbacks (crossfade/instant) for every animated surface. Test chart contrast and filter chips for color-blind legibility — don't convey state by color alone.
