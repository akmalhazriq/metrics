# Design

Source: PRODUCT.md (Operate / Clinical) · Reference: Graphite Shell — warm graphite dev tool (graphite, developer, minimal)
Generated: scan of src/index.css, src/components/ui, src/components/layout

> **Contract:** This file's frontmatter is the token source. Every color, font, radius, shadow, and spacing value must come from it — never substitute, approximate, or invent. If a value is missing, stop and ask.

---

name: "Graphite Shell"
description: "A developer tool that finally feels warm. Graphite surfaces (never black, never grey), JetBrains Mono for everything technical, Inter for prose, a single sage-green accent reserved for the active state. Built for CLIs, infra dashboards, and dev portals that want to look serious without looking like a 90s terminal."
colors:
primary: "#e8e6df"
secondary: "#8a8780"
tertiary: "#e8e6df"
neutral: "#1f1e1b"
surface: "#161513"
typography:
display: Inter
body: Inter
mono: "JetBrains Mono"
scale:
hero: "3.25rem / 1.06 / 600 / -0.025em"
h1: "2.125rem / 1.16 / 600 / -0.02em"
h2: "1.4375rem / 1.3 / 600 / -0.012em"
body: "0.9375rem / 1.6 / 400 / 0"
radius:
sm: 3px
md: 5px
lg: 8px
pill: 9999px
shadows:
card: "rgba(0,0,0,0.35) 0 1px 0 inset, rgba(0,0,0,0.4) 0 1px 2px"
button: none
borders:
card: "1px solid rgba(232,230,223,0.08)"
divider: rgba(232,230,223,0.10)
fonts_url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
---

## Theme

Warm graphite, never black, never cool grey. Page field `#161513` (Shell, brown-leaning) at ~62% share, pane `#1f1e1b` for cards, lift `#262420` for secondary buttons and hovered states. Bone ink `#e8e6df` for all type; secondary `#8a8780` for mono labels and ghost buttons. A single muted sage `#9cb380` — not neon, not terminal-bright — is reserved for the primary CTA and the active boxed tab. Dark catch-light only: `rgba(0,0,0,0.35) 0 1px 0 inset`.

## Overview

This is a serious CLI built by people who care: graphite warmth in place of pure black, sage at 70% saturation in place of volt green, mono on every button label so the UI reads as commands. Inter carries only prose and headlines (600-weight display); JetBrains Mono carries every interactive surface (buttons 500/600, metrics, code, boxed tabs). Tabs read like a tmux pane selector — boxed cards with a sage border on active. Charts are thin precise bars (4px wide, 10px gap, one sage, rest 22% bone) over dashed gridlines at 8% bone, with a sage dot terminator.

## Composition

- **Shell:** full-bleed `#161513` with divider at 10% bone. No hero illustration — headline at 52px/600 does the work.
- **Bands:** content sections pad 80px desktop / 40px mobile. Pane `#1f1e1b` cards sit on the shell with an inset highlight; lift `#262420` only on secondary actions.
- **Grids:** 12-col dashboard grid where needed (`grid-cols-12`, gap 16–20), otherwise `repeat(auto-fit, minmax(280px, 1fr))`. Content cards `24–28px` pad, compact `20px`.
- **Density:** comfortable (1×) is default; compact 0.72× for tables/IDEs; spacious 1.35× for editorial.

## Colors

| Token                                | Value                  | Use                                                    |
| ------------------------------------ | ---------------------- | ------------------------------------------------------ |
| `--background` / `--surface`         | #161513                | Shell — page field, warm graphite                      |
| `--card` / `--neutral`               | #1f1e1b                | Pane — card surface                                    |
| `--muted` / `--surface-lift`         | #262420                | Lift — secondary button, hovered card                  |
| `--foreground` / `--primary`         | #e8e6df                | Bone — text, headings (warm ivory, never white)        |
| `--muted-foreground` / `--secondary` | #8a8780                | Bone-55 — labels, captions                             |
| `--border`                           | rgba(232,230,223,0.08) | Card hairline                                          |
| `--border-strong`                    | rgba(232,230,223,0.10) | Divider, secondary border                              |
| `--input`                            | rgba(232,230,223,0.16) | Outline border                                         |
| `--ring`                             | #e8e6df                | Focus ring (1px dashed bone)                           |
| `--accent`                           | #9cb380                | Sage — primary CTA, active tab border, chart highlight |
| `--accent-soft`                      | rgba(156,179,128,0.14) | Sage 14% — focus, hovered tab                          |

### Semantic

| Token           | Value                  | When                     |
| --------------- | ---------------------- | ------------------------ |
| `--success`     | #9cb380                | Sage — completed         |
| `--warning`     | #d6c08a                | Warm attention (derived) |
| `--destructive` | #ef4444                | Error                    |
| `--info`        | #8a8780                | Muted                    |
| `--favorite`    | #9cb380                | Starred                  |
| `--ai`          | #9cb380                | AI surfaces              |
| `--ai-muted`    | #1f1e1b                | Quiet AI pane            |
| `--ai-border`   | rgba(232,230,223,0.08) | AI hairline              |

### Chart

`--chart-1` #9cb380 (sage highlight) / `--chart-2` rgba(232,230,223,0.22) / `--chart-3` #8a8780 / rest bone. Thin-bars 4px, gap 10px, stroke 1.5, fill 0.08, gridlines true, dotMarker true — one sage bar/point.

### Editor / Sidebar

`--editor` #1f1e1b / `--editor-border` 0.08 / `--editor-gutter` #161513 / `--sidebar` #161513 with `#9cb380` primary.

## Typography

- **Display/Body: Inter** — Hero 52px/600/lh1.06/ls -0.025em, H1 34px/600/lh1.16/ls -0.02em, H2 23px/600/lh1.3/ls -0.012em, Body 15px/400/lh1.6. Inter is ALL headlines + prose — never use mono for body copy.
- **Mono: JetBrains Mono** — UI/button 13px/500/lh1.4, Label 11px/500/lh1 tracked 0.04em uppercase, Code 13px/400/lh1.55. Strict split: Inter = prose, Mono = commands. Buttons read as commands because the label is mono.
- **Rules:** headings `text-wrap: balance` 600-weight only; mono labels always uppercase 0.04em; body `max-width 78ch`, paragraph `1em`, list indent `1.25em` gap `0.35em`.

## Layout

- **App shell:** sticky 44px header `h-[44px]` `border-b` 10% bone over shell, collapsible sidebar 256px `border-r` 8% bone, content column 1160px max with 80px section pad (40 mobile). `z-index`: dropdown → sticky → backdrop → modal → toast → tooltip.
- **Motion — Cursor blink:** discrete, stepped. `all 120ms linear` default; durations instant 0, fast 60ms, base 120ms, slow 200ms; easing all `linear` except spring `steps(2,end)`. ≤120ms response; `prefers-reduced-motion` → instant. No bounce, no spring beyond stepped.

## Radii, Borders, Shadow

- `--radius sm 3px` · `md 5px` · `lg 8px` · `pill 9999px`. Cards `8px`, buttons `5px`, tabs boxed `5px`.
- Card border `1px solid rgba(232,230,223,0.08)`; divider `rgba(232,230,223,0.10)`; input `1px solid rgba(232,230,223,0.16)` etc.
- Card shadow `rgba(0,0,0,0.35) 0 1px 0 inset, rgba(0,0,0,0.4) 0 1px 2px` — dark catch-light + 1–2px drop. Button `none`. Elevation uses rings not blurs: level2 `0 0 0 1px rgba(232,230,223,0.5)` (popover), level3/4 ring + soft glow for sheets/modals.

## Components

### Buttons — four variants, verbatim

- **Primary** rounded `5px`, bg `#9cb380`, text `#161513`, pad `9px 18px`, mono `600 / 0.8125rem`. One per screen. Active selector uses sage border + fill.
- **Secondary** rounded `5px`, bg `#262420`, text `#e8e6df`, border `1px solid rgba(232,230,223,0.10)`, mono `500`.
- **Outline** rounded `5px`, transparent, text `#e8e6df`, border `1px solid rgba(232,230,223,0.16)`, mono `500`.
- **Ghost** rounded `5px`, transparent, text `#8a8780`, no border, pad `9px 14px`, mono `500`.
- States: hover `rgba(232,230,223,0.15)` → bone; focus `1px dashed #e8e6df` offset 2px; active/selected bone fill `#e8e6df` on `#161513`; disabled 0.35.

### Cards

`bg #1f1e1b`, `1px solid rgba(232,230,223,0.08)`, `8px` radius, inner `0 1px 0 inset` catch-light + `0 1px 2px rgba(0,0,0,0.4)`. Featured variant adds 2px sage left border (tmux active-pane indicator). Hover: border lifts to bone `#e8e6df`; dragging 0.7 opacity.

### Tables

Header `11px mono uppercase 0.04em` at bone-55 `#8a8780`, row hover no fill, numeric `tabular-nums` JetBrains Mono, null `—` muted. Dividers at 8%. One sage highlight per table where relevant. Compact density `0.72×` for dashboards.

### Tabs — boxed (tmux pane)

Bordered cards at `5px`, hairline 10% bone, inactive transparent bone-55 mono. Active = pane-lift `#262420` → `rgba(232,230,223,0.10)` fill, `1px solid #9cb380` border, sage text mono 600. Hover → bone. No underline variant.

### Charts — thin-bars

Thin precise bars 4px wide, gap 10px, dashed gridlines at 8% bone, one sage bar, rest 22% bone. Line at 1.5px bone with 8% sage fill ending in sage dot marker. Y labels `11px mono uppercase`.

### AI Surfaces

Quiet sage ramp only 14% fills — preview bar above editor tabs, heal card below errors, drawer/strip all use `border 0.08`, `bg #1f1e1b`, mono SQL in `bg-editor` at `rgba(232,230,223,0.12)` with sage dot emphasis. No second accent.

### Navigation

`AppShell` groups mono 11px uppercase; active segment is boxed sage border, not underline or pill.

## Graphics & Effects

No gradients, no dot-matrix. Signature is warm graphite warmth + sage single accent + 1px inset highlight. Scope is restraint.

## Guardrails

- Never go pure black `#000` or cool grey — warm graphite `#161513/#1f1e1b/#262420` is the only correct base.
- Never swap sage `#9cb380` for bright terminal/neon green — muted on purpose.
- Never put Inter on buttons — JetBrains Mono carries every interactive label.
- Never use a second accent — sage alone.
- Never drop the 1px inset highlight on cards — the dark catch-light is structural.
- Never invent a radius, color, or shadow not in frontmatter.

## References

- Tokens: `src/index.css` (`:root` dark only, warm) + `@theme inline`
- Fonts: `configs/fonts.config.ts` (Inter 400/500/600/700 + JetBrains Mono 400/500/600) — `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap`
- Icons: `lucide-react`
- Shell: `src/components/layout/AppShell.tsx`
- Charts: `src/components/charts/ChartRenderer.tsx` (thin-bars, gridlines, dotMarker)
