import { chromium } from 'playwright';

const EMAIL = process.env.SGQ_APP_EMAIL || 'admin@sgq.local';
const PASSWORD = process.env.SGQ_APP_PASSWORD;
if (!PASSWORD) {
  console.error('SGQ_APP_PASSWORD mancante');
  process.exit(1);
}

async function fillReactInput(page, selector, value) {
  await page.locator(selector).click();
  await page.locator(selector).fill('');
  await page.locator(selector).pressSequentially(value, { delay: 20 });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const results = [];

function log(step, ok, detail = '') {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'OK' : 'FAIL'} | ${step}${detail ? ' � ' + detail : ''}`);
}

try {
  await page.goto('https://systemgest.netlify.app', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('input[placeholder="Inserisci email"]', { timeout: 20000 });
  await fillReactInput(page, 'input[placeholder="Inserisci email"]', EMAIL);
  await fillReactInput(page, 'input[placeholder="Inserisci password"]', PASSWORD);
  await page.click('button:has-text("Accedi")');
  await page.waitForTimeout(5000);
  const onLogin = await page.$('input[placeholder="Inserisci email"]');
  log('Login produzione', !onLogin);

  await page.goto('https://systemgest.netlify.app/nc', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  const hasTitle = await page.locator('h1').filter({ hasText: 'Non Conformit' }).count();
  log('Pagina /nc caricata', hasTitle > 0);

  const exportBtn = page.locator('button:has-text("Export CSV")');
  log('Pulsante Export CSV', await exportBtn.count() > 0);

  const dueBtn = page.locator('button:has-text("Azioni in scadenza")');
  log('Tab Azioni in scadenza', await dueBtn.count() > 0);
  if (await dueBtn.count()) {
    await dueBtn.click();
    await page.waitForTimeout(2000);
    const duePanel = await page.locator('.nc-due-actions-panel').count();
    log('Pannello azioni cross-NC', duePanel > 0);
    await page.locator('button:has-text("Registro NC")').click();
    await page.waitForTimeout(1500);
  }

  const nuovaNc = page.locator('button:has-text("Nuova NC")');
  log('Pulsante Nuova NC', await nuovaNc.count() > 0);
  if (await nuovaNc.count()) {
    await nuovaNc.click();
    await page.waitForTimeout(1500);
    const auditSelect = page.locator('#nc-create-audit');
    const optCount = await auditSelect.locator('option').count();
    log('Modal creazione � dropdown audit', optCount > 1, `${optCount} opzioni`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  const rows = page.locator('.sgq-datagrid tbody tr');
  const rowCount = await rows.count();
  log('Griglia NC con righe', rowCount > 0, `${rowCount} righe`);

  if (rowCount > 0) {
    await rows.first().click();
    await page.waitForTimeout(2000);
    const detail = await page.locator('.nc-detail-section').count();
    log('Dettaglio NC espanso', detail > 0);
    const workflowBtns = await page.locator('.nc-workflow-btns .status-btn').count();
    log('Workflow status-btn', workflowBtns >= 0, `${workflowBtns} pulsanti`);
  }

  await page.screenshot({ path: 'C:/ProgettoISO/.cursor/nc-hardening-smoke.png', fullPage: true });
} catch (e) {
  log('Errore simulazione', false, e.message);
}

await browser.close();
const failed = results.filter(r => !r.ok);
console.log('\n=== RIEPILOGO ===');
console.log(JSON.stringify({ total: results.length, failed: failed.length, results }, null, 2));
process.exit(failed.length ? 1 : 0);
