/**
 * run-migration-085-vps.js
 * Migration 085: verifica/aggiorna tabelle projects + project_welders, aggiunge FK
 * Uso: node /tmp/run-migration-085-vps.js  (dal VPS)
 */
'use strict';

const mssql = require('/var/www/sgq-backend/node_modules/mssql');

const DB_CONFIG = {
    server: '127.0.0.1',
    port: 11043,
    database: 'SGQ_ISO9001',
    user: 'pascarella',
    password: '#Gestione2025@',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectTimeout: 30000,
        requestTimeout: 30000,
    },
};

let _pool = null;
async function getPool() {
    if (!_pool) { _pool = await mssql.connect(DB_CONFIG); }
    return _pool;
}

const STEPS = [
    // ?? projects: colonna commercial_case_id ?????????????????????????????????
    {
        name: 'projects.commercial_case_id column',
        sql: `IF EXISTS (SELECT 1 FROM sys.objects WHERE name='projects' AND type='U')
              AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('projects') AND name='commercial_case_id')
              BEGIN ALTER TABLE projects ADD commercial_case_id INT NULL; PRINT 'OK projects.commercial_case_id'; END
              ELSE PRINT 'SKIP projects.commercial_case_id';`,
    },
    // FK projects -> commercial_cases (solo se commercial_cases esiste)
    {
        name: 'FK_projects_commercial_case',
        sql: `IF EXISTS (SELECT 1 FROM sys.objects WHERE name='projects' AND type='U')
              AND EXISTS (SELECT 1 FROM sys.objects WHERE name='commercial_cases' AND type='U')
              AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_projects_commercial_case' AND parent_object_id=OBJECT_ID('projects'))
              BEGIN
                ALTER TABLE projects ADD CONSTRAINT FK_projects_commercial_case
                  FOREIGN KEY (commercial_case_id) REFERENCES commercial_cases(id);
                PRINT 'OK FK_projects_commercial_case';
              END
              ELSE PRINT 'SKIP FK_projects_commercial_case';`,
    },
    // ?? qualifications: FK previous_qualification_id ?????????????????????????
    {
        name: 'FK_qualifications_previous',
        sql: `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_qualifications_previous' AND parent_object_id=OBJECT_ID('qualifications'))
              BEGIN
                ALTER TABLE qualifications ADD CONSTRAINT FK_qualifications_previous
                  FOREIGN KEY (previous_qualification_id) REFERENCES qualifications(id);
                PRINT 'OK FK_qualifications_previous';
              END
              ELSE PRINT 'SKIP FK_qualifications_previous';`,
    },
    // ?? qualifications: FK approved_by -> users ???????????????????????????????
    {
        name: 'FK_qualifications_approved_by',
        sql: `IF EXISTS (SELECT 1 FROM sys.objects WHERE name='users' AND type='U')
              AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_qualifications_approved_by' AND parent_object_id=OBJECT_ID('qualifications'))
              BEGIN
                ALTER TABLE qualifications ADD CONSTRAINT FK_qualifications_approved_by
                  FOREIGN KEY (approved_by) REFERENCES users(id);
                PRINT 'OK FK_qualifications_approved_by';
              END
              ELSE PRINT 'SKIP FK_qualifications_approved_by';`,
    },
    // ?? Index projects.commercial_case_id ????????????????????????????????????
    {
        name: 'IX_projects_commercial_case',
        sql: `IF EXISTS (SELECT 1 FROM sys.objects WHERE name='projects' AND type='U')
              AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('projects') AND name='IX_projects_commercial_case')
              BEGIN
                CREATE INDEX IX_projects_commercial_case ON projects (commercial_case_id);
                PRINT 'OK IX_projects_commercial_case';
              END
              ELSE PRINT 'SKIP IX_projects_commercial_case';`,
    },
];

async function run() {
    const pool = await getPool();
    let ok = 0; let skip = 0;

    // Verifica esistenza tabelle principali
    const tables = await pool.request().query(`
        SELECT name FROM sys.objects WHERE type='U' AND name IN ('projects','project_welders','commercial_cases','qualifications','users')
    `);
    const tableNames = tables.recordset.map(r => r.name);
    process.stdout.write(`Tabelle trovate: [${tableNames.join(', ')}]\n`);

    for (const step of STEPS) {
        try {
            const r = await pool.request().query(step.sql);
            const msg = (r.recordset || []).map(x => Object.values(x).join('')).join('') || 'eseguito';
            process.stdout.write(`[085] ${step.name}: ${msg}\n`);
            if (msg.startsWith('SKIP')) skip++; else ok++;
        } catch (err) {
            process.stderr.write(`[085] ERRORE ${step.name}: ${err.message}\n`);
            // Non bloccare per FK mancante — logga e continua
        }
    }

    process.stdout.write(`\nMigration 085 completata: ${ok} applicati, ${skip} già presenti.\n`);
    process.exit(0);
}

run().catch(err => { process.stderr.write(`Fatale: ${err.message}\n`); process.exit(1); });
