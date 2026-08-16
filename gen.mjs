import fs from 'fs';
const pop = fs.readFileSync('/tmp/b64_pop.txt','utf8').trim();
const empty = fs.readFileSync('/tmp/b64_empty.txt','utf8').trim();
const list = fs.readFileSync('/tmp/b64_list.txt','utf8').trim();
const html = `<!doctype html>
<title>Dashboard List — Dev Screenshots</title>
<style>
  :root{--bg:#fafaf9;--fg:#1c1c1f;--muted:#6b7280;--border:#e7e5e4;--card:#ffffff;--accent:#0a0a0a}
  @media(prefers-color-scheme:dark){:root{--bg:#0a0a0b;--fg:#fafaf9;--muted:#9ca3af;--border:#27272a;--card:#18181b;--accent:#fafaf9}}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 "Space Grotesk", ui-sans-serif, system-ui}
  .wrap{max-width:1100px;margin:0 auto;padding:32px 20px 48px}
  h1{font-size:22px;letter-spacing:-0.02em;margin:0}
  .sub{color:var(--muted);margin:6px 0 20px;max-width:60ch}
  .meta{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 24px}
  .pill{font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;border:1px solid var(--border);background:var(--card);padding:6px 10px;border-radius:999px}
  .pill--ok{border-color:#16a34a;color:#16a34a}
  .grid{display:grid;gap:24px}
  .shot{border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--card);box-shadow:0 1px 2px rgba(0,0,0,0.06)}
  .shot__head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:8px}
  .shot__title{font-weight:600;font-size:13px}
  .shot__path{font-size:11px;color:var(--muted);font-family:ui-monospace, SFMono-Regular, monospace;background:var(--bg);border:1px solid var(--border);padding:3px 7px;border-radius:999px}
  .shot img{display:block;width:100%;height:auto}
  .note{margin-top:10px;font-size:12px;color:var(--muted);line-height:1.6}
  .note code{font-family:ui-monospace, monospace;font-size:11px;background:var(--bg);border:1px solid var(--border);padding:2px 5px;border-radius:6px}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
  @media(max-width:700px){.two{grid-template-columns:1fr}}
  .callout{margin-top:20px;border:1px dashed var(--border);background:var(--card);border-radius:10px;padding:14px}
  .callout h3{margin:0 0 6px;font-size:13px}
  .callout p{margin:0;color:var(--muted);font-size:12px;line-height:1.6}
</style>
<div class="wrap">
  <h1>Dashboard List — wired into <code>npm run dev</code></h1>
  <p class="sub">One representative page built end-to-end: layout shell → typed seed → H3 handler → list UI. Verified on the live Vite+Nitro dev server; no further pages started.</p>
  <div class="meta">
    <span class="pill pill--ok">● dev: 5001 (5000 busy — AirPlay)</span>
    <span class="pill">vite + nitro</span>
    <span class="pill">/dashboard → /dashboard/list/</span>
    <span class="pill">lint + build ✓</span>
  </div>

  <div class="grid">
    <div class="shot">
      <div class="shot__head">
        <span class="shot__title">Populated — /dashboard</span>
        <span class="shot__path">http://localhost:5001/dashboard · 24 dashboards · sort: Modified desc</span>
      </div>
      <img src="data:image/png;base64,${pop}" alt="Dashboard populated — /dashboard" loading="lazy">
      <div style="padding:12px 14px;border-top:1px solid var(--border);font-size:12px;color:var(--muted)">Title · Modified by · Status (Published green / Draft amber / Archived muted) · Modified · Created by · Owners (avatar stack) · Tags (pills) · Favorite (heart). Search, status segmented control, Favorites toggle, tag select, owner filter, bulk bar, row kebab with 10 actions, pagination 1–10 of 24.</div>
    </div>

    <div class="shot">
      <div class="shot__head">
        <span class="shot__title">Populated — /dashboard/list/</span>
        <span class="shot__path">http://localhost:5001/dashboard/list/ · alias → same component</span>
      </div>
      <img src="data:image/png;base64,${list}" alt="Dashboard populated — /dashboard/list/" loading="lazy">
      <div style="padding:12px 14px;border-top:1px solid var(--border);font-size:12px;color:var(--muted)">Spec alias verified — <code>src/pages/dashboard/list/index.tsx</code> re-exports <code>src/pages/dashboard/index.tsx</code>. Parses as <code>/dashboard/list/</code> via vite-plugin-pages; no duplicate logic.</div>
    </div>

    <div class="shot">
      <div class="shot__head">
        <span class="shot__title">Empty — filtered to zero</span>
        <span class="shot__path">Search “zzzz-no-match-xyz” → No dashboards match your filters</span>
      </div>
      <img src="data:image/png;base64,${empty}" alt="Dashboard empty state" loading="lazy">
      <div style="padding:12px 14px;border-top:1px solid var(--border);font-size:12px;color:var(--muted)">Empty state microcopy: “Try adjusting search, status, owner, or tags. Or create a new dashboard from scratch.” with <em>Clear filters</em> + <em>Create dashboard</em> CTAs — not a bare “No data”.</div>
    </div>
  </div>

  <div class="callout">
    <h3>Data-layer decision — placeholder, flagged in UI</h3>
    <p><code>src/data/dashboards.ts</code> (24 typed seeds) + <code>routes/api/dashboards/index.get.ts</code> (in-memory filter/sort/paginate via <code>getQuery</code>) is explicitly marked as a placeholder to swap for a DB query. Mutations (create, favorite, duplicate, delete, export to JSON) run client-side only; footer note on the page states this. The <code>Dashboard</code> type in <code>src/types/dashboard.ts</code> is the contract to keep.</p>
  </div>

  <div class="two">
    <div class="callout">
      <h3>Shell</h3>
      <p><code>src/components/layout/AppShell.tsx</code> — 44px top bar + 220px sidebar (<code>bg-sidebar</code> tokens), Workspace/Data/Govern sections. Used only by this page so far; ready for every future page to wrap.</p>
    </div>
    <div class="callout">
      <h3>Tokens</h3>
      <p>Extended <code>src/index.css</code> with <code>--success/--warning/--info/--favorite</code> in OKLCH (light + dark + <code>@theme inline</code>). Fixed <code>--destructive-foreground</code>. No second system introduced.</p>
    </div>
  </div>

  <p class="note">Run locally: <code>npm run dev</code> → dev server on <code>5001</code> (5000 fallback). Open <code>/dashboard</code> and <code>/dashboard/list/</code>. Filter to empty by typing <code>zzzz-no-match-xyz</code> in the title search. Dev server PID 42762 is still running.</p>
</div>
`;
fs.writeFileSync('/tmp/dashboard-review.html', html);
console.log('wrote /tmp/dashboard-review.html', Buffer.byteLength(html));
