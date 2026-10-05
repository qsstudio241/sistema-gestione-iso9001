/**
 * @jest-environment node
 *
 * Gate L1: le NUOVE migrazioni (>= 169) devono dichiarare TYPE/BACKFILL/VERIFY/ROLLBACK.
 * Se TYPE ≠ additive servono NNN_verify.sql e NNN_rollback.sql.
 * Lo storico resta grandfathered (nessuna riscrittura dei file già in produzione).
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  HEADER_FROM_NUMBER,
  MIGRATIONS_DIR,
  isCompanionSql,
  isMainMigrationSql,
  listMainMigrationSql,
  numericPrefix,
  selectForEmptyDbApply,
  planEmptyDbApply,
  parseMigrationHeader,
  checkMigrationContract,
  checkRepoMigrationContracts,
  splitSqlBatches,
  collectVerifyFailures,
} = require('./migrationContract');

const ADDITIVE_HEADER = [
  '-- TYPE: additive',
  '-- BACKFILL: none',
  '-- VERIFY: n/a (solo schema, nessuna riorganizzazione dati)',
  '-- ROLLBACK: n/a (drop solo in migrazione di cleanup successiva)',
  '',
  'SELECT 1;',
].join('\n');

const TRANSFORM_HEADER = [
  '-- TYPE: transform',
  '-- BACKFILL: SQL',
  '-- VERIFY: 170_verify.sql',
  '-- ROLLBACK: 170_rollback.sql',
  '',
  'SELECT 1;',
].join('\n');

function writeFixture(dir, filename, body) {
  fs.writeFileSync(path.join(dir, filename), body, 'utf8');
}

describe('contratto intestazione migrazioni', () => {
  it(`sul repo reale, ogni main migration >= ${HEADER_FROM_NUMBER} ha intestazione valida`, () => {
    const findings = checkRepoMigrationContracts(MIGRATIONS_DIR);
    expect(findings).toEqual([]);
  });

  it('i template in database/migrations/ hanno le quattro righe obbligatorie', () => {
    const templates = [
      '_TEMPLATE_additive.sql',
      '_TEMPLATE_transform.sql',
    ];
    for (const name of templates) {
      const full = path.join(MIGRATIONS_DIR, name);
      expect(fs.existsSync(full)).toBe(true);
      const header = parseMigrationHeader(fs.readFileSync(full, 'utf8'));
      expect(header.type).toBeTruthy();
      expect(header.backfill).toBeTruthy();
      expect(header.verify).toBeTruthy();
      expect(header.rollback).toBeTruthy();
    }
    expect(fs.existsSync(path.join(MIGRATIONS_DIR, '_TEMPLATE_NNN_verify.sql'))).toBe(true);
    expect(fs.existsSync(path.join(MIGRATIONS_DIR, '_TEMPLATE_NNN_rollback.sql'))).toBe(true);
  });

  it('grandfathering: file < 169 senza intestazione NON fallisce', () => {
    const result = checkMigrationContract({
      filename: '168_old_style.sql',
      sqlText: '-- nessuna intestazione\nALTER TABLE t ADD c INT NULL;',
      siblingFiles: ['168_old_style.sql'],
    });
    expect(result.skipped).toBe(true);
    expect(result.ok).toBe(true);
  });

  it('169+ senza intestazione fallisce', () => {
    const result = checkMigrationContract({
      filename: '169_new_col.sql',
      sqlText: 'ALTER TABLE t ADD c INT NULL;',
      siblingFiles: ['169_new_col.sql'],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/TYPE/);
    expect(result.errors.join(' ')).toMatch(/BACKFILL/);
    expect(result.errors.join(' ')).toMatch(/VERIFY/);
    expect(result.errors.join(' ')).toMatch(/ROLLBACK/);
  });

  it('additive con intestazione completa passa senza companion', () => {
    const result = checkMigrationContract({
      filename: '169_new_col.sql',
      sqlText: ADDITIVE_HEADER,
      siblingFiles: ['169_new_col.sql'],
    });
    expect(result).toMatchObject({ ok: true, skipped: false });
  });

  it('transform senza NNN_verify.sql / NNN_rollback.sql fallisce', () => {
    const result = checkMigrationContract({
      filename: '170_copy_col.sql',
      sqlText: TRANSFORM_HEADER,
      siblingFiles: ['170_copy_col.sql'],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('170_verify.sql'))).toBe(true);
    expect(result.errors.some((e) => e.includes('170_rollback.sql'))).toBe(true);
  });

  it('transform con companion verify+rollback passa', () => {
    const result = checkMigrationContract({
      filename: '170_copy_col.sql',
      sqlText: TRANSFORM_HEADER,
      siblingFiles: ['170_copy_col.sql', '170_verify.sql', '170_rollback.sql'],
    });
    expect(result.ok).toBe(true);
  });

  it('TYPE o BACKFILL fuori elenco chiuso falliscono', () => {
    const result = checkMigrationContract({
      filename: '171_bad.sql',
      sqlText: [
        '-- TYPE: maybe',
        '-- BACKFILL: script',
        '-- VERIFY: n/a',
        '-- ROLLBACK: n/a',
        'SELECT 1;',
      ].join('\n'),
      siblingFiles: ['171_bad.sql'],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/TYPE non valido/);
    expect(result.errors.join(' ')).toMatch(/BACKFILL non valido/);
  });

  it('in una cartella temporanea, il checker intercetta un 169 nudo', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgq-mig-contract-'));
    try {
      writeFixture(dir, '042_old.sql', 'SELECT 1;');
      writeFixture(dir, '169_naked.sql', 'ALTER TABLE t ADD c INT NULL;');
      const findings = checkRepoMigrationContracts(dir);
      expect(findings).toHaveLength(1);
      expect(findings[0].filename).toBe('169_naked.sql');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('split GO e esito FAIL dei verify sono leggibili dal runner CI', () => {
    const batches = splitSqlBatches('SELECT 1;\nGO\nSELECT 2;\nGO\n');
    expect(batches).toHaveLength(2);
    const failures = collectVerifyFailures([
      [{ esito: 'PASS', orfani: 0 }],
      [{ Esito: 'FAIL', orfani: 2 }],
    ]);
    expect(failures).toHaveLength(1);
    expect(failures[0].orfani).toBe(2);
  });

  it('il seed CI è anonimo (niente dati di produzione)', () => {
    const seed = fs.readFileSync(
      path.join(MIGRATIONS_DIR, 'ci/seed_anonymous.sql'),
      'utf8'
    );
    expect(seed).toMatch(/CI Demo Srl/);
    expect(seed).toMatch(/example\.test/);
    expect(seed.toLowerCase()).not.toMatch(/al\.project|qsstudio|fr-busato|systemgest/);
  });

  it('NNN_verify.sql e NNN_rollback.sql non sono migrazioni principali', () => {
    expect(isCompanionSql('169_verify.sql')).toBe(true);
    expect(isCompanionSql('169_rollback.sql')).toBe(true);
    expect(isMainMigrationSql('169_verify.sql')).toBe(false);
    expect(isMainMigrationSql('169_new_col.sql')).toBe(true);
    const mains = listMainMigrationSql(MIGRATIONS_DIR);
    expect(mains.every((f) => !isCompanionSql(f))).toBe(true);
  });

  it('apply-on-empty salta lo storico < 169 e tiene main + verify da 169', () => {
    const sel = selectForEmptyDbApply([
      '003_align_schema_backend.sql',
      '168_qualifications_test_validity_9606.sql',
      '169_new_col.sql',
      '169_verify.sql',
      '169_rollback.sql',
      '170_other.sql',
      '168_verify.sql',
      'seed.sql',
    ]);
    expect(sel.fromNumber).toBe(HEADER_FROM_NUMBER);
    expect(sel.skipped).toEqual([
      '003_align_schema_backend.sql',
      '168_qualifications_test_validity_9606.sql',
    ]);
    expect(sel.apply).toEqual(['169_new_col.sql', '170_other.sql']);
    expect(sel.verifies).toEqual(['169_verify.sql']);
    expect(sel.verifies).not.toContain('168_verify.sql');
  });

  it('sul repo reale, apply-on-empty non include main < 169', () => {
    const sel = selectForEmptyDbApply(
      fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.toLowerCase().endsWith('.sql'))
    );
    expect(sel.skipped.length).toBeGreaterThan(0);
    expect(sel.skipped.every((f) => numericPrefix(f) < HEADER_FROM_NUMBER)).toBe(true);
    expect(sel.apply.every((f) => numericPrefix(f) >= HEADER_FROM_NUMBER)).toBe(true);
    expect(sel.verifies.every((f) => numericPrefix(f) >= HEADER_FROM_NUMBER)).toBe(true);
    expect(sel.apply.every((f) => isMainMigrationSql(f))).toBe(true);
  });

  it('senza 169+ non si eseguono seed né verify (solo gap pre-169)', () => {
    const emptyModern = selectForEmptyDbApply([
      '003_align_schema_backend.sql',
      '168_qualifications_test_validity_9606.sql',
      '168_verify.sql',
    ]);
    expect(emptyModern.apply).toEqual([]);
    expect(planEmptyDbApply(emptyModern)).toEqual({
      apply: false,
      seed: false,
      verify: false,
    });
    const withModern = selectForEmptyDbApply(['169_new_col.sql']);
    expect(planEmptyDbApply(withModern)).toEqual({
      apply: true,
      seed: true,
      verify: true,
    });
  });

  it('lo script apply-migrations-ci esce 0 senza SQL se il repo non ha 169+', () => {
    const script = path.join(__dirname, 'apply-migrations-ci.js');
    const env = { ...process.env };
    delete env.DB_PASSWORD;
    const r = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      env,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/skip apply, seed e verify/);
    expect(r.stdout).toMatch(/COMPLETATO/);
    expect(r.stderr || '').not.toMatch(/Invalid object name/);
  });
});
