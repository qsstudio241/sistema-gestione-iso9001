'use strict';
/*
 * Seed idempotente di norm_requirements da backend/data/norm_requirements_seed.json.
 *
 * Allinea il DB piattaforma all'ultima edizione digitalizzata in docs/Normative/
 * (Markdown → import-norms-from-markdown.js → questo seed JSON → VPS).
 *
 * NON tocca document_registry (norme di proprietà studio/azienda).
 *
 * Chiave logica: (standard_code, clause_ref, norm_version).
 * Se esiste una riga con codice SUPERATO (es. ISO_3834_2_2006) e stessa clause_ref,
 * la riga viene rinominata al codice nuovo (stesso id → SAL / gap matrix restano validi).
 *
 * Esecuzione VPS:
 *   scp seed JSON + questo script → /tmp/
 *   node /tmp/seed-norm-requirements-from-json-vps.js [/tmp/norm_requirements_seed.json]
 */

const path = require('path');
const fs = require('fs');

const BACKEND_ROOT = process.env.SGQ_BACKEND_ROOT || '/var/www/sgq-backend';

try {
  require(path.join(BACKEND_ROOT, 'node_modules', 'dotenv')).config({
    path: path.join(BACKEND_ROOT, '.env'),
  });
} catch (_) {
  /* env già presente */
}

const { query, closePool } = require(path.join(BACKEND_ROOT, 'src', 'config', 'database'));

/** Nuova edizione → codice precedente da promuovere / spegnere */
const SUPERSEDES = {
  ISO_3834_2_2021: 'ISO_3834_2_2006',
  ISO_3834_4_2021: 'ISO_3834_4_2006',
};

const SEED_PATH =
  process.env.SEED_PATH ||
  process.argv[2] ||
  path.join(BACKEND_ROOT, 'data', 'norm_requirements_seed.json');

function loadSeed() {
  if (!fs.existsSync(SEED_PATH)) {
    throw new Error(`Seed non trovato: ${SEED_PATH}`);
  }
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  if (!Array.isArray(seed)) {
    throw new Error('Seed non valido: atteso array di clausole');
  }
  return seed;
}

async function upsertClause(row) {
  const params = {
    sc: row.standard_code,
    cr: String(row.clause_ref),
    nv: row.norm_version || null,
    ct: row.clause_title || '',
    rt: row.requirement_text != null ? String(row.requirement_text) : '',
    src: row.source || 'local_file',
  };

  const same = await query(
    `SELECT id, requirement_text, clause_title, norm_version, is_current
     FROM norm_requirements
     WHERE standard_code = @sc AND clause_ref = @cr`,
    { sc: params.sc, cr: params.cr }
  );
  const hit = same.recordset && same.recordset[0];
  if (hit) {
    const changed =
      hit.requirement_text !== params.rt ||
      hit.clause_title !== params.ct ||
      String(hit.norm_version || '') !== String(params.nv || '') ||
      !hit.is_current;
    if (changed) {
      await query(
        `UPDATE norm_requirements
           SET clause_title = @ct, requirement_text = @rt, norm_version = @nv,
               source = @src, is_current = 1, last_synced_at = GETDATE()
         WHERE id = @id`,
        { ...params, id: hit.id }
      );
      return 'updated';
    }
    return 'unchanged';
  }

  const oldCode = SUPERSEDES[params.sc];
  if (oldCode) {
    const legacy = await query(
      `SELECT id FROM norm_requirements
       WHERE standard_code = @old AND clause_ref = @cr`,
      { old: oldCode, cr: params.cr }
    );
    const leg = legacy.recordset && legacy.recordset[0];
    if (leg) {
      await query(
        `UPDATE norm_requirements
           SET standard_code = @sc, clause_title = @ct, requirement_text = @rt,
               norm_version = @nv, source = @src, is_current = 1, last_synced_at = GETDATE()
         WHERE id = @id`,
        { ...params, id: leg.id }
      );
      return 'promoted';
    }
  }

  await query(
    `INSERT INTO norm_requirements
       (standard_code, clause_ref, clause_title, requirement_text,
        source, norm_version, is_current, last_synced_at)
     VALUES
       (@sc, @cr, @ct, @rt, @src, @nv, 1, GETDATE())`,
    params
  );
  return 'inserted';
}

async function retireSuperseded() {
  const stats = { retired: 0 };
  for (const [newer, older] of Object.entries(SUPERSEDES)) {
    const hasNewer = await query(
      `SELECT COUNT(*) AS n FROM norm_requirements WHERE standard_code = @sc AND is_current = 1`,
      { sc: newer }
    );
    if (!(hasNewer.recordset[0] && hasNewer.recordset[0].n > 0)) continue;

    const res = await query(
      `UPDATE norm_requirements
         SET is_current = 0, last_synced_at = GETDATE()
       WHERE standard_code = @old AND is_current = 1`,
      { old: older }
    );
    const n = (res.rowsAffected && res.rowsAffected[0]) || 0;
    stats.retired += n;
    if (n) console.log(`  retired ${n} rows ${older} (superseded by ${newer})`);
  }
  return stats;
}

async function main() {
  console.log('=== seed-norm-requirements-from-json-vps ===');
  console.log('Seed:', SEED_PATH);
  const seed = loadSeed();
  console.log('Clausole in seed:', seed.length);

  const stats = { inserted: 0, updated: 0, promoted: 0, unchanged: 0 };
  for (const row of seed) {
    if (!row.standard_code || row.clause_ref == null) {
      console.warn('  skip riga senza standard_code/clause_ref');
      continue;
    }
    const r = await upsertClause(row);
    stats[r] += 1;
  }

  const retired = await retireSuperseded();
  console.log('Stats:', JSON.stringify({ ...stats, ...retired }));

  const summary = await query(
    `SELECT standard_code, SUM(CASE WHEN is_current = 1 THEN 1 ELSE 0 END) AS current_n,
            SUM(CASE WHEN is_current = 0 THEN 1 ELSE 0 END) AS retired_n
     FROM norm_requirements
     WHERE standard_code LIKE 'ISO_3834%' OR standard_code LIKE 'ISO_9001%'
        OR standard_code LIKE 'ISO_14001%' OR standard_code LIKE 'ISO_45001%'
     GROUP BY standard_code
     ORDER BY standard_code`
  );
  console.log('Summary is_current:');
  for (const r of summary.recordset) {
    console.log(`  ${r.standard_code}: current=${r.current_n} retired=${r.retired_n}`);
  }

  await closePool();
  console.log('OK');
}

main().catch(async (e) => {
  console.error('ERRORE:', e.message);
  try {
    await closePool();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
