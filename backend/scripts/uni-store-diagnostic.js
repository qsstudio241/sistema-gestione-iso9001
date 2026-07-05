'use strict';

/**
 * Diagnostico UNI Store — verifica fattibilità connettore NormBroker (ADR-010, Task 1-E).
 *
 * Obiettivo: capire se è tecnicamente possibile automatizzare login + ricerca +
 * estrazione testo di una norma da store.uni.com, prima di investire nello sviluppo
 * del vero `uniStoreConnector.js`.
 *
 * NON è una feature di produzione: nessun endpoint API la richiama. È uno script
 * manuale, eseguito una tantum da terminale, con credenziali lette da variabili
 * d'ambiente (mai hardcoded, mai loggate).
 *
 * Uso:
 *   1. Aggiungere in backend/.env (mai committare):
 *        UNI_STORE_EMAIL=...
 *        UNI_STORE_PASSWORD=...
 *        UNI_STORE_TEST_NORM_CODE=UNI EN ISO 3834-2   (opzionale, default sotto)
 *   2. node backend/scripts/uni-store-diagnostic.js
 *
 * Output: log testuale passo-passo + screenshot in backend/scripts/uni-store-artifacts/
 * (cartella gitignorata) per ogni fase, cosi' l'esito e' verificabile anche se lo
 * script fallisce a meta'.
 *
 * ESITO TEST 05/07/2026: login bloccato da protezione anti-bot lato UNI — la
 * chiamata di autenticazione non riceve risposta HTTP (non un problema di
 * selettori), riprodotto sia headless sia headed con user-agent reale.
 * Decisione: NON proseguire con tecniche di evasione anti-bot (fragili e
 * probabile violazione dei Termini di Servizio UNI). Vedi ADR-010 e
 * GUIDA_CONSOLIDATA.md per il dettaglio ed alternative legali/manuali.
 * Per il lookup catalogo/vigore norma (senza login) usare invece
 * backend/src/services/uniStoreConnector.service.js — già funzionante.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const fs = require('fs');

const EMAIL = process.env.UNI_STORE_EMAIL;
const PASSWORD = process.env.UNI_STORE_PASSWORD;
const TEST_NORM_CODE = process.env.UNI_STORE_TEST_NORM_CODE || 'UNI EN ISO 3834-2';

const ARTIFACTS_DIR = path.join(__dirname, 'uni-store-artifacts');

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function shot(page, label) {
  try {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
    const file = path.join(ARTIFACTS_DIR, `${ts()}_${label}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`  [screenshot] ${file}`);
  } catch (err) {
    console.warn(`  [screenshot] fallito (${label}): ${err.message}`);
  }
}

async function findLoginLink(page) {
  const candidates = ['Accedi', 'Login', 'Il mio account', 'Area riservata', 'Log in'];
  for (const text of candidates) {
    const link = page.getByRole('link', { name: new RegExp(text, 'i') }).first();
    if (await link.count().catch(() => 0)) return link;
  }
  return null;
}

async function dismissCookieBanner(page) {
  const candidates = ['Accetta tutto', 'Accetta', 'Rifiuta tutto', 'OK', 'Chiudi'];
  for (const text of candidates) {
    const btn = page.getByRole('button', { name: new RegExp(`^${text}$`, 'i') }).first();
    if (await btn.count().catch(() => 0)) {
      await btn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
      return true;
    }
  }
  return false;
}

async function fillFirstMatch(page, selectors, value) {
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.count().catch(() => 0)) {
      await el.click({ timeout: 3000 }).catch(() => {});
      await el.fill('');
      await el.pressSequentially(value, { delay: 20 });
      return true;
    }
  }
  return false;
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error(
      'ERRORE: UNI_STORE_EMAIL / UNI_STORE_PASSWORD mancanti in backend/.env.\n' +
      'Aggiungi le due righe (vedi backend/.env.example) e riprova. Le credenziali NON vanno mai in chat o nel repository.'
    );
    process.exit(1);
  }

  const { chromium } = require('playwright');
  const report = { steps: [], success: false };

  console.log('=== Diagnostico UNI Store — avvio ===');
  console.log(`Norma di test: ${TEST_NORM_CODE}`);

  const HEADLESS = process.env.UNI_STORE_HEADLESS !== 'false';
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    locale: 'it-IT',
  });
  const page = await context.newPage();

  const netLog = [];
  const authLog = [];
  page.on('response', (res) => {
    if (res.status() >= 400) netLog.push(`[${res.status()}] ${res.url()}`);
    if (/login|signin|auth|customer|session/i.test(res.url()) && res.request().method() !== 'GET') {
      authLog.push({ url: res.url(), status: res.status(), method: res.request().method() });
      res.text().then((body) => {
        authLog[authLog.length - 1].bodyPreview = body.slice(0, 500);
      }).catch(() => {});
    }
  });

  try {
    console.log('\n[1/5] Apertura homepage store.uni.com...');
    await page.goto('https://store.uni.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await shot(page, '01_homepage');
    report.steps.push({ step: 'homepage', ok: true });

    console.log('[2/5] Ricerca link di login...');
    let loginLink = await findLoginLink(page);
    if (!loginLink) {
      console.warn('  Nessun link di login testuale trovato — provo URL diretti noti.');
      const directUrls = [
        'https://store.uni.com/customer/account/login/',
        'https://store.uni.com/account/login',
        'https://store.uni.com/login',
      ];
      let opened = false;
      for (const url of directUrls) {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);
        if (resp && resp.status() < 400) { opened = true; break; }
      }
      if (!opened) {
        report.steps.push({ step: 'find_login', ok: false, note: 'Nessuna pagina di login raggiungibile' });
        throw new Error('Impossibile individuare la pagina di login');
      }
    } else {
      await loginLink.click();
      await page.waitForLoadState('domcontentloaded');
    }
    await shot(page, '02_login_page');
    report.steps.push({ step: 'find_login', ok: true });

    console.log('[2b/5] Chiusura eventuale banner cookie...');
    const cookieDismissed = await dismissCookieBanner(page);
    console.log(`  Banner cookie gestito: ${cookieDismissed}`);
    await shot(page, '02b_after_cookie_banner');

    console.log('[3/5] Compilazione form di login...');
    const emailFilled = await fillFirstMatch(
      page,
      ['input[type="email"]', 'input[name*="email" i]', 'input[name*="login" i]', 'input#email'],
      EMAIL
    );
    const passFilled = await fillFirstMatch(
      page,
      ['input[type="password"]', 'input[name*="pass" i]', 'input#pass'],
      PASSWORD
    );

    if (!emailFilled || !passFilled) {
      await shot(page, '03_login_form_not_found');
      report.steps.push({ step: 'fill_login_form', ok: false, note: `email=${emailFilled} pass=${passFilled}` });
      throw new Error('Campi email/password non individuati sulla pagina di login (verificare screenshot)');
    }

    // Ridondanza: chiude di nuovo il banner cookie se ricomparso dopo il fill
    await dismissCookieBanner(page);

    const submitBtn = page.locator('button[type="submit"], input[type="submit"]').first();
    await shot(page, '03_login_form_filled');
    let submitted = false;
    if (await submitBtn.count()) {
      try {
        await Promise.all([
          page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {}),
          submitBtn.click({ timeout: 8000 }),
        ]);
        submitted = true;
      } catch (err) {
        console.warn(`  Click normale fallito (${err.message.split('\n')[0]}), provo click forzato...`);
        try {
          await submitBtn.click({ force: true, timeout: 5000 });
          await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
          submitted = true;
        } catch (err2) {
          console.warn(`  Click forzato fallito (${err2.message.split('\n')[0]}), provo invio da tastiera...`);
        }
      }
    }
    if (!submitted) {
      await page.locator('input[type="password"]').first().press('Enter').catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    }
    await page.waitForTimeout(1500); // lascia comparire eventuali toast/messaggi asincroni
    await shot(page, '04_after_login_submit');

    const errorTexts = await page.evaluate(() => {
      const sels = ['[role="alert"]', '.error', '.alert', '.toast', '.notification', '.message-error', '[class*="error" i]'];
      const found = [];
      sels.forEach((s) => document.querySelectorAll(s).forEach((el) => {
        const t = el.innerText && el.innerText.trim();
        if (t) found.push(t.slice(0, 200));
      }));
      return [...new Set(found)];
    }).catch(() => []);
    if (errorTexts.length) console.log(`  Messaggi di errore/alert rilevati nel DOM: ${JSON.stringify(errorTexts)}`);
    report.steps.push({ step: 'submit_login', ok: true, errorTexts });

    console.log('[4/5] Verifica esito login...');
    const stillHasPasswordField = await page.locator('input[type="password"]').count().catch(() => 0);
    const loginLooksOk = stillHasPasswordField === 0;
    console.log(`  Campo password ancora presente: ${stillHasPasswordField > 0} -> login ${loginLooksOk ? 'RIUSCITO (probabile)' : 'FALLITO o non completato'}`);
    report.steps.push({ step: 'login_check', ok: loginLooksOk });

    if (!loginLooksOk) {
      throw new Error('Login non confermato — vedere screenshot 04_after_login_submit');
    }

    console.log(`[5/5] Ricerca norma di test: "${TEST_NORM_CODE}"...`);
    const searchBox = page.locator('input[type="search"], input[name*="search" i], input#search').first();
    if (await searchBox.count().catch(() => 0)) {
      await searchBox.click();
      await searchBox.fill(TEST_NORM_CODE);
      await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      await shot(page, '05_search_results');
      report.steps.push({ step: 'search_norm', ok: true });

      const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
      const foundMention = bodyText.toLowerCase().includes(TEST_NORM_CODE.toLowerCase().slice(0, 10));
      console.log(`  Testo pagina contiene riferimento alla norma: ${foundMention}`);
      report.steps.push({ step: 'norm_mentioned_in_results', ok: foundMention });

      // Tentativo di apertura scheda norma + estrazione testo (probabile blocco DRM)
      const firstResultLink = page.locator('a').filter({ hasText: /3834|ISO|UNI/i }).first();
      if (await firstResultLink.count().catch(() => 0)) {
        await firstResultLink.click().catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
        await shot(page, '06_norm_detail_page');
        const detailText = await page.evaluate(() => document.body.innerText.slice(0, 2000)).catch(() => '');
        const hasIframeOrCanvas = await page.evaluate(
          () => document.querySelectorAll('iframe, canvas, embed[type*="pdf" i]').length
        ).catch(() => 0);
        console.log(`  Elementi iframe/canvas/embed nella pagina di dettaglio: ${hasIframeOrCanvas} (DRM/viewer protetto se >0)`);
        console.log(`  Estratto testo (primi 300 char): ${detailText.slice(0, 300).replace(/\s+/g, ' ')}`);
        report.steps.push({ step: 'norm_detail_extraction', ok: true, hasIframeOrCanvas, textPreview: detailText.slice(0, 300) });
      }
    } else {
      console.warn('  Nessuna casella di ricerca individuata sulla pagina post-login.');
      report.steps.push({ step: 'search_norm', ok: false, note: 'Search box non trovata' });
    }

    report.success = true;
  } catch (err) {
    console.error(`\nERRORE: ${err.message}`);
    report.error = err.message;
  } finally {
    if (netLog.length) {
      console.log('\nRisposte HTTP >=400 osservate:');
      netLog.slice(0, 10).forEach((l) => console.log(`  ${l}`));
    }
    await page.waitForTimeout(500).catch(() => {});
    if (authLog.length) {
      console.log('\nChiamate di rete relative a login/auth osservate:');
      authLog.forEach((l) => console.log(`  [${l.status}] ${l.method} ${l.url}\n    body: ${(l.bodyPreview || '').replace(/\s+/g, ' ')}`));
    } else {
      console.log('\nNessuna chiamata XHR/fetch di login/auth osservata (il form potrebbe inviare una POST tradizionale con redirect, o non essere partita affatto).');
    }
    report.authLog = authLog;
    await browser.close();

    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
    const reportFile = path.join(ARTIFACTS_DIR, `${ts()}_report.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\n=== Report salvato: ${reportFile} ===`);
    console.log(`Screenshot ed evidenze in: ${ARTIFACTS_DIR}`);
    console.log(report.success ? 'ESITO COMPLESSIVO: OK (vedi dettagli sopra per DRM/estrazione)' : 'ESITO COMPLESSIVO: FALLITO — vedere screenshot per capire dove');
  }
}

main();
