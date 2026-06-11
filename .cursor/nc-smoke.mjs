import { chromium } from 'playwright';

async function fillReactInput(page, selector, value) {
  const loc = page.locator(selector);
  await loc.click();
  await loc.fill('');
  await loc.pressSequentially(value, { delay: 20 });
}

const EMAIL = process.env.SGQ_APP_EMAIL || 'admin@sgq.local';
const PASSWORD = process.env.SGQ_APP_PASSWORD;
if (!PASSWORD) { console.error('NO_PASSWORD'); process.exit(1); }

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();

await page.goto('https://systemgest.netlify.app', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForSelector('input[placeholder="Inserisci email"]', { timeout: 15000 });
await fillReactInput(page, 'input[placeholder="Inserisci email"]', EMAIL);
await fillReactInput(page, 'input[placeholder="Inserisci password"]', PASSWORD);
await page.click('button:has-text("Accedi")');
await page.waitForTimeout(5000);

const onLogin = await page.$('input[placeholder="Inserisci email"]');
console.log('LOGIN:', onLogin ? 'FAIL' : 'OK');

await page.goto('https://systemgest.netlify.app/nc', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

const title = await page.title();
const h1 = await page.locator('h1').first().textContent().catch(() => '');
const buttons = await page.locator('button').allTextContents();
const stats = await page.locator('.nc-stat-label').allTextContents().catch(() => []);
const rowCount = await page.locator('.sgq-datagrid tbody tr').count().catch(() => 0);
const hasExport = buttons.some(b => /Export CSV/i.test(b));
const hasNuova = buttons.some(b => /Nuova NC/i.test(b));
const hasAzioniScadenza = buttons.some(b => /Azioni in scadenza/i.test(b));

console.log('TITLE:', title);
console.log('H1:', h1?.trim());
console.log('STATS:', stats.join('|'));
console.log('ROWS:', rowCount);
console.log('HAS_EXPORT_CSV:', hasExport);
console.log('HAS_NUOVA_NC:', hasNuova);
console.log('HAS_AZIONI_SCADENZA:', hasAzioniScadenza);
console.log('BUTTONS:', buttons.filter(b => b.trim()).slice(0, 20).join(' | '));

if (rowCount > 0) {
  await page.locator('.sgq-datagrid tbody tr').first().click();
  await page.waitForTimeout(2000);
  const url = page.url();
  const detail = await page.locator('.nc-detail-section').count();
  const workflowBtns = await page.locator('.nc-workflow-btns button').allTextContents().catch(() => []);
  console.log('URL_AFTER_SELECT:', url);
  console.log('DETAIL_VISIBLE:', detail > 0);
  console.log('WORKFLOW_BTNS:', workflowBtns.join('|'));
}

await page.screenshot({ path: 'c:/ProgettoISO/.cursor/nc-manual-smoke.png', fullPage: true });
await browser.close();
