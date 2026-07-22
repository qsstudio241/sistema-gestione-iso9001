'use strict';
/*
 * Ingestione idempotente del testo di articoli di legge italiani pertinenti a
 * un sistema di gestione (SGSL/SGA) nella tabella norm_requirements, piu'
 * popolamento della matrice norma<->legge (colonna linked_legislation sulle
 * clausole ISO).
 *
 * Fonte: Normattiva.it (fonte istituzionale pubblica). I testi degli atti
 * ufficiali dello Stato NON sono coperti da copyright (art. 5 L. 633/1941),
 * quindi il testo integrale e' ingestabile legalmente. Ogni riga traccia
 * source='normattiva' e source_url (permalink URN dell'articolo).
 *
 * Il seed (backend/data/legislation_seed.json) e' stato raccolto una-tantum
 * dalle pagine Normattiva rese con rendering JS (headless browser), perche' la
 * pagina statica del permalink non contiene il testo (SPA). Vedi
 * docs/GUIDA_CONSOLIDATA.md.
 *
 * Idempotenza: chiave logica (standard_code, clause_ref, norm_version). La
 * riesecuzione NON duplica righe; aggiorna solo se il contenuto e' cambiato.
 *
 * Esecuzione (VPS):
 *   node ingest-legislation-normattiva-vps.js [seedPath]
 *   (default seedPath: <backendRoot>/data/legislation_seed.json)
 */

const path = require('path');
const fs = require('fs');

const BACKEND_ROOT = process.env.SGQ_BACKEND_ROOT || '/var/www/sgq-backend';

try {
  require(path.join(BACKEND_ROOT, 'node_modules', 'dotenv')).config({
    path: path.join(BACKEND_ROOT, '.env'),
  });
} catch (_) {
  // dotenv opzionale: su alcuni ambienti le variabili sono gia' presenti.
}

const { query, closePool } = require(path.join(BACKEND_ROOT, 'src', 'config', 'database'));

const SEED_PATH =
  process.env.SEED_PATH ||
  process.argv[2] ||
  path.join(BACKEND_ROOT, 'data', 'legislation_seed.json');

function loadSeed() {
  if (!fs.existsSync(SEED_PATH)) {
    throw new Error(`Seed non trovato: ${SEED_PATH}`);
  }
  const raw = fs.readFileSync(SEED_PATH, 'utf8');
  const seed = JSON.parse(raw);
  if (!seed || !Array.isArray(seed.decrees)) {
    throw new Error('Seed non valido: manca "decrees".');
  }
  return seed;
}

async function upsertArticle(decree, art) {
  const params = {
    sc: decree.standard_code,
    cr: art.clause_ref,
    nv: decree.norm_version || 'vigente',
    ct: art.clause_title || null,
    rt: art.requirement_text,
    ap: art.applicability || null,
    src: art.source || 'normattiva',
    url: art.source_url || null,
  };

  const existing = await query(
    `SELECT requirement_text, source_url, clause_title, applicability
     FROM norm_requirements
     WHERE standard_code = @sc AND clause_ref = @cr AND norm_version = @nv`,
    params
  );
  const row = existing.recordset && existing.recordset[0];

  if (!row) {
    await query(
      `INSERT INTO norm_requirements
         (standard_code, clause_ref, clause_title, requirement_text, applicability,
          source, source_url, norm_version, is_current, last_synced_at)
       VALUES
         (@sc, @cr, @ct, @rt, @ap, @src, @url, @nv, 1, GETDATE())`,
      params
    );
    return 'inserted';
  }

  const changed =
    row.requirement_text !== params.rt ||
    row.source_url !== params.url ||
    row.clause_title !== params.ct ||
    row.applicability !== params.ap;

  if (changed) {
    await query(
      `UPDATE norm_requirements
         SET clause_title = @ct, requirement_text = @rt, applicability = @ap,
             source = @src, source_url = @url, is_current = 1, last_synced_at = GETDATE()
       WHERE standard_code = @sc AND clause_ref = @cr AND norm_version = @nv`,
      params
    );
    return 'updated';
  }

  return 'unchanged';
}

async function applyMatrix(matrix) {
  const stats = { updated: 0, missing: [] };
  for (const m of matrix || []) {
    const res = await query(
      `UPDATE norm_requirements
         SET linked_legislation = @leg, last_synced_at = last_synced_at
       WHERE standard_code = @sc AND clause_ref = @cr AND is_current = 1`,
      { leg: m.legislation, sc: m.iso_standard_code, cr: m.iso_clause_ref }
    );
    const affected = res.rowsAffected && res.rowsAffected[0];
    if (affected > 0) stats.updated += affected;
    else stats.missing.push(`${m.iso_standard_code} ${m.iso_clause_ref}`);
  }
  return stats;
}

async function main() {
  console.log('[ingest-legislation] seed:', SEED_PATH);
  const seed = loadSeed();

  const totals = { inserted: 0, updated: 0, unchanged: 0, byDecree: {} };

  for (const decree of seed.decrees) {
    const dstat = { inserted: 0, updated: 0, unchanged: 0 };
    for (const art of decree.articles || []) {
      const outcome = await upsertArticle(decree, art);
      dstat[outcome] += 1;
      totals[outcome] += 1;
    }
    totals.byDecree[decree.standard_code] = dstat;
    console.log(
      `[ingest-legislation] ${decree.standard_code}: ` +
        `inseriti=${dstat.inserted} aggiornati=${dstat.updated} invariati=${dstat.unchanged} ` +
        `(articoli seed=${(decree.articles || []).length})`
    );
  }

  const matrixStats = await applyMatrix(seed.matrix);
  console.log(
    `[ingest-legislation] matrice linked_legislation: righe aggiornate=${matrixStats.updated}` +
      (matrixStats.missing.length ? ` | clausole ISO non trovate: ${matrixStats.missing.join(', ')}` : '')
  );

  // Spot-check: conta le righe legge presenti e mostra un campione verificabile.
  for (const decree of seed.decrees) {
    const cnt = await query(
      `SELECT COUNT(*) AS n FROM norm_requirements WHERE standard_code = @sc AND is_current = 1`,
      { sc: decree.standard_code }
    );
    const sample = await query(
      `SELECT TOP 1 clause_ref, clause_title, LEN(requirement_text) AS text_len, source, source_url
       FROM norm_requirements WHERE standard_code = @sc AND is_current = 1 ORDER BY clause_ref`,
      { sc: decree.standard_code }
    );
    console.log(
      `[ingest-legislation] SPOT-CHECK ${decree.standard_code}: righe in DB=${cnt.recordset[0].n}`,
      JSON.stringify(sample.recordset[0])
    );
  }

  console.log(
    `[ingest-legislation] TOTALE: inseriti=${totals.inserted} aggiornati=${totals.updated} invariati=${totals.unchanged}`
  );
  console.log('[ingest-legislation] OK');
}

main()
  .catch((err) => {
    console.error('[ingest-legislation] ERRORE:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
    process.exit(process.exitCode || 0);
  });
