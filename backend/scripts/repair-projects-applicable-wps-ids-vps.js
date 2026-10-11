/**
 * Riparazione mirata di projects.applicable_wps_ids (JSON annidato / doppiamente serializzato).
 *
 * Causa: il client inviava JSON.stringify(array) e il backend lo avvolgeva di nuovo in un array,
 * annidando un livello a ogni salvataggio. Il fix applicativo (helper `applicableWpsIds`) legge già
 * i valori corrotti; questo script riscrive la colonna nel formato canonico JSON array di interi ("[1,2]").
 *
 * DA ESEGUIRE SOLO DOPO IL SI ESPLICITO DELL'UTENTE, previo backup COPY_ONLY del DB.
 * Default = DRY-RUN (solo SELECT). Scrive solo con --apply.
 *
 * Parametri (almeno uno tra --project-code e --organization-id):
 *   --project-code <codice>      filtra per projects.project_code
 *   --organization-id <n>        filtra per projects.organization_id
 *   --apply                      esegue l'UPDATE (una transazione, rollback se @@ROWCOUNT <> 1)
 *
 * Uso sul VPS (credenziali da .env del backend; il backend con src/utils/applicableWpsIds.js deve essere già deployato):
 *   scp -P 1122 backend/scripts/repair-projects-applicable-wps-ids-vps.js \
 *     spascarella@sistemi.fr-busato.it:/tmp/
 *   # 1) dry-run
 *   ssh -p 1122 spascarella@sistemi.fr-busato.it \
 *     'node /tmp/repair-projects-applicable-wps-ids-vps.js --organization-id <ORG_ID> --project-code "<CODICE>"'
 *   # 2) apply (solo dopo il si dell'utente e il backup COPY_ONLY)
 *   ssh -p 1122 spascarella@sistemi.fr-busato.it \
 *     'node /tmp/repair-projects-applicable-wps-ids-vps.js --organization-id <ORG_ID> --project-code "<CODICE>" --apply'
 *
 * Test DB: SGQ_MIGRATION_TARGET=test node /tmp/repair-projects-applicable-wps-ids-vps.js ...
 */
'use strict';

const RAW_PREVIEW_MAX = 80;

const SELECT_SQL = `
  SELECT id, organization_id, applicable_wps_ids
  FROM projects
  WHERE (@project_code IS NULL OR project_code = @project_code)
    AND (@organization_id IS NULL OR organization_id = @organization_id)
  ORDER BY organization_id, id
`;

const SELECT_ONE_SQL = `
  SELECT id, organization_id, applicable_wps_ids
  FROM projects
  WHERE id = @id AND organization_id = @organization_id
`;

const UPDATE_SQL = `
  UPDATE projects
  SET applicable_wps_ids = @canonical
  WHERE id = @id AND organization_id = @organization_id
    AND applicable_wps_ids = @raw;
  SELECT @@ROWCOUNT AS affected;
`;

function parseArgs(argv) {
  const out = { apply: false, projectCode: null, organizationId: null, errors: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') {
      out.apply = true;
    } else if (arg === '--project-code') {
      out.projectCode = argv[i + 1] ?? null;
      i += 1;
      if (!out.projectCode) out.errors.push('--project-code richiede un valore');
    } else if (arg === '--organization-id') {
      const n = Number(argv[i + 1]);
      i += 1;
      if (Number.isSafeInteger(n) && n > 0) out.organizationId = n;
      else out.errors.push('--organization-id deve essere un intero positivo');
    } else {
      out.errors.push(`parametro sconosciuto: ${arg}`);
    }
  }
  if (!out.errors.length && out.projectCode === null && out.organizationId === null) {
    out.errors.push('serve almeno uno tra --project-code e --organization-id');
  }
  return out;
}

function previewRaw(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw);
  return text.length > RAW_PREVIEW_MAX ? `${text.slice(0, RAW_PREVIEW_MAX)}...` : text;
}

/**
 * Logica pura: per ogni riga calcola valore normalizzato e se serve l'UPDATE.
 * Valori null/vuoti non vengono toccati (niente da riparare).
 */
function buildPlan(rows, helpers) {
  const { normalizeApplicableWpsIds, serializeApplicableWpsIds } = helpers;
  return rows.map((row) => {
    const raw = row.applicable_wps_ids;
    const rawText = raw === null || raw === undefined ? null : String(raw);
    const blank = rawText === null || rawText.trim() === '';
    const ids = blank ? [] : normalizeApplicableWpsIds(rawText);
    const canonical = blank ? rawText : serializeApplicableWpsIds(rawText);
    const changed = !blank && canonical !== rawText;
    return {
      id: row.id,
      organization_id: row.organization_id,
      raw: rawText,
      raw_length: rawText === null ? 0 : rawText.length,
      raw_preview: previewRaw(rawText),
      canonical,
      ids_count: ids.length,
      changed,
      loses_unreadable_data: changed && ids.length === 0,
    };
  });
}

/**
 * Esegue gli UPDATE in un'unica transazione. Qualsiasi @@ROWCOUNT <> 1 -> rollback totale.
 * `deps.beginTransaction()` deve restituire { query(sql, params), commit(), rollback() }.
 */
async function applyPlan(plan, deps) {
  const toUpdate = plan.filter((item) => item.changed);
  if (!toUpdate.length) return { updated: 0 };

  const tx = await deps.beginTransaction();
  try {
    for (const item of toUpdate) {
      const result = await tx.query(UPDATE_SQL, {
        id: item.id,
        organization_id: item.organization_id,
        canonical: item.canonical,
        raw: item.raw,
      });
      const affected = result?.recordset?.[0]?.affected;
      if (affected !== 1) {
        throw new Error(`UPDATE projects id=${item.id}: @@ROWCOUNT=${affected} (atteso 1)`);
      }
    }
    await tx.commit();
    return { updated: toUpdate.length };
  } catch (err) {
    try { await tx.rollback(); } catch (_) { /* transazione già chiusa */ }
    throw err;
  }
}

function describeItem(item) {
  return {
    id: item.id,
    organization_id: item.organization_id,
    raw_length: item.raw_length,
    raw_preview: item.raw_preview,
    canonical: item.canonical,
    ids_count: item.ids_count,
    changed: item.changed,
    loses_unreadable_data: item.loses_unreadable_data,
  };
}

/**
 * @param {object} opts { apply, projectCode, organizationId }
 * @param {object} deps { helpers, selectRows(filters), selectOne(id, orgId), beginTransaction(), log }
 */
async function runRepair(opts, deps) {
  const log = deps.log || console.log;
  const rows = await deps.selectRows({
    project_code: opts.projectCode,
    organization_id: opts.organizationId,
  });
  const plan = buildPlan(rows, deps.helpers);

  log(`Modalita: ${opts.apply ? 'APPLY' : 'DRY-RUN'} - righe trovate: ${plan.length}`);
  plan.forEach((item) => log('PRIMA', JSON.stringify(describeItem(item))));

  const changed = plan.filter((item) => item.changed);
  log(`Da riparare: ${changed.length}`);
  changed.filter((i) => i.loses_unreadable_data).forEach((i) => {
    log(`ATTENZIONE id=${i.id}: nessun id WPS leggibile, la colonna diventera "[]"`);
  });

  if (!opts.apply) {
    log('DRY-RUN: nessuna scrittura. Rilanciare con --apply solo dopo il si dell\'utente e il backup COPY_ONLY.');
    return { plan, updated: 0, after: [] };
  }

  const { updated } = await applyPlan(plan, deps);
  log(`Righe aggiornate: ${updated}`);

  const after = [];
  for (const item of changed) {
    const rowsAfter = await deps.selectOne(item.id, item.organization_id);
    const [planned] = buildPlan(rowsAfter, deps.helpers);
    after.push(planned);
    log('DOPO', JSON.stringify(describeItem(planned)));
  }
  return { plan, updated, after };
}

function resolveHelpers(backendRoot) {
  try {
    return require('../src/utils/applicableWpsIds');
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') throw err;
    return require(`${backendRoot}/src/utils/applicableWpsIds`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.errors.length) {
    console.error(opts.errors.join('\n'));
    console.error('Uso: node repair-projects-applicable-wps-ids-vps.js [--project-code <c>] [--organization-id <n>] [--apply]');
    process.exit(2);
  }

  const isTest = String(process.env.SGQ_MIGRATION_TARGET || 'prod').toLowerCase() === 'test';
  const backendRoot = isTest ? '/var/www/sgq-backend-test' : '/var/www/sgq-backend';
  const envFile = isTest ? `${backendRoot}/.env.test` : `${backendRoot}/.env`;

  require(`${backendRoot}/node_modules/dotenv`).config({ path: envFile });
  const helpers = resolveHelpers(backendRoot);
  const { sql, getPool } = require(`${backendRoot}/src/config/database`);
  const pool = await getPool();

  const bind = (request, params) => {
    for (const [name, value] of Object.entries(params)) {
      if (name === 'project_code') request.input(name, sql.NVarChar(100), value);
      else if (name === 'canonical' || name === 'raw') request.input(name, sql.NVarChar(sql.MAX), value);
      else request.input(name, sql.Int, value);
    }
    return request;
  };

  const deps = {
    helpers,
    selectRows: async (filters) => (await bind(pool.request(), filters).query(SELECT_SQL)).recordset,
    selectOne: async (id, organizationId) =>
      (await bind(pool.request(), { id, organization_id: organizationId }).query(SELECT_ONE_SQL)).recordset,
    beginTransaction: async () => {
      const tx = new sql.Transaction(pool);
      await tx.begin();
      return {
        query: (text, params) => bind(tx.request(), params).query(text),
        commit: () => tx.commit(),
        rollback: () => tx.rollback(),
      };
    },
  };

  try {
    await runRepair(opts, deps);
    process.exit(0);
  } catch (err) {
    console.error('ERRORE:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  SELECT_SQL,
  UPDATE_SQL,
  parseArgs,
  buildPlan,
  applyPlan,
  runRepair,
};
