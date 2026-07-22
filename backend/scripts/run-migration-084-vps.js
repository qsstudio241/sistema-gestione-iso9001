/**
 * run-migration-084-vps.js
 * Esegue migration 084: estensione tabella qualifications v2
 * Uso: node run-migration-084-vps.js  (dal VPS: cd /var/www/sgq-backend && node /tmp/run-migration-084-vps.js)
 */
'use strict';

// Sul VPS la connessione a www.fr-busato.it dall'interno passa per l'IP pubblico e può
// essere bloccata da hairpin NAT. Usa 127.0.0.1 con le stesse credenziali.
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
    // Storico rinnovi
    { name: 'previous_qualification_id', sql: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('qualifications') AND name='previous_qualification_id') BEGIN ALTER TABLE qualifications ADD previous_qualification_id INT NULL; PRINT 'OK previous_qualification_id'; END ELSE PRINT 'SKIP previous_qualification_id';` },
    // Workflow approvazione
    { name: 'approval_status', sql: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('qualifications') AND name='approval_status') BEGIN ALTER TABLE qualifications ADD approval_status NVARCHAR(20) NOT NULL DEFAULT 'bozza'; PRINT 'OK approval_status'; END ELSE PRINT 'SKIP approval_status';` },
    { name: 'approved_by', sql: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('qualifications') AND name='approved_by') BEGIN ALTER TABLE qualifications ADD approved_by INT NULL; PRINT 'OK approved_by'; END ELSE PRINT 'SKIP approved_by';` },
    { name: 'approved_at', sql: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('qualifications') AND name='approved_at') BEGIN ALTER TABLE qualifications ADD approved_at DATETIME2 NULL; PRINT 'OK approved_at'; END ELSE PRINT 'SKIP approved_at';` },
    { name: 'rejection_reason', sql: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('qualifications') AND name='rejection_reason') BEGIN ALTER TABLE qualifications ADD rejection_reason NVARCHAR(500) NULL; PRINT 'OK rejection_reason'; END ELSE PRINT 'SKIP rejection_reason';` },
    // Allegato certificato
    { name: 'certificate_file_url', sql: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('qualifications') AND name='certificate_file_url') BEGIN ALTER TABLE qualifications ADD certificate_file_url NVARCHAR(500) NULL; PRINT 'OK certificate_file_url'; END ELSE PRINT 'SKIP certificate_file_url';` },
    // Saldatori ISO 9606 / ISO 14732
    { name: 'joint_type', sql: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('qualifications') AND name='joint_type') BEGIN ALTER TABLE qualifications ADD joint_type NVARCHAR(20) NULL; PRINT 'OK joint_type'; END ELSE PRINT 'SKIP joint_type';` },
    { name: 'thickness_range', sql: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('qualifications') AND name='thickness_range') BEGIN ALTER TABLE qualifications ADD thickness_range NVARCHAR(50) NULL; PRINT 'OK thickness_range'; END ELSE PRINT 'SKIP thickness_range';` },
    { name: 'pipe_diameter', sql: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('qualifications') AND name='pipe_diameter') BEGIN ALTER TABLE qualifications ADD pipe_diameter NVARCHAR(50) NULL; PRINT 'OK pipe_diameter'; END ELSE PRINT 'SKIP pipe_diameter';` },
    { name: 'filler_material', sql: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('qualifications') AND name='filler_material') BEGIN ALTER TABLE qualifications ADD filler_material NVARCHAR(100) NULL; PRINT 'OK filler_material'; END ELSE PRINT 'SKIP filler_material';` },
    { name: 'shielding_gas', sql: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('qualifications') AND name='shielding_gas') BEGIN ALTER TABLE qualifications ADD shielding_gas NVARCHAR(50) NULL; PRINT 'OK shielding_gas'; END ELSE PRINT 'SKIP shielding_gas';` },
    { name: 'equipment_type', sql: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('qualifications') AND name='equipment_type') BEGIN ALTER TABLE qualifications ADD equipment_type NVARCHAR(100) NULL; PRINT 'OK equipment_type'; END ELSE PRINT 'SKIP equipment_type';` },
    // NDT ISO 9712
    { name: 'ndt_sector', sql: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('qualifications') AND name='ndt_sector') BEGIN ALTER TABLE qualifications ADD ndt_sector NVARCHAR(50) NULL; PRINT 'OK ndt_sector'; END ELSE PRINT 'SKIP ndt_sector';` },
    { name: 'certification_scheme', sql: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('qualifications') AND name='certification_scheme') BEGIN ALTER TABLE qualifications ADD certification_scheme NVARCHAR(50) NULL; PRINT 'OK certification_scheme'; END ELSE PRINT 'SKIP certification_scheme';` },
    // Coordinatori ISO 14731
    { name: 'coordinator_title', sql: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('qualifications') AND name='coordinator_title') BEGIN ALTER TABLE qualifications ADD coordinator_title NVARCHAR(20) NULL; PRINT 'OK coordinator_title'; END ELSE PRINT 'SKIP coordinator_title';` },
    { name: 'diploma_number', sql: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('qualifications') AND name='diploma_number') BEGIN ALTER TABLE qualifications ADD diploma_number NVARCHAR(100) NULL; PRINT 'OK diploma_number'; END ELSE PRINT 'SKIP diploma_number';` },
    { name: 'cpd_valid_until', sql: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('qualifications') AND name='cpd_valid_until') BEGIN ALTER TABLE qualifications ADD cpd_valid_until DATE NULL; PRINT 'OK cpd_valid_until'; END ELSE PRINT 'SKIP cpd_valid_until';` },
    // PES/PAV
    { name: 'patent_type', sql: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('qualifications') AND name='patent_type') BEGIN ALTER TABLE qualifications ADD patent_type NVARCHAR(50) NULL; PRINT 'OK patent_type'; END ELSE PRINT 'SKIP patent_type';` },
    { name: 'training_body', sql: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('qualifications') AND name='training_body') BEGIN ALTER TABLE qualifications ADD training_body NVARCHAR(200) NULL; PRINT 'OK training_body'; END ELSE PRINT 'SKIP training_body';` },
    // Generico
    { name: 'course_name', sql: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('qualifications') AND name='course_name') BEGIN ALTER TABLE qualifications ADD course_name NVARCHAR(200) NULL; PRINT 'OK course_name'; END ELSE PRINT 'SKIP course_name';` },
    { name: 'training_hours', sql: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('qualifications') AND name='training_hours') BEGIN ALTER TABLE qualifications ADD training_hours INT NULL; PRINT 'OK training_hours'; END ELSE PRINT 'SKIP training_hours';` },
    { name: 'examiner_body', sql: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('qualifications') AND name='examiner_body') BEGIN ALTER TABLE qualifications ADD examiner_body NVARCHAR(200) NULL; PRINT 'OK examiner_body'; END ELSE PRINT 'SKIP examiner_body';` },
    // Check constraint
    { name: 'CK_approval_status', sql: `IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('qualifications') AND name='CK_qualifications_approval_status') BEGIN ALTER TABLE qualifications ADD CONSTRAINT CK_qualifications_approval_status CHECK (approval_status IN ('bozza','in_revisione','approvata','rifiutata')); PRINT 'OK CK_qualifications_approval_status'; END ELSE PRINT 'SKIP CK_qualifications_approval_status';` },
    // Index
    { name: 'IX_qualifications_approval_status', sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('qualifications') AND name='IX_qualifications_approval_status') BEGIN CREATE INDEX IX_qualifications_approval_status ON qualifications (organization_id, approval_status); PRINT 'OK IX_qualifications_approval_status'; END ELSE PRINT 'SKIP IX_qualifications_approval_status';` },
];

async function run() {
    const pool = await getPool();
    let ok = 0; let skip = 0;
    for (const step of STEPS) {
        try {
            const r = await pool.request().query(step.sql);
            const msg = (r.recordset || []).map(x => Object.values(x).join('')).join('') || '';
            process.stdout.write(`[084] ${step.name}: ${msg || 'eseguito'}\n`);
            if (msg.startsWith('SKIP')) skip++; else ok++;
        } catch (err) {
            process.stderr.write(`[084] ERRORE ${step.name}: ${err.message}\n`);
            process.exit(1);
        }
    }
    // Smoke: verifica colonne chiave
    const smoke = await pool.request().query(`
        SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('qualifications')
        AND name IN ('approval_status','previous_qualification_id','ndt_sector','coordinator_title','patent_type')
    `);
    const found = smoke.recordset.map(r => r.name).sort();
    process.stdout.write(`\nSmoke: colonne trovate = [${found.join(', ')}]\n`);
    process.stdout.write(`Migration 084 completata: ${ok} aggiunte, ${skip} gi presenti.\n`);
    process.exit(0);
}

run().catch(err => { process.stderr.write(`Fatale: ${err.message}\n`); process.exit(1); });
