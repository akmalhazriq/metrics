import { chromium } from 'playwright';
const base='http://localhost:5001';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
await page.goto(base+'/databases',{waitUntil:'networkidle',timeout:15000});
await page.waitForTimeout(1500);
await page.screenshot({path:'/tmp/databases-default.png',fullPage:true});
console.log('default');
await page.getByRole('button',{name:'Add database',exact:true}).click();
await page.waitForTimeout(800);
await page.screenshot({path:'/tmp/databases-editor-connection.png',fullPage:true});
console.log('connection');
await page.getByRole('button',{name:'Performance'}).click();
await page.waitForTimeout(400);
await page.screenshot({path:'/tmp/databases-editor-performance.png',fullPage:true});
console.log('perf');
// close editor
await page.getByRole('button',{name:'Cancel'}).click();
await page.waitForTimeout(400);
// open first row actions
const rowBtn=page.locator('button[aria-label="Row actions"]').first();
await rowBtn.click();
await page.waitForTimeout(400);
await page.screenshot({path:'/tmp/databases-row-actions.png',fullPage:true});
console.log('actions');
// filter test
await page.mouse.click(10,10);
await page.waitForTimeout(300);
await page.locator('input[placeholder="Search by name…"]').fill('analytics');
await page.waitForTimeout(600);
await page.screenshot({path:'/tmp/databases-filtered.png',fullPage:true});
console.log('filtered');
await browser.close();
console.log('done');
