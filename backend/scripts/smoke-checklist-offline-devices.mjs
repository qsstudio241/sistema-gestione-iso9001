/**
 * Smoke checklist: offline, refresh, stesso audit su mobile e desktop.
 * Frontend passato in SGQ_SMOKE_BASE_URL, API solo TEST (test-api). Mai PROD.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const BASE = process.env.SGQ_SMOKE_BASE_URL || 'http://127.0.0.1:5173';
const ART = process.env.SGQ_SMOKE_ARTIFACTS || '/opt/cursor/artifacts';
const EMAIL = process.env.SGQ_APP_EMAIL;
const PASSWORD = process.env.SGQ_APP_PASSWORD;
const COMPANY = process.env.SGQ_SMOKE_COMPANY || 'Smoke Ingest Test SRL';
const API = 'https://sistemi.fr-busato.it:8443/test-api/api/v1';

if (!EMAIL || !PASSWORD) {
  console.error('Credenziali smoke mancanti');
  process.exit(1);
}

const stats = { requests: 0, byStatus: {}, http429: 0, checklistWrites: 0, prodRequests: 0 };

function track(url, status, method) {
  let hostPath = url;
  try {
    const u = new URL(url);
    hostPath = u.host + u.pathname;
    if (u.host.includes('sistemi.fr-busato.it') && !u.pathname.includes('/test-api/')) {
      stats.prodRequests += 1;
    }
    if (!u.pathname.includes('/test-api/')) return;
  } catch {
    return;
  }
  stats.requests += 1;
  const key = String(status);
  stats.byStatus[key] = (stats.byStatus[key] || 0) + 1;
  if (status === 429) stats.http429 += 1;
  const isWrite = method !== 'GET' && method !== 'HEAD'
    && /\/audits\/[^/]+\/(events|responses|sync)/.test(hostPath);
  if (isWrite) stats.checklistWrites += 1;
}

function watch(page) {
  page.on('dialog', (dialog) => { dialog.accept().catch(() => {}); });
  page.on('response', (res) => track(res.url(), res.status(), res.request().method()));
  page.addInitScript(() => {
    try {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: () => sessionStorage.getItem('sgq-smoke-offline') !== '1',
      });
    } catch { /* già definito */ }
    const kill = () => {
      document.querySelectorAll('iframe[title="Netlify Drawer"], [data-netlify-deploy-id]').forEach((node) => node.remove());
    };
    const start = () => {
      kill();
      new MutationObserver(kill).observe(document.documentElement, { childList: true, subtree: true });
    };
    if (document.documentElement) start();
    else document.addEventListener('DOMContentLoaded', start);
  });
}

async function fillReact(locator, value) {
  await locator.click();
  await locator.fill('');
  await locator.pressSequentially(value, { delay: 12 });
}

async function login(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('input[placeholder="Inserisci email"]', { timeout: 30000 });
  await fillReact(page.locator('input[placeholder="Inserisci email"]'), EMAIL);
  await fillReact(page.locator('input[placeholder="Inserisci password"]'), PASSWORD);
  await page.getByRole('button', { name: 'Accedi' }).click();
  const scope = page.getByRole('combobox', { name: 'Ambito azienda' });
  await scope.waitFor({ timeout: 30000 });
  await scope.click();
  await scope.fill(COMPANY);
  const option = page.locator('.layout-scope-option', { hasText: COMPANY }).first();
  await option.waitFor({ timeout: 15000 });
  await option.click();
}

async function openChecklist(page) {
  await page.locator('#sgq-section-checklist').getByRole('button', { name: /Checklist/ }).first().click();
  await page.getByRole('button', { name: /ISO 9001:2015/ }).click();
  await page.getByTitle('Espandi tutto').click();
  await page.waitForFunction(() => document.querySelectorAll('.question-card').length > 0, { timeout: 30000 });
}

async function setAnswer(page, index, letter) {
  const btn = page.locator('.question-card').nth(index).locator('button.status-btn', { hasText: new RegExp(`^${letter}$`) });
  await btn.scrollIntoViewIfNeeded();
  await btn.click({ timeout: 8000 });
}

async function blockApi(context) {
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.includes('sistemi.fr-busato.it')) return route.abort('internetdisconnected');
    return route.continue();
  });
  for (const page of context.pages()) {
    await page.evaluate(() => window.dispatchEvent(new Event('offline'))).catch(() => {});
  }
}

async function unblockApi(context) {
  await context.unroute('**/*');
  for (const page of context.pages()) {
    await page.evaluate(() => window.dispatchEvent(new Event('online'))).catch(() => {});
  }
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome',
});
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  serviceWorkers: 'block',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await mobile.newPage();
watch(page);

const result = { base: BASE, company: COMPANY };

try {
  await mkdir(ART, { recursive: true });
  await login(page);
  await page.goto(`${BASE}/audit`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Caricamento in corso').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  const createBtn = page.locator('.audit-selector').getByRole('button', { name: /Crea Primo Audit|Nuovo/ }).first();
  await createBtn.waitFor({ timeout: 20000 });
  await createBtn.click();
  await page.locator('#auditorName').fill('Smoke Offline');
  const iso = page.getByLabel(/ISO 9001:2015/);
  if (!(await iso.isChecked())) await iso.check();
  await page.getByRole('button', { name: /Crea Audit/ }).click();
  await page.waitForFunction(() => {
    const sel = document.querySelector('#audit-select');
    return sel && sel.value;
  }, { timeout: 30000 });
  const auditUuid = await page.locator('#audit-select').inputValue();
  result.auditUuid = auditUuid;
  console.log('AUDIT', auditUuid);

  await openChecklist(page);
  await setAnswer(page, 1, 'C');
  await setAnswer(page, 2, 'OSS');
  await page.waitForTimeout(2500);

  await blockApi(mobile);
  await page.evaluate(() => {
    sessionStorage.setItem('sgq-smoke-offline', '1');
    window.dispatchEvent(new Event('offline'));
  });
  await setAnswer(page, 0, 'OSS');
  await setAnswer(page, 3, 'NC');
  await page.waitForTimeout(500);
  result.pendingWhileOffline = await page.evaluate(() => {
    let n = 0;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('sgq:qdiff:')) continue;
      try { n += Object.keys(JSON.parse(localStorage.getItem(key) || '{}').questions || {}).length; } catch { /* ignore */ }
    }
    return n;
  });
  result.badgeOffline = await page.locator('.audit-save-status').innerText().catch(() => '');
  await page.screenshot({ path: join(ART, 'smoke-offline-prima-refresh.png') });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const sel = document.querySelector('#audit-select');
    return sel && sel.value;
  }, { timeout: 30000 });
  result.reopenedOffline = String(await page.locator('#audit-select').inputValue()).toLowerCase() === String(auditUuid).toLowerCase();
  await openChecklist(page);
  result.answerKeptAfterOfflineRefresh = await page.locator('.checklist-stats').innerText().catch(() => '');
  result.activeAfterRefresh = await page.locator('button.status-btn.active').count();
  result.pendingAfterRefresh = await page.evaluate(() => {
    let n = 0;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('sgq:qdiff:')) continue;
      try { n += Object.keys(JSON.parse(localStorage.getItem(key) || '{}').questions || {}).length; } catch { /* ignore */ }
    }
    return n;
  });
  await page.screenshot({ path: join(ART, 'smoke-offline-dopo-refresh.png') });
  console.log('OFFLINE', result.pendingWhileOffline, result.answerKeptAfterOfflineRefresh, result.pendingAfterRefresh);

  const desktop = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    serviceWorkers: 'block',
  });
  const desk = await desktop.newPage();
  watch(desk);
  await login(desk);
  await desk.goto(`${BASE}/audit`, { waitUntil: 'domcontentloaded' });
  await desk.locator('#audit-select').waitFor({ timeout: 30000 });
  const picked = await desk.waitForFunction((uuid) => {
    const sel = document.querySelector('#audit-select');
    if (!sel) return false;
    const wanted = String(uuid).toLowerCase();
    const option = Array.from(sel.options).find((item) => String(item.value).toLowerCase() === wanted);
    if (!option) return false;
    sel.value = option.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, auditUuid, { timeout: 30000 }).catch(() => null);
  if (!picked) {
    await desk.reload({ waitUntil: 'domcontentloaded' });
    await desk.waitForFunction((uuid) => {
      const sel = document.querySelector('#audit-select');
      if (!sel) return false;
      const wanted = String(uuid).toLowerCase();
      const option = Array.from(sel.options).find((item) => String(item.value).toLowerCase() === wanted);
      if (!option) return false;
      sel.value = option.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, auditUuid, { timeout: 30000 });
  }
  await desk.waitForTimeout(1500);
  await openChecklist(desk);
  await setAnswer(desk, 4, 'C');
  await setAnswer(desk, 0, 'NC');
  await desk.waitForTimeout(3000);
  await desk.screenshot({ path: join(ART, 'smoke-desktop-stessa-domanda.png') });

  await unblockApi(mobile);
  await page.evaluate(() => {
    sessionStorage.removeItem('sgq-smoke-offline');
    window.dispatchEvent(new Event('online'));
  });
  await page.waitForTimeout(4000);
  result.conflictText = await page.getByText('Versione più recente sul server').first().innerText().catch(() => '');
  result.conflictDetail = await page.getByText(/Domanda \d+/).first().innerText().catch(() => '');
  await page.screenshot({ path: join(ART, 'smoke-mobile-dopo-online.png') });

  result.server = await page.evaluate(async (uuid) => {
    const token = localStorage.getItem('sgq_auth_token');
    const headers = { Authorization: `Bearer ${token}` };
    const listRes = await fetch(`https://sistemi.fr-busato.it:8443/test-api/api/v1/audits?limit=50`, { headers });
    const list = await listRes.json();
    const row = (list.data || []).find((a) => String(a.audit_uuid).toLowerCase() === String(uuid).toLowerCase());
    if (!row) return { missing: true, http: listRes.status };
    const resRes = await fetch(`https://sistemi.fr-busato.it:8443/test-api/api/v1/audits/${row.audit_id}/responses`, { headers });
    const body = await resRes.json();
    const responses = body.data || [];
    const by = {};
    for (const item of responses) {
      const key = item.conformity_status || 'NULL';
      by[key] = (by[key] || 0) + 1;
    }
    const first = responses.find((item) => item.question_text);
    return {
      http: resRes.status,
      audit_id: row.audit_id,
      answered_questions: row.answered_questions,
      total_questions: row.total_questions,
      responseCount: responses.length,
      by,
      sample: first ? { status: first.conformity_status, text: String(first.question_text).slice(0, 80) } : null,
    };
  }, auditUuid);
  console.log('SERVER', JSON.stringify(result.server));
  console.log('CONFLICT', (result.conflictText || '').replace(/\s+/g, ' ').slice(0, 240));
  await desktop.close();
} catch (err) {
  result.error = String(err && err.message ? err.message : err);
  try { await page.screenshot({ path: join(ART, 'smoke-offline-errore.png'), fullPage: true }); } catch { /* ignore */ }
  console.error('SMOKE_ERR', result.error);
} finally {
  result.requests = stats.requests;
  result.byStatus = stats.byStatus;
  result.http429 = stats.http429;
  result.checklistWrites = stats.checklistWrites;
  result.prodRequests = stats.prodRequests;
  result.api = API;
  await writeFile(join(ART, 'smoke-offline-risultato.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({
    requests: stats.requests,
    http429: stats.http429,
    checklistWrites: stats.checklistWrites,
    prodRequests: stats.prodRequests,
    pendingWhileOffline: result.pendingWhileOffline,
    pendingAfterRefresh: result.pendingAfterRefresh,
    answerKeptAfterOfflineRefresh: result.answerKeptAfterOfflineRefresh,
    reopenedOffline: result.reopenedOffline,
    conflict: (result.conflictText || '').slice(0, 180),
    conflictDetail: (result.conflictDetail || '').slice(0, 220),
    server: result.server || null,
    error: result.error || null,
  }));
  await browser.close();
}

if (result.error || result.prodRequests > 0 || result.http429 > 0) process.exit(1);
if (!result.reopenedOffline) process.exit(1);
if (!result.pendingWhileOffline) process.exit(1);
if (!result.activeAfterRefresh || result.activeAfterRefresh < 2) process.exit(1);
