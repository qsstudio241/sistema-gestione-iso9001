/**
 * Migration 100 — Tabella norm_requirements (clausole ISO per copertura normativa §9.3)
 * Applicare al DB di TEST locale (profilo "test" di database.json)
 *
 * Uso:
 *   cd C:\Dev\ProgettoISO\backend
 *   node scripts/run-migration-100-local.js
 *
 * NON carica .env — legge solo database.json sezione "test".
 */

const sql = require('mssql');
const { loadDatabaseJsonConfigs } = require('./mergeDbEnv');

const SEED_CLAUSES = [
    { clause_number: '4.1',  clause_title: 'Contesto dell\'organizzazione' },
    { clause_number: '4.2',  clause_title: 'Parti interessate' },
    { clause_number: '4.3',  clause_title: 'Scopo del sistema di gestione' },
    { clause_number: '5.1',  clause_title: 'Leadership e impegno' },
    { clause_number: '5.2',  clause_title: 'Politica per la qualità' },
    { clause_number: '6.1',  clause_title: 'Azioni per affrontare rischi e opportunità' },
    { clause_number: '6.2',  clause_title: 'Obiettivi per la qualità' },
    { clause_number: '7.1',  clause_title: 'Risorse' },
    { clause_number: '7.2',  clause_title: 'Competenza' },
    { clause_number: '7.3',  clause_title: 'Consapevolezza' },
    { clause_number: '7.4',  clause_title: 'Comunicazione' },
    { clause_number: '7.5',  clause_title: 'Informazioni documentate' },
    { clause_number: '8.1',  clause_title: 'Pianificazione e controllo operativi' },
    { clause_number: '8.2',  clause_title: 'Requisiti per prodotti e servizi' },
    { clause_number: '8.4',  clause_title: 'Controllo dei processi/prodotti/servizi forniti dall\'esterno' },
    { clause_number: '8.5',  clause_title: 'Produzione ed erogazione del servizio' },
    { clause_number: '8.7',  clause_title: 'Controllo degli elementi non conformi' },
    { clause_number: '9.1',  clause_title: 'Monitoraggio, misurazione, analisi e valutazione' },
    { clause_number: '9.2',  clause_title: 'Audit interno' },
    { clause_number: '9.3',  clause_title: 'Riesame di direzione' },
    { clause_number: '10.2', clause_title: 'Non conformità e azioni correttive' },
    { clause_number: '10.3', clause_title: 'Miglioramento continuo' },
];

async function main() {
    const configs = loadDatabaseJsonConfigs();
    const c = configs['test'];
    if (!c) throw new Error('Sezione "test" mancante in backend/config/database.json');

    console.log(`Migration 100 → [${c.database}] su ${c.server}:${c.port}`);

    const pool = await sql.connect({
        server: c.server,
        port: c.port || 1433,
        database: c.database,
        user: c.user,
        password: c.password,
        options: {
            encrypt: c.options?.encrypt ?? false,
            trustServerCertificate: true,
            enableArithAbort: true,
            connectTimeout: c.options?.connectTimeout ?? 30000,
            requestTimeout: c.options?.requestTimeout ?? 30000,
        },
    });

    // Verifica se la tabella esiste già
    const tableExists = await pool.request().query(`
        SELECT COUNT(*) AS cnt
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = 'norm_requirements'
    `);

    if (tableExists.recordset[0].cnt > 0) {
        const colCheck = await pool.request().query(`
            SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME='norm_requirements' AND COLUMN_NAME='clause_ref'
        `);
        if (colCheck.recordset[0].cnt > 0) {
            const rows = await pool.request().query(
                `SELECT COUNT(*) AS cnt FROM norm_requirements WHERE standard_code='ISO_9001_2015'`
            );
            console.log(`  SKIP: tabella già presente con schema clause_ref (${rows.recordset[0].cnt} righe ISO 9001).`);
            console.log('  OK: migration 100 completata (nessuna modifica necessaria).');
            await pool.close();
            return;
        }
        console.log('  WARN: tabella norm_requirements presente con schema legacy — nessuna modifica.');
        await pool.close();
        return;
    }

    // Creazione da zero
    console.log('  Creazione tabella norm_requirements...');
    await pool.request().query(`
        CREATE TABLE norm_requirements (
            id               INT IDENTITY(1,1) PRIMARY KEY,
            standard_code    NVARCHAR(30)  NOT NULL,
            clause_ref       NVARCHAR(20)  NOT NULL,
            clause_title     NVARCHAR(500) NOT NULL,
            is_current       BIT           NOT NULL DEFAULT 1,
            norm_version     NVARCHAR(20)  NULL,
            created_at       DATETIME      DEFAULT GETDATE()
        )
    `);
    await pool.request().query(
        `CREATE INDEX IX_norm_req_standard ON norm_requirements(standard_code, is_current)`
    );

    console.log('  Inserimento seed clausole ISO_9001_2015...');
    let inserted = 0;
    for (const row of SEED_CLAUSES) {
        await pool.request()
            .input('standard_code', sql.NVarChar(30),  'ISO_9001_2015')
            .input('clause_ref',    sql.NVarChar(20),  row.clause_number)
            .input('clause_title',  sql.NVarChar(500), row.clause_title)
            .query(`
                INSERT INTO norm_requirements (standard_code, clause_ref, clause_title, is_current, norm_version)
                VALUES (@standard_code, @clause_ref, @clause_title, 1, '2015')
            `);
        inserted++;
    }
    console.log(`  Seed: ${inserted} righe inserite.`);
    console.log('  OK: migration 100 applicata con successo.');
    await pool.close();
}

main().catch((e) => {
    console.error('ERRORE migration 100:', e.message);
    process.exit(1);
});
