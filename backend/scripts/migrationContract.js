/**
 * Contratto file migrazioni (gate L1).
 * Intestazione obbligatoria da NNN >= 169; companion verify/rollback se TYPE ≠ additive.
 * Lo storico (< 169) è grandfathered: non si riscrivono i file già in produzione.
 */
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.resolve(__dirname, '../../database/migrations');
const HEADER_FROM_NUMBER = 169;
const TYPE_VALUES = ['additive', 'transform', 'destructive'];
const BACKFILL_VALUES = ['none', 'SQL', 'Rielaborazioni'];

function isNumberedSql(filename) {
  return /^\d+[a-z]?_.*\.sql$/i.test(filename);
}

function isCompanionSql(filename) {
  return /^\d+[a-z]?_(verify|rollback)\.sql$/i.test(filename);
}

function isMainMigrationSql(filename) {
  return isNumberedSql(filename) && !isCompanionSql(filename);
}

function numericPrefix(filename) {
  const m = String(filename).match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : NaN;
}

function numberToken(filename) {
  const m = String(filename).match(/^(\d+[a-z]?)/i);
  return m ? m[1] : null;
}

function companionName(filename, kind) {
  const token = numberToken(filename);
  return token ? `${token}_${kind}.sql` : null;
}

function listSqlFilenames(dir = MIGRATIONS_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.sql'));
}

function listMainMigrationSql(dir = MIGRATIONS_DIR) {
  return listSqlFilenames(dir)
    .filter(isMainMigrationSql)
    .sort((a, b) => {
      const na = numericPrefix(a);
      const nb = numericPrefix(b);
      if (na !== nb) return na - nb;
      return a.localeCompare(b);
    });
}

function parseMigrationHeader(sqlText) {
  const lines = String(sqlText).split(/\r?\n/).slice(0, 80);
  const get = (key) => {
    const re = new RegExp(`^--\\s*${key}\\s*:\\s*(.*)$`, 'i');
    for (const line of lines) {
      const m = line.match(re);
      if (m) return m[1].trim();
    }
    return null;
  };
  return {
    type: get('TYPE'),
    backfill: get('BACKFILL'),
    verify: get('VERIFY'),
    rollback: get('ROLLBACK'),
  };
}

function checkMigrationContract({ filename, sqlText, siblingFiles }) {
  const n = numericPrefix(filename);
  if (!Number.isFinite(n) || n < HEADER_FROM_NUMBER) {
    return { ok: true, skipped: true, errors: [], header: null };
  }
  if (!isMainMigrationSql(filename)) {
    return { ok: true, skipped: true, errors: [], header: null };
  }

  const errors = [];
  const header = parseMigrationHeader(sqlText);

  if (!header.type) {
    errors.push('manca la riga -- TYPE: additive|transform|destructive');
  } else if (!TYPE_VALUES.includes(header.type)) {
    errors.push(`TYPE non valido "${header.type}" (atteso: ${TYPE_VALUES.join('|')})`);
  }

  if (!header.backfill) {
    errors.push('manca la riga -- BACKFILL: none|SQL|Rielaborazioni');
  } else if (!BACKFILL_VALUES.includes(header.backfill)) {
    errors.push(`BACKFILL non valido "${header.backfill}" (atteso: ${BACKFILL_VALUES.join('|')})`);
  }

  if (header.verify === null || header.verify === '') {
    errors.push('manca la riga -- VERIFY: (valore obbligatorio, anche "n/a" se additive)');
  }
  if (header.rollback === null || header.rollback === '') {
    errors.push('manca la riga -- ROLLBACK: (valore obbligatorio, anche "n/a" se additive)');
  }

  if (header.type && header.type !== 'additive') {
    const verifyName = companionName(filename, 'verify');
    const rollbackName = companionName(filename, 'rollback');
    const siblings = new Set(siblingFiles || []);
    if (!siblings.has(verifyName)) {
      errors.push(`TYPE ${header.type}: manca il file companion ${verifyName}`);
    }
    if (!siblings.has(rollbackName)) {
      errors.push(`TYPE ${header.type}: manca il file companion ${rollbackName}`);
    }
  }

  return { ok: errors.length === 0, skipped: false, errors, header };
}

function checkRepoMigrationContracts(dir = MIGRATIONS_DIR) {
  const files = listSqlFilenames(dir);
  const findings = [];
  for (const filename of files) {
    if (!isMainMigrationSql(filename)) continue;
    const sqlText = fs.readFileSync(path.join(dir, filename), 'utf8');
    const result = checkMigrationContract({
      filename,
      sqlText,
      siblingFiles: files,
    });
    if (!result.ok) {
      findings.push({ filename, errors: result.errors });
    }
  }
  return findings;
}

function splitSqlBatches(sqlText) {
  return String(sqlText)
    .replace(/^\uFEFF/, '')
    .split(/^\s*GO\s*$/gim)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function rowEsito(row) {
  if (!row || typeof row !== 'object') return null;
  const key = Object.keys(row).find((k) => k.toLowerCase() === 'esito');
  return key ? String(row[key]).trim() : null;
}

function collectVerifyFailures(recordsets) {
  const failures = [];
  for (const rs of recordsets || []) {
    for (const row of rs) {
      const esito = rowEsito(row);
      if (esito && esito.toUpperCase() === 'FAIL') {
        failures.push(row);
      }
    }
  }
  return failures;
}

module.exports = {
  MIGRATIONS_DIR,
  HEADER_FROM_NUMBER,
  TYPE_VALUES,
  BACKFILL_VALUES,
  isNumberedSql,
  isCompanionSql,
  isMainMigrationSql,
  numericPrefix,
  numberToken,
  companionName,
  listSqlFilenames,
  listMainMigrationSql,
  parseMigrationHeader,
  checkMigrationContract,
  checkRepoMigrationContracts,
  splitSqlBatches,
  rowEsito,
  collectVerifyFailures,
};
