/**
 * fix-tenant-isolation-vps.js
 * Fix isolamento multi-tenant: corregge organization_id in
 * document_registry e knowledge_chunks dove è stato impostato
 * con l'org del superadmin invece dell'org corretta dell'azienda.
 *
 * Ref: docs/reference/DB_TENANT_ISOLATION_REPORT_20260629.md
 *
 * ATTENZIONE: script distruttivo — verificare sempre con --dry-run prima
 *   node /tmp/fix-tenant-isolation-vps.js --dry-run
 *   node /tmp/fix-tenant-isolation-vps.js --apply
 *
 * Eseguire sul VPS:
 *   scp -i /tmp/sgq_key -P 1122 ... fix-tenant-isolation-vps.js spascarella@busato.selfip.com:/tmp/
 *   ssh ... "node /tmp/fix-tenant-isolation-vps.js --dry-run"   # prima
 *   ssh ... "node /tmp/fix-tenant-isolation-vps.js --apply"     # poi (con conferma)
 */
'use strict';

require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const mssql = require('/var/www/sgq-backend/node_modules/mssql');

const DB_CONFIG = {
    server: '127.0.0.1', port: 11043, database: 'SGQ_ISO9001',
    user: 'pascarella', password: '#Gestione2025@',
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true,
               connectTimeout: 30000, requestTimeout: 120000 },
};

const DRY_RUN = !process.argv.includes('--apply');

async function main() {
    if (DRY_RUN) {
        console.log('[DRY-RUN] Modalità sola lettura — usa --apply per applicare i fix');
    } else {
        console.log('[APPLY] Modalità scrittura — applico i fix in produzione');
    }

    const pool = await mssql.connect(DB_CONFIG);

    // ─────────────────────────────────────────────────────────────────────────
    // T-1: Correggi document_registry.organization_id
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- T-1: document_registry.organization_id ---');

    const drBefore = await pool.request().query(`
        SELECT dr.organization_id AS wrong_org,
               ao.organization_id AS correct_org,
               COUNT(*) AS cnt
        FROM document_registry dr
        JOIN companies c ON c.id = dr.company_id
        JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
        WHERE dr.company_id IS NOT NULL
          AND dr.organization_id <> ao.organization_id
        GROUP BY dr.organization_id, ao.organization_id
    `);
    console.log('[T-1] Distribuzione prima del fix:');
    drBefore.recordset.forEach(r => console.log(`       org_errata=${r.wrong_org} → org_corretta=${r.correct_org}: ${r.cnt} record`));
    const totalDr = drBefore.recordset.reduce((s, r) => s + r.cnt, 0);
    console.log(`[T-1] Totale righe da correggere: ${totalDr}`);

    if (!DRY_RUN && totalDr > 0) {
        const res = await pool.request().query(`
            UPDATE dr
            SET dr.organization_id = ao.organization_id
            FROM document_registry dr
            JOIN companies c ON c.id = dr.company_id
            JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE dr.company_id IS NOT NULL
              AND dr.organization_id <> ao.organization_id
        `);
        console.log(`[T-1] Aggiornate: ${res.rowsAffected[0]} righe`);

        // Verifica
        const drAfter = await pool.request().query(`
            SELECT COUNT(*) AS remaining
            FROM document_registry dr
            JOIN companies c ON c.id = dr.company_id
            JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE dr.company_id IS NOT NULL
              AND dr.organization_id <> ao.organization_id
        `);
        const rem = drAfter.recordset[0].remaining;
        console.log(rem === 0 ? '[T-1] ✅ Fix completato — 0 righe anomale' : `[T-1] ⚠️  Ancora ${rem} righe anomale dopo il fix`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // T-2: Correggi knowledge_chunks.organization_id
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- T-2: knowledge_chunks.organization_id ---');

    const kcBefore = await pool.request().query(`
        SELECT kc.organization_id AS wrong_org,
               ao.organization_id AS correct_org,
               COUNT(*) AS cnt
        FROM knowledge_chunks kc
        JOIN companies c ON c.id = kc.company_id
        JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
        WHERE kc.company_id IS NOT NULL
          AND kc.organization_id <> ao.organization_id
        GROUP BY kc.organization_id, ao.organization_id
    `);
    console.log('[T-2] Distribuzione prima del fix:');
    kcBefore.recordset.forEach(r => console.log(`       org_errata=${r.wrong_org} → org_corretta=${r.correct_org}: ${r.cnt} chunk`));
    const totalKc = kcBefore.recordset.reduce((s, r) => s + r.cnt, 0);
    console.log(`[T-2] Totale chunk da correggere: ${totalKc}`);

    if (!DRY_RUN && totalKc > 0) {
        const res = await pool.request().query(`
            UPDATE kc
            SET kc.organization_id = ao.organization_id
            FROM knowledge_chunks kc
            JOIN companies c ON c.id = kc.company_id
            JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE kc.company_id IS NOT NULL
              AND kc.organization_id <> ao.organization_id
        `);
        console.log(`[T-2] Aggiornati: ${res.rowsAffected[0]} chunk`);

        // Verifica
        const kcAfter = await pool.request().query(`
            SELECT COUNT(*) AS remaining
            FROM knowledge_chunks kc
            JOIN companies c ON c.id = kc.company_id
            JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE kc.company_id IS NOT NULL
              AND kc.organization_id <> ao.organization_id
        `);
        const rem = kcAfter.recordset[0].remaining;
        console.log(rem === 0 ? '[T-2] ✅ Fix completato — 0 chunk anomali' : `[T-2] ⚠️  Ancora ${rem} chunk anomali dopo il fix`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // T-3 (opzionale): Report audit cross-tenant — NON applicato automaticamente
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- T-3 (opzionale): Audit cross-tenant (4 draft di test) ---');
    const audits = await pool.request().query(`
        SELECT a.audit_id, a.audit_number, a.status, a.organization_id AS audit_org,
               c.name AS company_name, ao.organization_id AS company_org
        FROM audits a
        JOIN companies c ON c.id = a.company_id
        JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
        WHERE a.organization_id <> ao.organization_id
    `);
    if (audits.recordset.length === 0) {
        console.log('[T-3] ✅ Nessun audit cross-tenant trovato');
    } else {
        console.log(`[T-3] ⚠️  ${audits.recordset.length} audit cross-tenant (da valutare manualmente):`);
        audits.recordset.forEach(r => console.log(`       ${JSON.stringify(r)}`));
        console.log('[T-3] Per eliminare: DELETE FROM audits WHERE audit_id IN (5162, 5166, 5168, 5174)');
        console.log('[T-3]               Richiede prima verifica cascate (audit_events, audit_responses, ecc.)');
    }

    console.log(DRY_RUN
        ? '\n[DRY-RUN] Nessuna modifica eseguita. Rieseguire con --apply per applicare T-1 e T-2.'
        : '\n[APPLY] Fix T-1 e T-2 completati.');

    process.exit(0);
}

main().catch(err => {
    console.error('[ERRORE FATALE]', err.message);
    process.exit(1);
});
