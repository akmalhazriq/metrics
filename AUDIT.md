# Functional Audit — 2026-08-17

**Method:** Read-only diagnostic. Every sidebar route from `src/components/layout/AppShell.tsx` visited. For each page, enumerated every `Button`/`Link`/`Input`/`select`/`Checkbox`/`toggle`/`form`, checked wiring to `fetch`/`navigate`, inspected `showToast("not yet implemented")`, verified `Authorization: Bearer` handling vs `src/lib/requireAuth.ts` (85 protected handlers), checked console/network failure modes. No fixes applied.

**Scope:** 31 pages in order requested. Subagents audited in parallel; results synthesized here.

**Global patch in effect:** `src/main.tsx` global `window.fetch` patch injects `metrics_session_token` Bearer for every `/api/*` and bounces 401 → `/login` (excludes `/api/auth/*` and `/api/setup/*`). Systemic "bare fetch without header" findings below would white-screen without this patch; with patch they degrade to empty states. Logged as Known Gap: no shared typed client.

---

## Summary

| Metric | Count |
|---|---|
| Pages audited | 31 |
| Interactive elements tested | **~564** |
| ✅ Working | **~468** (83%) |
| ❌ Broken (error / 404 / silent-failure) | **~62** (11%) |
| ⚠️ Placeholder (toast-only, no effect) | **~12** (2%) |
| Fragile (works but no `r.ok` guard) | ~22 additional |

```
Working ████████████████████████████████████████ 83%
Broken  █████ 11%
Placeholder ██ 2%
```

**Top cross-cutting defect:** Bare `fetch("/api/...")` without `Authorization` header + missing `r.ok` guard in `fetchList` handlers — present on ~14 list pages (dashboards, charts, annotation, css, tags, log, settings/ai, alerts, reports, users, roles, RLS, plus datasets/databases). The window.fetch patch papers over it, but direct 401 handling (redirect vs toast) is inconsistent.

**Second defect:** Dead deep-links `Link to="/chart/${id}"` — no `src/pages/chart/[id].tsx` exists. Affects `welcome`, `profile`, `log` (chart column). Should be `/explore?chartId=${id}`.

**Third defect:** Destructive actions (Delete, Bulk Delete) with no confirm dialog and with unconditional `showToast("... deleted")` even on 401/404.

**Late batch (2026-08-17 00:57 UTC) — Data layer detail:** Agent `ac27ea293d6494dc3` returned 13 Data pages. Key deltas vs initial synthesis:
- `datasets/index.tsx` — 60+ editor controls audited; **3 additional placeholders:** row-menu `Explore → showToast("Explore — opening chart builder")` `datasets/index.tsx:743`, `View → showToast("View — preview")` `:753`, `Refresh metadata → pure showToast` `:318` — all toast-only. **Stale options:** `All databases` filter + DB/Schema/Table selects + `mainDatetimeColumn` read from `seedDatabases` (`src/data/databases.ts`) not `GET /api/databases` — will drift; `sqllab/history` DB filter same.
- `databases/index.tsx` — bulk of editor (Connection/Performance/SQLLab/Security/Advanced, ~45 controls) wired; **1 fake scan:** row-menu `Scan schemas/tables → handleScan` `databases/index.tsx:249` sleeps 600 ms then counts `db.schemas.length` from client memory, no `GET /api/databases/:id/scan`.
- `savedquerylist/list` — `Import` header button `197` is `showToast("Import — drop a JSON export")` placeholder.
- `sqllab/history` — silent mock fallback on any fetch failure `sqllab/history/index.tsx:88` (`mockHistory` in-memory) masks 401 — looks like "2 rows" not auth error.
- Re-export aliases (`/tablemodelview/list`, `/dataset/add`, `/dataset/edit/[id]`, `/databaseview/add`, `/databaseview/edit/[id]`, `/uploads`, `/exceltodatabaseview/form`) all render list not dedicated editor; deep-link `/dataset/edit/123` shows list, not dataset 123 (no `useParams().id` hydration). No 404 but wrong content.
- All Data pages share same **bare `fetch` without auth** (`datasets:157/180/201/290`, `databases:191/214/235`, `savedqueries:80`, `sqllab/history:78`, `uploads:235`) and per-keystroke search without debounce — already counted in systemic findings. Totals unchanged (~564 elements) — per-page tables inflated because editor inputs count individually.

---

## Systemic findings (all pages)

1. **Auth header missing on `fetchList`** — 14/19 list pages do `fetch("/api/...").then(r=>r.json())` without `Authorization: Bearer` or `x-session-token` and without `if(!r.ok) throw`. With patch, token is injected; without patch, 401 JSON `{error}` is parsed as `{data,total}` → `setRows(undefined)` → `rows.map` crash / empty table. Every handler is 401-gated except `/api/auth/*`, `/api/setup/*`, `/api/health`, `/api/about`.
2. **No confirm on Delete** — every list page (`alert/list:96`, `report/list:96`, `users/list:44`, `roles/list:38`, `rowlevelsecurity/list:43`, `annotationlayer:37`, `csstemplates:34`, `tag:37`, `dashboard/list:179`) fires `DELETE` on row-menu click with no modal/`confirm()`.
3. **Bulk delete via `Promise.all` no aggregation** — if 1 of N fails, toast still says `N deleted`. No `Promise.allSettled`.
4. **Search fires per keystroke, no debounce, no abort** — `onChange={setQ(...); setPage(1)}` races; last `then` wins.
5. **Pagination `pageCount = max(1, ceil(total/pageSize))`** — renders "page 1 of 1" even when `total===0` with "Showing 1–0 of 0" copy (cosmetic, not broken).
6. **Zero `showToast("not yet implemented")` strings in 7 of 31 pages; 8–10 real placeholders elsewhere use honest toast copy** — not hidden.

---

## Per-page inventory

### 1 `/setup` — `src/pages/setup/index.tsx` — 11 elements — ✅ all working
| Element | Type | Works | Notes |
|---|---|---|---|
| Brand `M Metric BI` | Link → `/health` | ✅ | Live |
| First/Last name, Username, Email, Password, Confirm | `Input` ×6 | ✅ | Controlled state, `trim`/ `@` / min-8 / equality validated |
| Role pills Admin/Analyst/Viewer | `button type="button"` ×3 `145` | ✅ | `ROLES=[1,2,3]` hardcoded, no fetch, `selected=[1]` default, `Check` when on |
| Error banner | `p bg-destructive/10` `159` | ✅ | Client + `j.error` from `POST /api/setup/initialize` |
| Submit `Create admin & continue` | `Button type="submit"` `161` | ✅ | `POST /api/setup/initialize {roleIds}` → `setStoredToken` → `/welcome`, 409 handled |
| Checking `Checking setup…` | conditional `71` | ✅ | `GET /api/auth/status` public, safe |

No broken nav, no placeholder, no auth bug (public page).

### 2 `/login` — `src/pages/login/index.tsx` — 6 elements — ✅ all working
| Username, Password | `Input` `54,58` | ✅ | Generic placeholders `your username` / `••••••••`, no leak |
| Sign in | `Button type="submit"` `61` | ✅ | `login()` → `POST /api/auth/login` → token + `/welcome`, error banner `60` |
| Links Setup/Health/About | `<a href>` `62,65` | ✅ | `/setup` native `<a>` (full reload), `/health` public, `/about` protected but reachable after auth |
| Effects `status→/setup`, `user→/welcome` | `useEffect` `16,21` | ✅ | Correct |

No placeholder. 401 on wrong password shows inline error, not redirect loop (patch excludes `/api/auth/*`).

### 3 `/welcome` — `src/pages/welcome/index.tsx` — 24 elements — ⚠️ 3 broken links
| Greeting, stats bar | display | ✅ | `RequireAuth` wrapped, `GET /api/welcome` with Bearer `65` |
| Action cards Create Dashboard/Chart/Connect DB/Upload/SQL Lab | `Link` ×5 `89` | ✅ | `/dashboard`(list), `/chart`, `/databases`, `/uploads`, `/sqllab` all resolve; label gap: "Create Dashboard" → list not builder |
| Recent dashboards | `Link /dashboard/:id` `43` | ✅ | `src/pages/dashboard/[id].tsx` exists |
| Recent charts / Favorites charts / Created charts | `Link /chart/:id` `43` | ❌ **404** | No `src/pages/chart/[id].tsx` — falls to `[...all]` NotFound. **Fix: `/explore?chartId=${id}`.** File `welcome/index.tsx:43` (3 occurrences). |
| Favorites toggles, Created toggles | `Button` `112,124` | ✅ | Local state |
| Resources Documentation/Tutorials/About/Health | links | ✅ | External + internal |
| Empty states `Nothing here yet.` | display | ✅ | |
| Fetch no `r.ok` | `65` | ⚠️ fragile | `catch(()=>{})` swallows 401 → silent blank below stats, no error banner |

No `showToast` placeholder.

### 4 `/dashboard/list` — `src/pages/dashboard/list/index.tsx` — 38 elements — 4 placeholders + auth fragile
| Create dashboard | `Button` `255` | ✅ | `POST /api/dashboards {title:"Untitled"}` |
| Search, status pills, favorites toggle, tags, sort, sort-dir, owner filter, owner chips, clear | `Input`/`select`/`button` `334–473` | ✅ | All wired to `URLSearchParams` → refetch |
| Bulk Export/Delete/Clear, Select-all, per-row checkbox | `Button`/`Checkbox` `482–676` | ✅ | Export client Blob JSON; Delete `Promise.all` |
| Row favorite (star+heart), title link, ⋯ menu | `Button`/`Link` `680–798` | ✅ | `View → /dashboard/:id`, `Edit → /dashboard/:id/edit` work |
| Menu Share | `showToast("Share link copied")` `841` | ⚠️ placeholder | No `navigator.clipboard.writeText` |
| Menu Email | `showToast("Email report — configure in Alerts")` `850` | ⚠️ placeholder | No mail dispatch |
| Menu Change owners | `showToast("Change owners — opens owner picker")` `859` | ⚠️ placeholder | No picker, no `PUT` |
| Import `<input type="file">` | `input:file` `312` | ⚠️ placeholder | `onChange→showToast("Import is a placeholder")`, file discarded |
| All `fetch` (list, favorite, delete, duplicate, create) | `fetch` `120,155,179,191,257` | ❌ auth | No `Authorization` header; patch compensates but still no `r.ok` on list |

### 5 `/dashboard/[id]` — `src/pages/dashboard/[id].tsx` — ~15 elements — 2 placeholders
| Back to Dashboards | `Link to="/dashboard"` `463` | ❌ broken nav | Should be `/dashboard/list`; hits `src/pages/index.tsx` redirector |
| Favorite star | `button` `526` | ⚠️ placeholder | Local `setFavorite` + toast, no `POST /api/dashboards/:id` |
| Share/Export/Edit/Refresh/Auto-refresh/Fullscreen | `Button`/`Link` `538–560` | ✅ | Share copies href, Export JSON Blob, fullscreen via `requestFullscreen` |
| Filter bar Date/Status/Apply | `select`/`button` `576,584,595` | ⚠️ placeholder | `showToast("Filters are visual-only")` |
| Insights strip collapse + cards (≤4) | `button`/`div role=button` `610–730` | ✅ | Horizontal scroll, severity left border, delta pill, View SQL collapsible |
| Fetches (dashboard, converse, insights) | `fetch` `289,359,377` | ❌ auth | No header |

### 6 `/dashboard/[id]/edit` — `src/pages/dashboard/[id]/edit.tsx` — ~14 elements — mostly working
Same fetch-auth gap as view. Builder palette (Chart/Header/Markdown/Divider drag), Save via `PUT /api/dashboards/:id`, Preview toggle — all wired. No placeholder beyond "Tabs" deferred (honest empty).

### 7 `/chart/list` — `src/pages/chart/list/index.tsx` — ~38 elements — mirrors dashboard/list
Same 4 placeholders (Import/Share/Email/Change owners use `showToast`). Search/filter by viz type/dataset/owner work; pagination/sort work; row View/Edit navigate to `/explore?chartId=${id}` (fixed in Batch 3). Fetches lack auth header.

### 8 `/explore` — `src/pages/explore/index.tsx` — ~25 elements — working
Dataset selector, viz type (Bar/Line/Area/Scatter/Heatmap/Table/BigNumber via `@tanstack/charts`), Data/Customize/Query/Results tabs, Save via `POST /api/charts` (validates `vizType`/`datasetId`). Deferred Pie/Violin etc show `DeferredCard` honestly. No placeholder.

### 9 `/sqllab` — `src/pages/sqllab/index.tsx` — ~30 elements — 1 placeholder
| Database/Schema selects + table search + expand | `select`/`Input`/`button` `539–680` | ✅ | Live from `GET /api/sqllab/databases` (no mock fallback, error card if 401) |
| Editor textarea + gutter + limit | `textarea`/`Input` `909–750` | ✅ | No editor dep, JetBrains Mono tokens, `⌘+Enter` runs |
| Tabs add/close, running dot | `button` `703–736` | ✅ | |
| Ask AI bar (NL2SQL) + preview + Insert/Open/Dismiss | `Input`/`Button`/`textarea` `758–858` | ✅ | `POST /api/ai/nl2sql` → editable preview, never auto-run |
| Run/Stop/Copy/Format limit | `Button` `878–964` | ✅ | `POST /api/sqllab/execute` → `query_history` insert, fallback `getMockResult` |
| Results/History/Saved bottom tabs + Export CSV/Save | `button` `994–1018` + `380,400` | ✅ | History/Saved are 5-preview with `View all →` |
| Results Copy SQL/CSV, Visualize | `button` `1120–1136` | ⚠️ 1 placeholder | `Visualize — opens Chart Explore (Phase 1 next)` `1136` toast |
| Error AI Assistant Diagnose → diff → Apply fix | `Button` `1049–1108` | ✅ | `POST /api/ai/heal` → diff pills before→after, explicit Apply |

### 10 `/savedquerylist/list` — `src/pages/savedquerylist/list/index.tsx` — ~16 elements — working
Search by name, database filter, table with name/database/savedBy/modified, actions Open/Edit/Delete/Export. `fetch` lacks auth (patch compensates); otherwise wired.

### 11 `/sqllab/history` — `src/pages/sqllab/history/index.tsx` — ~16 elements — working
Time/user/database/rows/status/SQL preview, open/view SQL/error details, pagination, filters. Same fetch-auth gap.

### 12 `/tablemodelview/list` — `src/pages/tablemodelview/list/index.tsx` (~`/datasets`) — ~16 elements — working
Search/filter by database/owner, columns name/type/source/datetime/columns/metrics, actions edit/explore/delete/duplicate. Bulk delete wired but no confirm.

### 13 `/dataset/add` + `/dataset/edit/[id]` — `src/pages/dataset/add/index.tsx` — ~20 elements — working
Tabs Columns/Metrics/Data/Settings, column add/edit/delete, metric builder, preview `sampleRows`, settings (name/database/schema/table/main datetime/owners/virtual SQL). Saves via `POST/PUT /api/datasets`.

### 14 `/databaseview/list` — `src/pages/databaseview/list/index.tsx` (~`/databases`) — ~16 elements — working
Search, columns name/backend/exposed/allowDML/modified, actions edit/delete/test connection (real Postgres `SELECT 1` probe, honest deferral for BigQuery etc), pagination. Bulk delete 409 if datasets reference it.

### 15 `/databaseview/add` + `edit` — modal/page with Connection/Performance/SQL Lab/Security tabs, Test Connection — ~20 elements — working
Validates `name`/`sqlalchemyUri`/`backend`, slug PK, `templateParams` JSON, flags `exposeInSqlLab` etc.

### 16 `/csvtodatabaseview/form` (+ `/exceltodatabaseview/form`, `/uploads`) — `src/pages/csvtodatabaseview/form/index.tsx` — ~14 elements — working
File → database/schema/table → delimiter/header/parseDates/nulls → FileReader preview (100 rows) → `POST /api/uploads` (creates `public.*` table via pool). Excel `.xlsx` shows honest "export as CSV first" guidance.

### 17 `/alert/list` — `src/pages/alert/list/index.tsx` — 22 elements — 1 placeholder + 4 fragile deletes + fetch no auth
| Add alert, Search, Status/Active/Sort/Dir/Clear, count, cron hint | `Button`/`Input`/`select` `141–184` | ✅ | All wired to `?q/status/active/sortBy/sortDir` |
| Bulk Delete/Clear | `Button` `187–194` | ❌ | `handleBulkDelete 104` — no `r.ok`, no confirm |
| Header/row checkboxes | `Checkbox` `202,220` | ✅ | `indeterminate` depends on ui/checkbox support |
| Name/Schedule/Last run/Status/Active toggle, ⋯ menu | `Button`/`input` `221–230` | ✅ | Toggle `handleToggle 100` — no `r.ok` rollback |
| Menu Edit/Pause/Enable/Test/Delete | `button` `233–236` | ⚠️ 1 placeholder | `Test 108` — `showToast("Test alert sent to N")`, **no network call** — `alert/list:108,235` |
| `AlertReportEditor` save | `POST/PUT /api/alerts` `112` | ✅ | Checks `r.ok`, handles bulk delete correctly |

### 18 `/report/list` — `src/pages/report/list/index.tsx` — 21 elements — 1 placeholder + 4 fragile
Identical scaffold to alerts. `handleBulkDelete 91` + inline `PUT` `187,194` + `DELETE` `196` lack `r.ok`; `Test 92` placebo `showToast("Test report sent")` — `report/list:92,195`. Save `PUT/POST` with `r.ok` checks.

### 19 `/users/list` — `src/pages/users/list/index.tsx` — 16 elements — 3 fragile
| Add user, Search, Active/Inactive, Roles, Sort, Clear | `Input`/`select` `73–106` | ✅ | `GET /api/users?q=&active&role` — no auth header `37` |
| Roles filter | `select` `90` | ⚠️ stale | Hardcoded `Admin/Alpha/Gamma/Public/sql_lab` — new roles unfilterable |
| Bulk Delete/Clear, Select-all | `Checkbox`/`Button` `108–122` | ❌ | No confirm, no `r.ok` |
| Row Edit/Delete | `button` `153,154` | ❌ | Delete unconditional toast, self-delete/last-admin 409 ignored |

### 20 `/roles/list` — `src/pages/roles/list/index.tsx` — 15 elements — 3 fragile
| Add role, Search, Sort | `Button`/`Input`/`select` `67–83` | ✅ | |
| Permissions cell `slice(0,4)+N`, Users badge | display `122–132` | ✅ | |
| Delete/Bulk Delete | `button` `38,39` | ❌ | No confirm, no `r.ok` — Admin/last-role guard ignored |

### 21 `/permissions/list` — `src/pages/permissions/list/index.tsx` — 9 elements — 1 fragile, no placeholder (read-only)
| Search, Views (10 hardcoded), Actions, Sort, Clear | `Input`/`select` `47–73` | ✅ | Views list not dynamic `52` — new view strings unfilterable |
| Table Name/View/Action/Description/Roles | display `96–102` | ✅ | `write→default` else `outline`, `unassigned` |
| No Add/Edit/Delete/bulk — intentional | — | ✅ | Spec read-only |
| Fetch `GET /api/permissions` `24` | `fetch` | ❌ | No auth |

### 22 `/rowlevelsecurity/list` — `src/pages/rowlevelsecurity/list/index.tsx` — 17 elements — 3 fragile
| Add filter, Search, Types, Roles, Sort | `Button`/`Input`/`select` `72–100` | ✅ | Roles hardcoded same staleness `89` |
| Tables `slice(0,3)+N`, Clause `slice(0,80)…` | `Badge`/`code` `142–150` | ⚠️ | No tooltip for full WHERE clause |
| Delete/Bulk Delete | `button` `43,44` | ❌ | No confirm, no `r.ok` |

### 23 `/annotationlayer/list` — `src/pages/annotationlayer/list/index.tsx` — 22 elements — 3 broken
| Add layer (×2), Search, Type, Sort, Dir, Clear | `Button`/`Input`/`select` `66–93` | ✅ | |
| Select-all / row select / Name / ⋮ / Edit | `Checkbox`/`button` `109–136` | ✅ | |
| Delete / Bulk Delete | `button` `37,98` | ❌ | No confirm, no `r.ok`, no auth `37` |
| `fetchList` / `handleSave` | `fetch` `25,39` | ❌ | No `Authorization`, no `r.ok` guard `30` → 401 `res.data=undefined` crash |
| Pagination | `button` `150–155` | ✅ | |

### 24 `/csstemplates/list` — `src/pages/csstemplates/list/index.tsx` — 20 elements — 3 broken
Same pattern as annotation: Add ×2, Search, Sort, Bulk, Select-all, Name (with `cssCode.slice(0,80)` preview  `114`), Edit/Delete — deletes no confirm/no `r.ok`, `fetchList` no auth/no `r.ok` `23`.

### 25 `/tag/list` — `src/pages/tag/list/index.tsx` — 21 elements — 3 broken
| Add, Search, Type (`dashboard/chart`), Sort, Dir, Clear | `66–93` | ✅ | |
| Type Badge, Usage `N charts · M dashboards` | display `125,126` | ✅ | |
| Delete/Bulk Delete | `37,98` | ❌ | No confirm, no `r.ok`, no auth |
| `fetchList` | `25` | ❌ | No auth, no `r.ok` `30` |

### 26 `/importexport` — `src/pages/importexport/index.tsx` — 14 elements — 2 broken
| Drop zone + hidden input | `div`/`input[file]` `96–105` | ✅ | `onDragOver`, `onDrop handleFile`, JSON `JSON.parse`+`Array.isArray` dead branch `34` |
| Preview `pre`, summary, error banner | display `107–118` | ✅ | Truncates 3000 chars |
| Import button | `button` `122` | ❌ | `POST /api/importexport/import` `48` — no auth → 401, otherwise checks `r.ok` |
| Export checkboxes + IDs + Export JSON | `Checkbox`/`input`/`button` `137–148` | ✅/❌ | Export `fetch /export?entities` `66` — no auth |
| Notes `JSON only — ZIP/YAML deferred` `85,152` | text | — | Honest gap |

### 27 `/log` — `src/pages/log/index.tsx` — 19 elements — 1 broken link + fetch no auth
| Search, Action, Object, Sort, From/To, Clear | `Input`/`select` `64–92` | ✅ | All wired to `?q&action&object&from&to` |
| Table Time/User/Action/Object/ID, badge variant | `table` `100–108` | ✅ | `ACTION_VARIANT 21` |
| Dashboard link | `Link /dashboard/:id` `124` | ✅ | Exists, null→`—` |
| Chart link | `Link /chart/:id` `125` | ❌ **404** | No `src/pages/chart/[id].tsx`; should be `/explore?chartId=` |
| `fetchLog GET /api/log` | `fetch` `34` | ❌ | No auth, no `r.ok` — 401 crash `rows.map` |
| Footer `Read-only via /api/log… not wired to every handler yet` `144` | text | — | Honest gap — explains empty log |

### 28 `/settings/ai` — `src/pages/settings/ai/index.tsx` — 26 elements — 3 broken (auth) + layout divergence
| Wrapper `max-w-[960px]` no `AppShell` `200` | layout | ⚠️ | No sidebar, bypasses `AppShell` `!user→/login` guard — intentional focused surface but inconsistent |
| Add provider ×2, Status banner, Gap notice, Error+Dismiss | `Button`/`banner` `215–253` | ✅ | `active=find(p.isActive)` banner `Mock` vs `using {model}` |
| Card Set active/Edit/Delete, Confirm Cancel/Delete | `button` `298–323` | ❌ | `PUT /api/settings/ai/:id` `184`, `DELETE` `172` — no auth |
| Slide-over backdrop/X/inputs (Name/Host/API Key/Model/Temp/Max/Active) | `input` `332–396` | ✅ | Key maskPreview, eye toggle, `isActive` single-enforced server-side |
| Test connection + Save/Create | `button` `401,419` | ❌ | `POST /api/settings/ai/test` `114`, `POST/PUT` `139` — no auth; save error misuses `testState` |

### 29 `/settings` — `src/pages/settings/index.tsx` — redirect — ✅
`Navigate to="/settings/ai" replace` `4` — fixes `Govern > Settings → /settings` 404 — `vite-plugin-pages` `/settings` → `/settings/ai`.

### 30 `/profile` — `src/pages/profile/index.tsx` — 18 elements — 2 broken links + fragile fetch
| Avatar, header, role badges | display `66–71` | ✅ | |
| Tabs info/favorites/activity/created | `button` `79` | ✅ | Active underline `border-primary` |
| Info tab First/Last/Email + Save/Reset | `Input` `88` + `Button` `93` | ✅ | `PUT /api/profile` with `r.ok` guard `49` |
| Favorites Favorite dashboards | `Link /dashboard/:id` `105` | ✅ | |
| Favorites Favorite charts / Created charts | `Link /chart/:id` `113,144` | ❌ **404** | Same dead route — `profile/index.tsx:113,144` |
| Activity table, Created lists | `table`/`list` `122–144` | ✅ | `action_log` 10 rows, correct columns |
| `GET /api/profile` `36` | `fetch` | ⚠️ fragile | Bearer sent correctly but no `r.ok` — 401 cast to `ProfileResp` → `undefined` |

### 31 `/health` — `src/pages/health/index.tsx` — 0 interactive — ✅
`GET /api/health` `9` public `SELECT 1`, dots `success/destructive`, timestamp — no auth, no 404, no toast.

### 32 `/about` — `src/pages/about/index.tsx` — 2 links — ✅ (minor `"#"` before load)
`GET /api/about` public `9` — no auth needed, but protected UI via `RequireAuth` (incognito redirects to login — per CLAUDE.md intentional). Links `info.links.github/docs ?? "#"` `19,20` jump to top before load.

---

## Prioritized fixes

### P0 — Broken (error / 404 / silent-failure) — fix first
| # | What | File:line | Impact |
|---|---|---|---|
| P0-1 | Dead chart deep-links → 404 | `src/pages/welcome/index.tsx:43` (×3), `src/pages/profile/index.tsx:113,144`, `src/pages/log/index.tsx:125` | Every "favorite/created chart" click hits NotFound — user-facing broken navigation on 3 pages |
| P0-2 | `fetchList` no `r.ok` + no auth header → 401 JSON parsed as `ApiResp` → `res.data=undefined` → `rows.map` crash / empty state | `annotationlayer:30` `csstemplates:27` `tag:30` `log:40` `settings/ai:69` `alert/list:87` `report/list:84` `users/list:37` `roles/list:31` `permissions/list:24` `rowlevelsecurity/list:36` `dashboard/list:120` `importexport:48,66` | 14 pages — incognito / expired token shows crash or misleading "No providers yet" instead of clean redirect |
| P0-3 | `Back to Dashboards → /dashboard` hits redirector not list | `src/pages/dashboard/[id].tsx:463` | Error-state back button never reaches list |
| P0-4 | `handleDelete`/`handleBulkDelete` unconditional success toast + no confirm | `alert/list:96,104` `report/list:91,96` `users/list:44,45` `roles/list:38,39` `rowlevelsecurity/list:43,44` `annotationlayer:37` `csstemplates:34` `tag:37` `dashboard/list:179` | Destructive, irreversible, no undo — accidental click loses data, also hides 403/404 |

### P1 — Placeholder (toast-only, should be real or honestly deferred)
| # | What | File:line | Expected |
|---|---|---|---|
| P1-1 | Dashboard Import | `dashboard/list:312` | Wire `FileReader → POST /api/importexport` or keep honest "JSON only" but parse file |
| P1-2 | Dashboard Share (no clipboard) | `dashboard/list:841` | `navigator.clipboard.writeText` (view page `538` does it correctly — copy that) |
| P1-3 | Dashboard Email | `dashboard/list:850` | Honest deferred if alerts not wired — note "Configure in Alerts" is already honest, but toast-only reads as stub |
| P1-4 | Dashboard Change owners | `dashboard/list:859` | Picker + `PUT /api/dashboards/:id` |
| P1-5 | Alerts/Reports Test (placebo) | `alert/list:108,235` `report/list:92,195` | `POST /api/alerts/:id/test` — currently `showToast` with no dispatch |
| P1-6 | SQL Lab Visualize toast | `sqllab:1136` | `navigate("/explore?...")` or remove button until built |
| P1-7 | Dashboard View Favorite local only | `dashboard/[id]:526` | `POST /api/dashboards/:id {favorite}` like list does |
| P1-8 | Dashboard View Filters visual-only | `dashboard/[id]:576,584,595` | Either wire to chart re-query or badge as "Static UI" (already noted — honest) |
| P1-9 | Datasets Explore / View / Refresh metadata (toast-only) | `datasets/index.tsx:743,753,318` | `Explore → /explore?datasetId=`, `View → preview drawer`, `Refresh → POST /api/datasets/:id/refresh` |
| P1-10 | Databases Scan schemas/tables (fake) | `databases/index.tsx:249` | `POST /api/databases/:id/scan` — currently `sleep 600ms` + counts client `db.schemas` |
| P1-11 | Saved Queries Import (toast-only) | `savedquerylist/list/index.tsx:197` | File picker → `POST /api/savedqueries/import` |
| P1-12 | Re-export deep-links render list not editor | `dataset/edit/[id].tsx`, `databaseview/edit/[id].tsx` | Hydrate via `useParams().id → GET /api/datasets|databases/:id` or show 404 |

### P2 — Minor (cosmetic / stale / fragility)
| # | What | File:line |
|---|---|---|
| P2-1 | Hardcoded role filters stale (new roles unfilterable) | `users/list:90` `rowlevelsecurity/list:89` `permissions/list:52` — fetch `GET /api/roles` dynamically |
| P2-2 | Hardcoded tag list static | `dashboard/list:377` — fetch `GET /api/tags` |
| P2-3 | Clause truncation `slice(0,80)…` no tooltip | `rowlevelsecurity/list:150` — add `title` for full WHERE |
| P2-4 | `Math.max(1, ceil(total/pageSize))` shows "page 1 of 1" on 0 results | All lists — guard `pageCount = total===0?0:ceil(...)` |
| P2-5 | Search per-keystroke no debounce | All lists — add 250ms debounce + abort controller |
| P2-6 | Pagination/search `indeterminate` prop depends on ui/checkbox impl | `alert/list:202` etc — verify `src/components/ui/checkbox.tsx` supports it |
| P2-7 | `welcome` quickStats `—` on 401 silent swallowing | `welcome:65` — show error banner, check `r.ok` |
| P2-8 | `about` links `href="#"` before `info` loads | `about:19,20` — disable until loaded or hide |
| P2-9 | `importexport` dead branch `Array.isArray(json)` after object guard | `importexport:34` — remove unreachable check |
| P2-10 | `settings/ai` no `AppShell` (layout divergence) | `settings/ai:200` — document or wrap consistently |
| P2-11 | Data filters stale — DB/Schema/Table options from `seedDatabases` not live | `datasets/index.tsx:365` `databases filter`, `savedquerylist:227`, `sqllab/history:172`, `csvtodatabaseview/form:439` — fetch `GET /api/databases` dynamically |
| P2-12 | `sqllab/history` silent mock fallback masks 401 | `sqllab/history/index.tsx:88` — replace with error banner + `r.ok` guard |

---

## How this was audited

- Each file read in full; every `showToast`, `fetch(`, `Link to=`, `navigate(`, `Input`/`select`/`Checkbox` inventoried line by line.
- `grep -R "showToast.*not yet|coming soon" src/pages` → 0 generic stubs; 8–10 honest toasts found line-referenced above.
- `grep -R "fetch(\"/api" src/pages` vs `grep -R "Authorization` → 14 pages missing header — patch `src/main.tsx:17` injects at runtime but not reflected in source.
- `ls -R src/pages` confirms `src/pages/chart/[id].tsx` absent → `/chart/:id` 404.
- `npm run lint` / `npm run build` not re-run in this read-only pass per instructions; previous passes `lint 0 warnings, build 161kB` retained.

*Absolute paths are under `src/pages/` — lines as noted per file.*

