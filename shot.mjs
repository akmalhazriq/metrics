import { chromium } from 'playwright';

const base = 'http://localhost:5001';
const routes = [
  { path: '/dashboard', file: 'dashboard-populated.png', setup: null },
  { path: '/dashboard/list/', file: 'dashboard-list-populated.png', setup: null },
];

async function shot(browser, route, file) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(base + route, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `/tmp/${file}`, fullPage: true });
  console.log(`saved ${file}`);
  await page.close();
}

async function emptyShot(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(base + '/dashboard', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1200);
  // type a query that yields no results
  const input = page.locator('input[placeholder="Search by title…"]');
  await input.fill('zzzz-no-match-xyz');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/dashboard-empty.png', fullPage: true });
  console.log('saved dashboard-empty.png');
  await page.close();
}

const browser = await chromium.launch({ headless: true });
try {
  for (const r of routes) {
    await shot(browser, r.path, r.file);
  }
  await emptyShot(browser);
} finally {
  await browser.close();
}
console.log('done');
