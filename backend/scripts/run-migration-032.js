/**
 * run-migration-032.js — Migration 032: tabella qualifications
 */
const sql  = require('mssql');
const path = require('path');

const dbConfigAll = require(path.join(__dirname, '../config/database.json'));
const env = process.env.NODE_ENV || 'production';
const dbConfig = dbConfigAll[env] || dbConfigAll.production || dbConfigAll;

const SQL = `
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name='qualifications' AND type='U')
BEGIN
    CREATE TABLE qualifications (
        id                  INT IDENTITY(1,1) NOT NULL,
        organization_id     INT            NOT NULL,
        company_id          INT            NULL,
        person_name         NVARCHAR(200)  NOT NULL,
        person_code         NVARCHAR(50)   NULL,
        department          NVARCHAR(100)  NULL,
        qualification_type  NVARCHAR(100)  NOT NULL,
        standard_ref        NVARCHAR(100)  NULL,
        scope_detail        NVARCHAR(300)  NULL,
        certificate_number  NVARCHAR(100)  NULL,
        issuing_body        NVARCHAR(200)  NULL,
        issue_date          DATE           NULL,
        expiry_date         DATE           NULL,
        last_renewal_date   DATE           NULL,
        status              NVARCHAR(30)   NOT NULL DEFAULT 'valida'
            CONSTRAINT CK_qualif_status CHECK (
                status IN ('valida','in_scadenza','scaduta','sospesa','revocata')
            ),
        notes               NVARCHAR(1000) NULL,
        created_at          DATETIME2      NOT NULL DEFAULT GETDATE(),
        updated_at          DATETIME2      NOT NULL DEFAULT GETDATE(),
        created_by          INT            NULL,
        CONSTRAINT PK_qualifications PRIMARY KEY (id)
    );
    CREATE INDEX IX_qualif_org     ON qualifications(organization_id);
    CREATE INDEX IX_qualif_expiry  ON qualifications(expiry_date);
    CREATE INDEX IX_qualif_company ON qualifications(company_id);
END
`;

async function run() {
    console.log('Connessione al database...');
    await sql.connect(dbConfig);
    console.log('Connesso.');
    await sql.query(SQL);
    console.log('Migration 032 completata con successo.');
    await sql.close();
}

run().catch(err => {
    console.error('Errore migration 032:', err.message);
    process.exit(1);
});
