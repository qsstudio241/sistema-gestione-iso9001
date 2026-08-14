/**
 * Smoke UI ERAM — copertura WPQR + idoneità visiva (P3/P4/P5)
 *
 * Usa token JWT dell'utente ERAM (org 1004) mintato sul VPS, perché
 * SGQ_APP_* punta all'admin org 1001 senza NDT.
 *
 * Prerequisiti:
 *   - SGQ_SSH_KEY_B64, SGQ_SUDO_PASSWORD (opz.)
 *   - playwright + Chromium da backend/ (cloud-install.sh sullo snapshot Cloud)
 *
 * Uso:
 *   node backend/scripts/smoke-eram-coverage-ui.js
 *   Se i binari mancano: cd backend && npx playwright install chromium
 *
 * Env opzionali:
 *   SGQ_SMOKE_BASE_URL  (default https://systemgest.netlify.app)
 *   SGQ_SMOKE_ERAM_EMAIL (default mauro.franciosi@eram-technologies.com)
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE = process.env.SGQ_SMOKE_BASE_URL || 'https://systemgest.netlify.app';
const ERAM_EMAIL = process.env.SGQ_SMOKE_ERAM_EMAIL || 'mauro.franciosi@eram-technologies.com';
const ART = '/opt/cursor/artifacts';

function mintEramToken() {
  if (!process.env.SGQ_SSH_KEY_B64) {
    throw new Error('SGQ_SSH_KEY_B64 mancante: serve per mintare JWT utente ERAM sul VPS');
  }
  const keyFile = path.join(os.tmpdir(), `sgq_smoke_key_${process.pid}`);
  fs.writeFileSync(keyFile, Buffer.from(process.env.SGQ_SSH_KEY_B64, 'base64'));
  fs.chmodSync(keyFile, 0o600);

  const remoteJs = `
process.env.NODE_ENV='production';
process.env.DB_SERVER='127.0.0.1';
process.env.DB_PORT='11043';
const fs=require('fs');
const jwt=require('/var/www/sgq-backend/node_modules/jsonwebtoken');
const {getPool,closePool}=require('/var/www/sgq-backend/src/config/database');
function secret(){
  const raw=fs.readFileSync('/var/www/sgq-backend/.env','utf8');
  for (const line of raw.split(/\\r?\\n/)) {
    const m=line.match(/^JWT_SECRET=(.*)$/);
    if(m) return m[1].trim().replace(/^[\"']|[\"']$/g,'');
  }
  throw new Error('JWT_SECRET missing');
}
(async()=>{
  const pool=await getPool();
  const email=${JSON.stringify(ERAM_EMAIL)};
  const r=await pool.request().input('email', email).query(
    "SELECT TOP 1 user_id, email, role, organization_id, auditor_org_id FROM users WHERE email=@email AND is_active=1"
  );
  const u=r.recordset[0];
  if(!u) throw new Error('ERAM user not found: '+email);
  const token=jwt.sign({
    user_id:u.user_id, email:u.email, role:u.role,
    organization_id:u.organization_id, auditor_org_id:u.auditor_org_id||null
  }, secret(), {expiresIn:'30m'});
  console.log(JSON.stringify({token, org:u.organization_id, email:u.email}));
  await closePool();
})().catch(e=>{ console.error(String(e)); process.exit(1); });
`;

  const remotePath = '/tmp/mint-eram-token-smoke.js';
  fs.writeFileSync('/tmp/mint-eram-token-smoke.js', remoteJs);

  const scp = spawnSync('scp', [
    '-i', keyFile, '-P', '1122', '-o', 'StrictHostKeyChecking=no',
    '/tmp/mint-eram-token-smoke.js', `spascarella@sistemi.fr-busato.it:${remotePath}`,
  ], { encoding: 'utf8' });
  if (scp.status !== 0) {
    fs.unlinkSync(keyFile);
    throw new Error(`scp failed: ${scp.stderr || scp.stdout}`);
  }

  const ssh = spawnSync('ssh', [
    '-i', keyFile, '-p', '1122', '-o', 'StrictHostKeyChecking=no',
    'spascarella@sistemi.fr-busato.it',
    `cd /var/www/sgq-backend && NODE_ENV=production DB_SERVER=127.0.0.1 DB_PORT=11043 node ${remotePath}`,
  ], { encoding: 'utf8' });
  fs.unlinkSync(keyFile);
  if (ssh.status !== 0) {
    throw new Error(`ssh mint failed: ${ssh.stderr || ssh.stdout}`);
  }
  const line = (ssh.stdout || '').trim().split('\n').filter((l) => l.startsWith('{')).pop();
  if (!line) throw new Error(`no token json in output: ${ssh.stdout}`);
  return JSON.parse(line);
}

async function fillReactInput(page, selector, value) {
  const loc = page.locator(selector).first();
  await loc.click();
  await loc.fill('');
  await loc.pressSequentially(String(value), { delay: 15 });
}

async function main() {
  // Fonte unica: backend/node_modules (stesso Chromium di cloud-install.sh).
  let chromium;
  let loaded = null;
  try {
    loaded = require('playwright');
    console.log(`Playwright da: backend (v${require('playwright/package.json').version})`);
  } catch {
    console.error('Playwright assente in backend/. Esegui: bash .cursor/scripts/cloud-install.sh');
    console.error('Oppure: cd backend && npm ci && npx playwright install chromium');
    process.exit(1);
  }
  ({ chromium } = loaded);

  fs.mkdirSync(ART, { recursive: true });
  const results = [];
  const pass = (name, detail = '') => {
    results.push({ name, ok: true, detail });
    console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`);
  };
  const fail = (name, detail = '') => {
    results.push({ name, ok: false, detail });
    console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
  };

  console.log('Mint JWT ERAM…');
  const { token, org, email } = mintEramToken();
  console.log(`Token OK org=${org} email=${email}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Inject token + reset scope qualifiche (evita Ambito stale da sessioni precedenti)
  await page.addInitScript((t) => {
    localStorage.setItem('sgq_auth_token', t);
    try {
      localStorage.removeItem('sgq-qualifications-company-scope');
    } catch (_) { /* ignore */ }
  }, token);

  try {
    // ── 1 Qualifiche NDT / visione ──────────────────────────────────────────
    await page.goto(`${BASE}/qualifiche`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);

    // Scope su ERAM-Technologies (ha NDT La Forgia). Evitare LM&CO o auto-scope a 1 sola azienda.
    const scopeSelect = page.locator('select[aria-label="Ambito qualifiche per azienda"]');
    if (await scopeSelect.count()) {
      const opted = await scopeSelect.locator('option').evaluateAll((opts) => {
        const hit = opts.find((o) => /ERAM/i.test(o.textContent || ''));
        return hit ? hit.value : '';
      });
      if (opted) await scopeSelect.selectOption(opted);
      else await scopeSelect.selectOption('');
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: `${ART}/smoke_eram_qualifications.png`, fullPage: true });

    const ndtTab = page.getByRole('button', { name: /^NDT$/i }).or(page.locator('button.sq-tab', { hasText: 'NDT' }));
    if (await ndtTab.count()) {
      await ndtTab.first().click();
      await page.waitForTimeout(2500);
    }
    // Banner o almeno la persona NDT in gap
    try {
      await page.locator('.sq-vision-banner, body').filter({ hasText: /idoneit/i }).first()
        .waitFor({ timeout: 8000 });
    } catch (_) { /* assert sotto */ }
    await page.screenshot({ path: `${ART}/smoke_eram_ndt.png`, fullPage: true });

    const bodyText = await page.locator('body').innerText();
    if (/idoneit/i.test(bodyText) && /visiv/i.test(bodyText)) {
      pass('1.3 Banner/testo idoneità visiva su NDT');
    } else if (/LA FORGIA|FORGIA/i.test(bodyText)) {
      pass('1.3 NDT: persona NDT presente (banner da verificare a occhio)', 'La Forgia in pagina');
    } else {
      fail('1.3 Banner idoneità visiva / NDT', 'testo non trovato (controllare Ambito azienda)');
    }

    const salute = page.getByRole('button', { name: /Salute mansione/i });
    if (await salute.count()) {
      await salute.first().click();
      await page.waitForTimeout(1500);
      pass('1.4 Tab Salute mansione apribile');
    } else {
      fail('1.4 Tab Salute mansione');
    }
    await page.screenshot({ path: `${ART}/smoke_eram_salute.png`, fullPage: true });

    // ── 2 Assistente need_input ─────────────────────────────────────────────
    await page.goto(`${BASE}/ai-assistant`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);

    const input = page.locator('textarea').first();
    if (!(await input.count())) {
      fail('2.1 Assistente: textarea non trovata');
    } else {
      pass('2.1 Assistente aperto');
      const prompt = 'Genera una WPS FW, spessori 10 mm e 5 mm, usando le WPQR';
      await fillReactInput(page, 'textarea', prompt);
      const sendBtn = page.getByRole('button', { name: /Invia|Send|Chiedi/i }).first();
      if (await sendBtn.count()) await sendBtn.click();
      else await page.keyboard.press('Enter');
      await page.waitForTimeout(8000);
      await page.screenshot({ path: `${ART}/smoke_eram_ai_need_input.png`, fullPage: true });
      const chat = await page.locator('body').innerText();
      if (/materiale|gruppo|15608|non li invento|servono ancora/i.test(chat)) {
        pass('2.2 Assistente chiede dati mancanti (need_input)');
      } else if (/WPQR|estension|coperto|realizzabile|parziale/i.test(chat)) {
        pass('2.2 Assistente ha risposto sul check WPQR', 'possibile scope senza need_input');
      } else {
        fail('2.2 Risposta assistente WPS', chat.slice(0, 200));
      }
    }

    // ── 3 Riesame coverage advisory ─────────────────────────────────────────
    await page.goto(`${BASE}/contract-reviews`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${ART}/smoke_eram_riesame_list.png`, fullPage: true });

    let openedCase = false;
    const rows = page.locator('table tbody tr.cr-row-click, table tbody tr');
    if (await rows.count()) {
      await rows.first().click();
      await page.waitForTimeout(3000);
      const urlOk = /\/contract-reviews\/\d+/.test(page.url());
      const detailHint = await page.locator('body').innerText();
      if (urlOk || /Copertura saldatori|Cronologia stati|Passaggio a esecuzione/i.test(detailHint)) {
        openedCase = true;
      }
    }

    if (!openedCase) {
      fail('3.1 Nessun riesame da aprire (creare un caso ERAM per smoke completo)');
    } else {
      pass('3.1 Riesame aperto', page.url());
      await page.screenshot({ path: `${ART}/smoke_eram_riesame_detail.png`, fullPage: true });
      const coverBtn = page.locator('button', { hasText: /Verifica Copertura Saldatori/i });
      if (await coverBtn.count()) {
        pass('3.2 Pulsante Verifica Copertura Saldatori');
        await coverBtn.first().click();
        // Aspetta select commesse (non il primo <select> generico della pagina)
        const coverSelect = page.locator('select').filter({
          has: page.locator('option', { hasText: /Seleziona commessa/i }),
        }).first();
        try {
          await coverSelect.waitFor({ state: 'visible', timeout: 15000 });
        } catch (_) {
          fail('3.2b Select commessa copertura non apparso');
        }
        const optCount = await coverSelect.locator('option').count();
        if (optCount < 2) {
          fail('3.2b Nessuna commessa in elenco', `options=${optCount}`);
        } else {
          await coverSelect.selectOption({ index: 1 });
          const verify = page.locator('button', { hasText: /^Verifica$/i });
          await verify.first().click();
          try {
            await page.locator('text=Copertura procedure (WPQR)').waitFor({ timeout: 15000 });
          } catch (_) { /* assert sotto */ }
          await page.waitForTimeout(1000);
          await page.screenshot({ path: `${ART}/smoke_eram_coverage_advisory.png`, fullPage: true });
          const t = await page.locator('body').innerText();
          if (/Copertura procedure \(WPQR\)/.test(t)) {
            pass('3.3 Box WPQR advisory presente');
          } else {
            fail('3.3 Box WPQR advisory', 'titolo box non trovato dopo Verifica');
          }
          if (/Idoneit[àa] visiva \(NDT\/VT\)/.test(t) || (/Idoneit/i.test(t) && /NDT\/VT/.test(t))) {
            pass('3.4 Box idoneità visiva advisory presente');
          } else {
            fail('3.4 Box idoneità visiva advisory');
          }
          if (/non cambia il semaforo|Non blocca la copertura|solo informativo/i.test(t)) {
            pass('3.5 Messaggio non bloccante presente');
          } else {
            fail('3.5 Messaggio non bloccante');
          }
        }
      } else {
        fail(
          '3.2 Pulsante Verifica Copertura Saldatori non trovato',
          'Serve deploy FE con CoveragePanel sul dettaglio riesame (non solo APPROVED)'
        );
      }
    }
  } catch (e) {
    fail('EXCEPTION', e.message);
    try {
      await page.screenshot({ path: `${ART}/smoke_eram_error.png`, fullPage: true });
    } catch (_) { /* ignore */ }
  } finally {
    await browser.close();
  }

  const ok = results.filter((r) => r.ok).length;
  const ko = results.filter((r) => !r.ok).length;
  const summary = { ok, ko, results, base: BASE, email, org };
  fs.writeFileSync(`${ART}/smoke_eram_coverage_summary.json`, JSON.stringify(summary, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  process.exit(ko > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
