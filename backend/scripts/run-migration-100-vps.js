/**
 * Migration 100 — Tabella norm_requirements (clausole ISO per copertura normativa §9.3)
 * Applicare al DB di PRODUZIONE via VPS.
 *
 * Uso (da Windows con run-on-vps.ps1):
 *   .\backend\scripts\run-on-vps.ps1 -Script backend\scripts\run-migration-100-vps.js
 */

require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const { getPool } = require('/var/www/sgq-backend/src/config/database');

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
    console.log('Migration 100 — DB di produzione (VPS)');
    const pool = await getPool();

    // Verifica se la tabella esiste già
    const tableExists = await pool.request().query(`
        SELECT COUNT(*) AS cnt
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = 'norm_requirements'
    `);

    if (tableExists.recordset[0].cnt > 0) {
        // Tabella già presente — verifica se usa lo schema atteso (clause_ref)
        const colCheck = await pool.request().query(`
            SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME='norm_requirements' AND COLUMN_NAME='clause_ref'
        `);
        if (colCheck.recordset[0].cnt > 0) {
            const rows = await pool.request().query(
                `SELECT COUNT(*) AS cnt FROM norm_requirements WHERE standard_code='ISO_9001_2015'`
            );
            console.log(`  SKIP: tabella norm_requirements già presente con schema clause_ref (${rows.recordset[0].cnt} righe ISO 9001).`);
            console.log('  OK: migration 100 — nessuna modifica necessaria (tabella preesistente).');
            process.exit(0);
        }
        // Schema legacy con clause_number: non toccare, logga avviso
        console.log('  WARN: tabella norm_requirements presente con schema legacy. Skip seed.');
        console.log('  OK: migration 100 completata (nessuna modifica).');
        process.exit(0);
    }

    // Creazione tabella da zero (caso DB nuovo)
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
            .input('standard_code', 'ISO_9001_2015')
            .input('clause_ref',    row.clause_number)
            .input('clause_title',  row.clause_title)
            .query(`
                INSERT INTO norm_requirements (standard_code, clause_ref, clause_title, is_current, norm_version)
                VALUES (@standard_code, @clause_ref, @clause_title, 1, '2015')
            `);
        inserted++;
    }
    console.log(`  Seed: ${inserted} righe inserite.`);
    console.log('  OK: migration 100 applicata con successo in produzione.');
    process.exit(0);
}

main().catch((e) => {
    console.error('ERRORE migration 100 VPS:', e.message);
    process.exit(1);
});
