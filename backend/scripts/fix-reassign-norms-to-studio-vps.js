/**
 * fix-reassign-norms-to-studio-vps.js
 * Riassegna i PDF delle norme orfane al Patrimonio Studio di PS_Admin (org=1001).
 *
 * Target:
 *   Cartella "NORME E RIFERIMENTI" (doc_registry id=1949, content_scope='studio')
 *   Cartella "MODELLI E TEMPLATE"  (doc_registry id=1946, content_scope='studio')
 *
 * File riassegnati:
 *   7 norme ISO/ASME → NORME E RIFERIMENTI
 *   1 modello Word   → MODELLI E TEMPLATE
 *
 * File ignorati:
 *   4 × ISO_9001_2015_test.pdf → file di test, non necessari
 *
 * Uso:
 *   node /tmp/fix-reassign-norms-to-studio-vps.js --dry-run
 *   node /tmp/fix-reassign-norms-to-studio-vps.js --apply
 */
'use strict';

const fs   = require('fs');
const path = require('path');

require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const mssql = require('/var/www/sgq-backend/node_modules/mssql');

const DB_CONFIG = {
    server: '127.0.0.1', port: 11043, database: 'SGQ_ISO9001',
    user: 'pascarella', password: '#Gestione2025@',
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true,
               connectTimeout: 30000, requestTimeout: 120000 },
};

const DRY_RUN    = !process.argv.includes('--apply');
const BACKEND    = '/var/www/sgq-backend';
const ORG_ID     = 1001;
const UPLOADER   = 1;    // user_id di PS_Admin (admin@sgq.local)

// Cartelle target nel Patrimonio Studio
const FOLDER_NORME    = 1949;  // NORME E RIFERIMENTI
const FOLDER_MODELLI  = 1946;  // MODELLI E TEMPLATE

// Definizione dei file da riassegnare
// storage_path = percorso relativo al BACKEND_ROOT (come salvato in DB)
const NORME = [
    {
        storage_path: 'uploads/docs/1001/1147/1780084670199_f1b9fa02137f_ISO_5817.pdf',
        file_name:    'ISO_5817.pdf',
        title:        'EN ISO 5817:2014 — Welding: Fusion-welded joints in steel, nickel, titanium — Quality levels',
        mime_type:    'application/pdf',
        folder_id:    FOLDER_NORME,
        doc_type:     'norma',
    },
    {
        storage_path: 'uploads/norms/1001/1778869761990_a4f34bdc99d1_ISO 9016 _2012_.pdf',
        file_name:    'ISO 9016 (2012).pdf',
        title:        'ISO 9016:2012 — Destructive tests on welds — Impact tests',
        mime_type:    'application/pdf',
        folder_id:    FOLDER_NORME,
        doc_type:     'norma',
    },
    {
        storage_path: 'uploads/norms/1001/1780215602545_61090772cae2_ISO 10001 _2007_.pdf',
        file_name:    'ISO 10001 (2007).pdf',
        title:        'ISO 10001:2007 — Quality management: Customer satisfaction — Codes of conduct',
        mime_type:    'application/pdf',
        folder_id:    FOLDER_NORME,
        doc_type:     'norma',
    },
    {
        storage_path: 'uploads/norms/1001/1780216882395_08c7a3e48200_BS ISO 10002 _2014_.pdf',
        file_name:    'BS ISO 10002 (2014).pdf',
        title:        'ISO 10002:2014 — Quality management: Customer satisfaction — Complaints handling',
        mime_type:    'application/pdf',
        folder_id:    FOLDER_NORME,
        doc_type:     'norma',
    },
    {
        storage_path: 'uploads/norms/1001/1780216882401_33b917c5900f_BS ISO 10005 _2018_.pdf',
        file_name:    'BS ISO 10005 (2018).pdf',
        title:        'ISO 10005:2018 — Quality management: Guidelines for quality plans',
        mime_type:    'application/pdf',
        folder_id:    FOLDER_NORME,
        doc_type:     'norma',
    },
    {
        storage_path: 'uploads/norms/1001/1780651654693_54fcdf5d8990_UNI EN ISO 19011 ITA _2018_.pdf',
        file_name:    'UNI EN ISO 19011 ITA (2018).pdf',
        title:        'UNI EN ISO 19011:2018 — Linee guida per gli audit dei sistemi di gestione',
        mime_type:    'application/pdf',
        folder_id:    FOLDER_NORME,
        doc_type:     'norma',
    },
    {
        storage_path: 'uploads/norms/1001/1780718002357_154f1a619e19_ASME B16.5 _2020_.pdf',
        file_name:    'ASME B16.5 (2020).pdf',
        title:        'ASME B16.5:2020 — Pipe Flanges and Flanged Fittings NPS ½ Through NPS 24',
        mime_type:    'application/pdf',
        folder_id:    FOLDER_NORME,
        doc_type:     'norma',
    },
];

const MODELLI = [
    {
        storage_path: 'uploads/docs/1001/1009/1778957436810_252cd5526144_Matrice Report Audit Conf. Legislativa ISO 14001.docx',
        file_name:    'Matrice Report Audit Conf. Legislativa ISO 14001.docx',
        title:        'Matrice Report Audit Conformità Legislativa ISO 14001',
        // file_type max 50 char in DB — uso alias corto; mime_type (max 100) porta il MIME completo
        mime_type:    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        file_type_short: 'application/msword',
        folder_id:    FOLDER_MODELLI,
        doc_type:     'modello',
    },
];

const ALL_FILES = [...NORME, ...MODELLI];

async function main() {
    console.log(DRY_RUN
        ? '\n[DRY-RUN] Sola lettura — usa --apply per applicare'
        : '\n[APPLY] Riassegnazione norme al Patrimonio Studio');

    const pool = await mssql.connect(DB_CONFIG);

    // ── Verifica file fisici ──────────────────────────────────────────────────
    console.log('\n── Verifica file fisici su disco ──');
    let allExist = true;
    for (const f of ALL_FILES) {
        const full = path.join(BACKEND, f.storage_path);
        const exists = fs.existsSync(full);
        const size   = exists ? fs.statSync(full).size : 0;
        f.file_size  = size;
        console.log(`  ${exists ? '✅' : '❌'}  ${f.file_name} (${size} bytes)`);
        if (!exists) allExist = false;
    }
    if (!allExist) {
        console.error('\n[ERRORE] Alcuni file non trovati su disco. Abortisco.');
        process.exit(1);
    }

    // ── Verifica cartelle target esistono ────────────────────────────────────
    console.log('\n── Verifica cartelle target nel DB ──');
    const folders = await pool.request().query(`
        SELECT id, title, parent_id, content_scope FROM document_registry
        WHERE id IN (${FOLDER_NORME}, ${FOLDER_MODELLI})
          AND organization_id = ${ORG_ID}
    `);
    folders.recordset.forEach(f => console.log(`  ✅  id=${f.id} "${f.title}" (scope=${f.content_scope})`));
    if (folders.recordset.length < 2) {
        console.error('[ERRORE] Cartelle target non trovate. Abortisco.');
        process.exit(1);
    }

    // ── Verifica duplicati (già esiste un doc con stesso titolo nella cartella?) ──
    console.log('\n── Verifica duplicati ──');
    for (const f of ALL_FILES) {
        const dup = await pool.request()
            .input('title',  mssql.NVarChar, f.title)
            .input('folder', mssql.Int,      f.folder_id)
            .input('org',    mssql.Int,      ORG_ID)
            .query(`
                SELECT COUNT(*) AS n FROM document_registry
                WHERE title = @title AND parent_id = @folder AND organization_id = @org
            `);
        const n = dup.recordset[0].n;
        console.log(`  ${n > 0 ? '⚠️  già esiste' : '✅  nuovo    '}  "${f.title}"`);
        f.skip = n > 0;
    }

    const toInsert = ALL_FILES.filter(f => !f.skip);
    console.log(`\n[INFO] File da inserire: ${toInsert.length} / ${ALL_FILES.length}`);

    if (DRY_RUN) {
        console.log('\n[DRY-RUN] Nessuna modifica. Usa --apply per procedere.');
        process.exit(0);
    }

    if (toInsert.length === 0) {
        console.log('[OK] Tutti i file già presenti — niente da fare.');
        process.exit(0);
    }

    // ── Inserimento in transazione ────────────────────────────────────────────
    const tx = new mssql.Transaction(pool);
    await tx.begin();
    try {
        for (const f of toInsert) {
            // 1. Crea documento in document_registry
            const insDoc = await tx.request()
                .input('organization_id', mssql.Int,          ORG_ID)
                .input('company_id',      mssql.Int,          null)
                .input('auditor_org_id',  mssql.Int,          null)
                .input('parent_id',       mssql.Int,          f.folder_id)
                .input('doc_type',        mssql.NVarChar(50), f.doc_type)
                .input('title',           mssql.NVarChar(500),f.title)
                .input('status',          mssql.NVarChar(30), 'rilasciato')
                .input('content_scope',   mssql.NVarChar(30), 'studio')
                .input('created_by',      mssql.Int,          UPLOADER)
                .query(`
                    INSERT INTO document_registry
                        (organization_id, company_id, auditor_org_id,
                         parent_id, doc_type, title, status, content_scope, created_by,
                         created_at, updated_at)
                    OUTPUT INSERTED.id
                    VALUES
                        (@organization_id, @company_id, @auditor_org_id,
                         @parent_id, @doc_type, @title, @status, @content_scope, @created_by,
                         GETDATE(), GETDATE())
                `);
            const docId = insDoc.recordset[0].id;

            // 2. Crea allegato in attachments
            const insAtt = await tx.request()
                .input('audit_id',     mssql.Int,          null)
                .input('document_id',  mssql.Int,          docId)
                .input('file_name',    mssql.NVarChar(500), f.file_name)
                .input('file_type',    mssql.NVarChar(50),  f.file_type_short || f.mime_type)
                .input('file_size',    mssql.Int,           f.file_size)
                .input('mime_type',    mssql.NVarChar(100), f.mime_type)
                .input('storage_path', mssql.NVarChar(mssql.MAX), f.storage_path)
                .input('category',     mssql.NVarChar(50),  'document')
                .input('uploaded_by',  mssql.Int,           UPLOADER)
                .query(`
                    INSERT INTO attachments
                        (audit_id, document_id, file_name, file_type, file_size,
                         mime_type, storage_path, category, uploaded_by, created_at,
                         attachment_uuid)
                    OUTPUT INSERTED.attachment_id
                    VALUES
                        (@audit_id, @document_id, @file_name, @file_type, @file_size,
                         @mime_type, @storage_path, @category, @uploaded_by, GETDATE(),
                         NEWID())
                `);
            const attId = insAtt.recordset[0].attachment_id;

            // 3. Aggiorna document_registry.attachment_id con il file principale
            await tx.request()
                .input('att_id', mssql.Int, attId)
                .input('doc_id', mssql.Int, docId)
                .query(`UPDATE document_registry SET attachment_id = @att_id WHERE id = @doc_id`);

            console.log(`  ✅  Inserito: doc_id=${docId}, att_id=${attId} — "${f.title}"`);
        }

        await tx.commit();
        console.log('\n[OK] Transazione completata con successo.');

    } catch (err) {
        await tx.rollback();
        console.error('\n[ROLLBACK] Errore:', err.message);
        process.exit(1);
    }

    // ── Verifica post-run ─────────────────────────────────────────────────────
    console.log('\n── Verifica post-inserimento ──');
    const check = await pool.request()
        .input('folder_norme',   mssql.Int, FOLDER_NORME)
        .input('folder_modelli', mssql.Int, FOLDER_MODELLI)
        .query(`
            SELECT dr.id, dr.title, dr.doc_type,
                   att.file_name, att.file_size,
                   CASE dr.parent_id
                       WHEN @folder_norme   THEN 'NORME E RIFERIMENTI'
                       WHEN @folder_modelli THEN 'MODELLI E TEMPLATE'
                       ELSE '?'
                   END AS cartella
            FROM document_registry dr
            JOIN attachments att ON att.attachment_id = dr.attachment_id
            WHERE dr.parent_id IN (@folder_norme, @folder_modelli)
              AND dr.organization_id = ${ORG_ID}
              AND dr.company_id IS NULL
            ORDER BY dr.parent_id, dr.id
        `);
    console.log(`\n  Contenuto Patrimonio Studio post-inserimento (${check.recordset.length} documenti):`);
    check.recordset.forEach(r =>
        console.log(`    [${r.cartella}]  "${r.title}"  → ${r.file_name} (${r.file_size} bytes)`)
    );

    console.log('\n✅ Norme riassegnate al Patrimonio Studio di PS_Admin.');
    process.exit(0);
}

main().catch(err => {
    console.error('[ERRORE FATALE]', err.message);
    process.exit(1);
});
