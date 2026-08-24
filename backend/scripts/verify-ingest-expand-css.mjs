/**
 * Verifica CSS «Ingrandisci affiancato»: con classe expanded il dialog
 * deve diventare full viewport (non restare a min(1180px)/min(920px)).
 * Apre un HTML minimale che carica i CSS reali del repo.
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const APP = join(ROOT, 'app/src/components');

const CSS_FILES = {
  '/IngestDialogShell.css': join(APP, 'IngestDialogShell.css'),
  '/IngestReviewDialog.css': join(APP, 'IngestReviewDialog.css'),
  '/ReprocessQueueBanner.css': join(APP, 'ReprocessQueueBanner.css'),
};

const HTML = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<link rel="stylesheet" href="/IngestDialogShell.css"/>
<link rel="stylesheet" href="/IngestReviewDialog.css"/>
<link rel="stylesheet" href="/ReprocessQueueBanner.css"/>
<style>html,body{margin:0;height:100%;}</style>
</head><body>
<div id="overlay" class="ingest-dialog-shell__overlay ingest-review__overlay">
  <div id="dialog" class="ingest-dialog-shell__dialog ingest-review__dialog">
    <header class="ingest-dialog-shell__header"><button id="btn" type="button">Ingrandisci affiancato</button></header>
        <div class="ingest-dialog-shell__layout" style="grid-template-columns: 1fr 6px 1fr; flex:1; min-height:0">
      <aside class="ingest-dialog-shell__preview-pane" style="background:#e2e8f0;min-height:200px">preview</aside>
      <div class="ingest-dialog-shell__resizer"></div>
      <div class="ingest-dialog-shell__content-pane ingest-review__form-pane" style="padding:12px">form campi</div>
    </div>
  </div>
</div>
<script>
document.getElementById('btn').onclick = () => {
  const o = document.getElementById('overlay');
  const d = document.getElementById('dialog');
  const on = o.classList.toggle('ingest-dialog-shell__overlay--expanded');
  o.classList.toggle('ingest-review__overlay--expanded', on);
  d.classList.toggle('ingest-dialog-shell__dialog--expanded', on);
  d.classList.toggle('ingest-review__dialog--expanded', on);
  document.getElementById('btn').textContent = on ? 'Riduci' : 'Ingrandisci affiancato';
};
</script>
</body></html>`;

const server = createServer(async (req, res) => {
  try {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(HTML);
      return;
    }
    if (CSS_FILES[req.url]) {
      const css = await readFile(CSS_FILES[req.url], 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
      res.end(css);
      return;
    }
    res.writeHead(404); res.end('no');
  } catch (e) {
    res.writeHead(500); res.end(String(e));
  }
});

await mkdir('/opt/cursor/artifacts', { recursive: true });
await new Promise((r) => server.listen(8765, r));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle' });

const before = await page.evaluate(() => {
  const d = document.getElementById('dialog');
  const cs = getComputedStyle(d);
  return { width: cs.width, maxHeight: cs.maxHeight, rectW: d.getBoundingClientRect().width };
});
await page.screenshot({ path: '/opt/cursor/artifacts/qualifiche_expand_before.png' });

await page.click('#btn');
await page.waitForTimeout(200);

const after = await page.evaluate(() => {
  const d = document.getElementById('dialog');
  const o = document.getElementById('overlay');
  const cs = getComputedStyle(d);
  return {
    width: cs.width,
    maxHeight: cs.maxHeight,
    height: cs.height,
    rectW: d.getBoundingClientRect().width,
    rectH: d.getBoundingClientRect().height,
    overlayExpanded: o.classList.contains('ingest-dialog-shell__overlay--expanded'),
    dialogExpanded: d.classList.contains('ingest-review__dialog--expanded'),
  };
});
await page.screenshot({ path: '/opt/cursor/artifacts/qualifiche_expand_after.png' });

console.log('BEFORE', JSON.stringify(before));
console.log('AFTER', JSON.stringify(after));

const ok =
  after.overlayExpanded &&
  after.dialogExpanded &&
  after.maxHeight === 'none' &&
  after.rectH >= 880 &&
  before.maxHeight !== 'none' &&
  parseFloat(before.width) <= 1180 &&
  parseFloat(after.width) > parseFloat(before.width);

console.log(ok ? 'PASS expand fullscreen' : 'FAIL expand still constrained');
await browser.close();
server.close();
process.exit(ok ? 0 : 1);
