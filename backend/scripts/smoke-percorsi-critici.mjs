/**
 * Smoke UI autenticato — percorsi critici (login, NC, Qualifiche, SAL, WPS/WPQR).
 *
 * Uso (Cloud Agent, dopo deploy o PR che tocca questi flussi):
 *   node backend/scripts/smoke-percorsi-critici.mjs
 *
 * Playwright è la devDependency di backend/; Chromium è nello snapshot
 * Cloud (`cloud-install.sh`). Non reinstallare in /tmp.
 * Se i binari mancano (boot a freddo): cd backend && npx playwright install chromium
 *
 * Env:
 *   SGQ_APP_EMAIL / SGQ_APP_PASSWORD  (obbligatori — Secrets, mai in Git)
 *   SGQ_SMOKE_BASE_URL                (default https://systemgest.netlify.app)
 *   SGQ_SMOKE_PATHS                   (opz.: login,nc,qualifiche,sal,wps — default: tutti)
 *   SGQ_SMOKE_ARTIFACTS               (default /opt/cursor/artifacts)
 *
 * Ingest WPQR API: backend/scripts/smoke-ingest-e2e-test.js
 * Copertura ERAM:  backend/scripts/smoke-eram-coverage-ui.js
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const EMAIL = process.env.SGQ_APP_EMAIL || 'admin@sgq.local';
const PASSWORD = process.env.SGQ_APP_PASSWORD;
const BASE = process.env.SGQ_SMOKE_BASE_URL || 'https://systemgest.netlify.app';
const ART = process.env.SGQ_SMOKE_ARTIFACTS || '/opt/cursor/artifacts';

if (!PASSWORD) {
  console.error('SGQ_APP_PASSWORD mancante');
  process.exit(1);
}

const ALL_ROUTES = [
  { id: 'login', path: null, afterLogin: false },
  { id: 'nc', path: '/nc', afterLogin: true },
  { id: 'qualifiche', path: '/qualifiche', afterLogin: true },
  { id: 'sal', path: '/sal', afterLogin: true },
  { id: 'wps', path: '/saldatura/procedure', afterLogin: true },
];

const wanted = new Set(
  (process.env.SGQ_SMOKE_PATHS || 'login,nc,qualifiche,sal,wps')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

async function fillReactInput(page, selector, value) {
  await page.locator(selector).click();
  await page.locator(selector).fill('');
  await page.locator(selector).pressSequentially(value, { delay: 20 });
}

async function stillOnLogin(page) {
  return (await page.$('input[placeholder="Inserisci email"]')) !== null;
}

async function launchChromium() {
  try {
    return await chromium.launch({ headless: true });
  } catch (err) {
    const msg = String(err?.message || err);
    if (/Executable doesn't exist/i.test(msg)) {
      console.error('Chromium Playwright assente. Su Cloud Agent lo installa .cursor/scripts/cloud-install.sh.');
      console.error('Fallback una tantum: cd backend && npx playwright install chromium');
    }
    throw err;
  }
}

const browser = await launchChromium();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const failures = [];

try {
  await mkdir(ART, { recursive: true });

  page.on('response', async (res) => {
    if (res.url().includes('sistemi.fr-busato.it') || res.url().includes('/auth')) {
      console.log(`[NET] [${res.status()}] ${res.url()}`);
    }
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[placeholder="Inserisci email"]', { state: 'visible' });
  await fillReactInput(page, 'input[placeholder="Inserisci email"]', EMAIL);
  await fillReactInput(page, 'input[placeholder="Inserisci password"]', PASSWORD);
  await page.click('button:has-text("Accedi")');
  await page.waitForTimeout(5000);

  const loginFailed = await stillOnLogin(page);
  await page.screenshot({ path: join(ART, 'smoke_critici_login.png'), fullPage: true });
  if (wanted.has('login')) {
    if (loginFailed) {
      failures.push('login');
      console.log('FAIL login: form ancora visibile');
    } else {
      console.log('OK login');
    }
  }
  if (loginFailed) {
    console.error('Login fallito: skip percorsi successivi');
    process.exit(1);
  }

  for (const route of ALL_ROUTES) {
    if (!route.afterLogin || !wanted.has(route.id)) continue;
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    const bounced = await stillOnLogin(page);
    const shot = join(ART, `smoke_critici_${route.id}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    if (bounced) {
      failures.push(route.id);
      console.log(`FAIL ${route.id} (${route.path}): tornato al login`);
    } else {
      console.log(`OK ${route.id} ${route.path} → ${shot}`);
    }
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`FAIL smoke-percorsi-critici: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('OK smoke-percorsi-critici');
