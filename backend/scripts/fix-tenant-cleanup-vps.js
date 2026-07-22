/**
 * fix-tenant-cleanup-vps.js
 * Pulizia documenti "fantasma" in document_registry:
 * record con organization_id=1001 assegnati ad aziende di altri tenant.
 *
 * Operazioni (in transazione):
 *   1. DELETE attachments (10 righe) — PDF fisici restano su disco
 *   2. DELETE document_history (4 righe)
 *   3. DELETE norm_document_sources (7 righe)
 *   4. DELETE knowledge_chunks document/document_content (521 righe)
 *   5. DELETE document_registry (140 righe)
 *   6. UPDATE knowledge_chunks audit_conclusion org=1001→1002 (4 righe — ERAM)
 *
 * Ref: docs/reference/DB_TENANT_ISOLATION_REPORT_20260629.md
 *
 * Uso:
 *   node /tmp/fix-tenant-cleanup-vps.js --dry-run    ← verifica senza modificare
 *   node /tmp/fix-tenant-cleanup-vps.js --apply      ← applica in produzione
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

// Seleziona i doc_registry fantasma: org=1001 ma company di altro tenant
const SELECT_TARGETS = `
    SELECT dr.id
    FROM document_registry dr
    JOIN companies c ON c.id = dr.company_id
    JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
    WHERE dr.company_id IS NOT NULL
      AND dr.organization_id = 1001
      AND ao.organization_id <> 1001
`;

async function main() {
    console.log(DRY_RUN
        ? '\n[DRY-RUN] Sola lettura — usa --apply per applicare'
        : '\n[APPLY] Avvio pulizia in produzione');

    const pool = await mssql.connect(DB_CONFIG);

    // Calcola la lista target
    const tRes = await pool.request().query(SELECT_TARGETS);
    const ids  = tRes.recordset.map(r => r.id);
    if (ids.length === 0) {
        console.log('[OK] Nessun documento fantasma trovato — niente da fare.');
        process.exit(0);
    }
    const idList = ids.join(',');
    console.log(`[INFO] Target: ${ids.length} document_registry da eliminare`);

    // ── Conteggi pre-run ──────────────────────────────────────────────────────
    const [attC, histC, normSrcC, kcDocC, kcOtherC] = await Promise.all([
        pool.request().query(`SELECT COUNT(*) AS n FROM attachments WHERE document_id IN (${idList})`),
        pool.request().query(`SELECT COUNT(*) AS n FROM document_history WHERE document_id IN (${idList})`),
        pool.request().query(`SELECT COUNT(*) AS n FROM norm_document_sources WHERE document_id IN (${idList})`),
        pool.request().query(`SELECT COUNT(*) AS n FROM knowledge_chunks WHERE entity_type IN ('document','document_content') AND entity_id IN (${idList})`),
        pool.request().query(`
            SELECT COUNT(*) AS n FROM knowledge_chunks kc
            JOIN companies c ON c.id = kc.company_id
            JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE kc.company_id IS NOT NULL
              AND kc.organization_id = 1001
              AND ao.organization_id <> 1001
              AND kc.entity_type NOT IN ('document','document_content')
        `),
    ]);

    const plan = [
        { step: 1, label: 'attachments',           n: attC.recordset[0].n },
        { step: 2, label: 'document_history',       n: histC.recordset[0].n },
        { step: 3, label: 'norm_document_sources',  n: normSrcC.recordset[0].n },
        { step: 4, label: 'knowledge_chunks (doc)', n: kcDocC.recordset[0].n },
        { step: 5, label: 'document_registry',      n: ids.length },
        { step: 6, label: 'kc UPDATE org 1001→corr',n: kcOtherC.recordset[0].n },
    ];

    console.log('\n[PIANO]');
    plan.forEach(p => console.log(`  Step ${p.step}: ${p.label.padEnd(28)} → ${p.n} righe`));

    if (DRY_RUN) {
        console.log('\n[DRY-RUN] Nessuna modifica eseguita. Usa --apply per procedere.');
        process.exit(0);
    }

    // ── Esecuzione in transazione ─────────────────────────────────────────────
    const tx = new mssql.Transaction(pool);
    await tx.begin();
    try {
        let r;

        // Step 0 — NULL-ify document_registry.attachment_id (FK inversa: dr.attachment_id → attachments)
        r = await tx.request().query(`
            UPDATE document_registry SET attachment_id = NULL WHERE id IN (${idList}) AND attachment_id IS NOT NULL
        `);
        console.log(`\n[Step 0] document_registry.attachment_id azzerati: ${r.rowsAffected[0]}`);

        // Step 1 — attachments
        r = await tx.request().query(`DELETE FROM attachments WHERE document_id IN (${idList})`);
        console.log(`[Step 1] attachments eliminati: ${r.rowsAffected[0]}`);

        // Step 2 — document_history
        r = await tx.request().query(`DELETE FROM document_history WHERE document_id IN (${idList})`);
        console.log(`[Step 2] document_history eliminati: ${r.rowsAffected[0]}`);

        // Step 3 — norm_document_sources
        r = await tx.request().query(`DELETE FROM norm_document_sources WHERE document_id IN (${idList})`);
        console.log(`[Step 3] norm_document_sources eliminati: ${r.rowsAffected[0]}`);

        // Step 4 — knowledge_chunks document/document_content
        r = await tx.request().query(`
            DELETE FROM knowledge_chunks
            WHERE entity_type IN ('document','document_content')
              AND entity_id IN (${idList})
        `);
        console.log(`[Step 4] knowledge_chunks (doc) eliminati: ${r.rowsAffected[0]}`);

        // Step 5 — document_registry
        r = await tx.request().query(`DELETE FROM document_registry WHERE id IN (${idList})`);
        console.log(`[Step 5] document_registry eliminati: ${r.rowsAffected[0]}`);

        // Step 6 — correggi knowledge_chunks audit_conclusion org=1001 per aziende di altri tenant
        r = await tx.request().query(`
            UPDATE kc
            SET kc.organization_id = ao.organization_id
            FROM knowledge_chunks kc
            JOIN companies c ON c.id = kc.company_id
            JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE kc.company_id IS NOT NULL
              AND kc.organization_id = 1001
              AND ao.organization_id <> 1001
              AND kc.entity_type NOT IN ('document','document_content')
        `);
        console.log(`[Step 6] knowledge_chunks org corretti: ${r.rowsAffected[0]}`);

        await tx.commit();
        console.log('\n[OK] Transazione completata con successo.');

    } catch (err) {
        await tx.rollback();
        console.error('\n[ROLLBACK] Errore — tutte le modifiche annullate:', err.message);
        process.exit(1);
    }

    // ── Verifica post-run ─────────────────────────────────────────────────────
    console.log('\n── Verifica post-pulizia ──');

    const [v1, v2, v3] = await Promise.all([
        pool.request().query(`
            SELECT COUNT(*) AS n FROM document_registry dr
            JOIN companies c ON c.id = dr.company_id
            JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE dr.company_id IS NOT NULL
              AND dr.organization_id = 1001 AND ao.organization_id <> 1001
        `),
        pool.request().query(`
            SELECT COUNT(*) AS n FROM knowledge_chunks kc
            JOIN companies c ON c.id = kc.company_id
            JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE kc.company_id IS NOT NULL
              AND kc.organization_id = 1001 AND ao.organization_id <> 1001
        `),
        pool.request().query(`
            SELECT COUNT(*) AS n FROM attachments att
            JOIN document_registry dr ON dr.id = att.document_id
            JOIN companies c ON c.id = dr.company_id
            JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE dr.organization_id = 1001 AND ao.organization_id <> 1001
        `),
    ]);

    const ok1 = v1.recordset[0].n === 0;
    const ok2 = v2.recordset[0].n === 0;
    const ok3 = v3.recordset[0].n === 0;

    console.log(`  document_registry fantasma residui: ${v1.recordset[0].n} ${ok1 ? '✅' : '❌'}`);
    console.log(`  knowledge_chunks cross-tenant residui: ${v2.recordset[0].n} ${ok2 ? '✅' : '❌'}`);
    console.log(`  allegati collegati a doc fantasma: ${v3.recordset[0].n} ${ok3 ? '✅' : '❌'}`);

    // Conta documenti MANITOU org=1003 (albero intatto)
    const manitou = await pool.request().query(`
        SELECT COUNT(*) AS n FROM document_registry WHERE company_id = 9 AND organization_id = 1003
    `);
    console.log(`  Albero MANITOU org=1003 intatto: ${manitou.recordset[0].n} cartelle ✅`);

    if (ok1 && ok2 && ok3) {
        console.log('\n✅ Pulizia completata — isolamento tenant ripristinato.');
    } else {
        console.log('\n⚠️  Qualche anomalia residua — verificare manualmente.');
    }

    process.exit(0);
}

main().catch(err => {
    console.error('[ERRORE FATALE]', err.message);
    process.exit(1);
});
