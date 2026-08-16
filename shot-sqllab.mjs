import { chromium } from 'playwright';

const base = 'http://localhost:5001';

async function shot(page, path, file, fn) {
  await page.goto(base + path, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);
  if (fn) await fn(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `/tmp/${file}`, fullPage: true });
  console.log(`saved ${file}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  // 1. Default empty results state
  await shot(page, '/sqllab/', 'sqllab-default.png', null);

  // 2. Run query -> results
  await page.getByRole('button', { name: /^Run$/ }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/tmp/sqllab-results.png', fullPage: true });
  console.log('saved sqllab-results.png');

  // 3. History tab
  await page.getByRole('button', { name: /History/ }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/sqllab-history.png', fullPage: true });
  console.log('saved sqllab-history.png');

  // 4. Saved Queries tab
  await page.getByRole('button', { name: /Saved Queries/ }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/sqllab-saved.png', fullPage: true });
  console.log('saved sqllab-saved.png');
} finally {
  await browser.close();
}
console.log('done');
