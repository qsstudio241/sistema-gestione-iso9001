/**
 * Migration 048 — Sprint 10: import_job_files ? document_registry link
 *
 * 1. Aggiunge registry_document_id (FK ? document_registry)
 * 2. Estende CHECK constraint status con 'committed'
 *
 * SAFE TO RUN MULTIPLE TIMES
 */
require('dotenv').config();
const fs = require('fs'), path = require('path');
const configs = JSON.parse(fs.readFileSync(path.join(__dirname,'..','config','database.json'),'utf8'));
let c = configs.production;
if (process.env.DB_SERVER) c = {
    ...c,
    server: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT || c.port, 10),
    database: process.env.DB_DATABASE || c.database,
    user: process.env.DB_USER || c.user,
    password: process.env.DB_PASSWORD || c.password
};
const sql = require('mssql');

sql.connect({
    server: c.server, port: c.port || 1433, database: c.database,
    user: c.user, password: c.password,
    options: { trustServerCertificate: true, encrypt: true }
}).then(async pool => {
    console.log('Connesso al DB. Esecuzione migration 048 (Sprint 10: import ? registry link)...\n');

    // 1. Aggiunge registry_document_id
    const hasCol = await pool.request().query(`
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.import_job_files') AND name = 'registry_document_id'`);
    if (hasCol.recordset.length === 0) {
        await pool.request().query(`
            ALTER TABLE [dbo].[import_job_files]
            ADD [registry_document_id] INT NULL`);
        console.log('[OK] Colonna registry_document_id aggiunta a import_job_files');
        // FK verso document_registry
        const hasReg = await pool.request().query(`
            SELECT 1 FROM sys.objects WHERE name = 'document_registry' AND type = 'U'`);
        if (hasReg.recordset.length > 0) {
            await pool.request().query(`
                ALTER TABLE [dbo].[import_job_files]
                ADD CONSTRAINT [FK_ijf_registry_document]
                FOREIGN KEY ([registry_document_id]) REFERENCES [dbo].[document_registry]([id])
                ON DELETE SET NULL`);
            console.log('[OK] FK_ijf_registry_document aggiunta');
        } else {
            console.log('[WARN] Tabella document_registry non trovata — FK non aggiunta (ok se migration 029 non eseguita)');
        }
    } else {
        console.log('[--] registry_document_id già presente - skip');
    }

    // 2. Aggiorna CHECK constraint per includere 'committed'
    const ckExists = await pool.request().query(`
        SELECT definition FROM sys.check_constraints WHERE name = 'CK_ijf_status'`);
    const needsUpdate = ckExists.recordset.length > 0
        && !ckExists.recordset[0].definition.includes('committed');

    if (needsUpdate) {
        await pool.request().query(`ALTER TABLE [dbo].[import_job_files] DROP CONSTRAINT [CK_ijf_status]`);
        console.log('[OK] CK_ijf_status eliminato per aggiornamento');
    }
    const ckAfter = await pool.request().query(`
        SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ijf_status'`);
    if (ckAfter.recordset.length === 0) {
        await pool.request().query(`
            ALTER TABLE [dbo].[import_job_files]
            ADD CONSTRAINT [CK_ijf_status]
            CHECK ([status] IN ('uploaded','extracted','reviewed','error','committed'))`);
        console.log('[OK] CK_ijf_status ricreato con "committed"');
    } else {
        console.log('[--] CK_ijf_status già include "committed" - skip');
    }

    // Verifica finale
    const cols = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'import_job_files'
        ORDER BY ORDINAL_POSITION`);
    console.log('\n=== Schema import_job_files post-migration ===');
    cols.recordset.forEach(r => console.log(` ${r.COLUMN_NAME} (${r.DATA_TYPE}) nullable=${r.IS_NULLABLE}`));
    console.log('\n=== Migration 048 completata ===');

    await pool.close();
}).catch(err => {
    console.error('Errore:', err.message);
    process.exit(1);
});
