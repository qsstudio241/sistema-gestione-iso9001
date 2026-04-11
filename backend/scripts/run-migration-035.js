/**
 * run-migration-035.js
 * Esegue la migration 035 (complaints, suppliers, supplier_evaluations) sul DB di produzione.
 */

const sql = require('mssql');
const fs  = require('fs');
const path = require('path');

const dbConfigAll = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../config/database.json'), 'utf8')
);
const env = process.env.NODE_ENV || 'production';
const dbConfig = dbConfigAll[env] || dbConfigAll.production || dbConfigAll;

// SQL inline
const SQL_035_COMPLAINTS = `
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'complaints' AND type = 'U')
BEGIN
    CREATE TABLE complaints (
        id                  INT IDENTITY(1,1) NOT NULL,
        organization_id     INT            NOT NULL,
        company_id          INT            NULL,
        title               NVARCHAR(255)  NOT NULL,
        description         NVARCHAR(MAX)  NOT NULL,
        customer_name       NVARCHAR(255)  NOT NULL,
        status              NVARCHAR(50)   NOT NULL DEFAULT 'open'
            CONSTRAINT CK_complaints_status
            CHECK (status IN ('open', 'in_progress', 'verified', 'closed')),
        receive_date        DATE           NOT NULL,
        close_date          DATE           NULL,
        notes               NVARCHAR(MAX)  NULL,
        created_by          INT            NULL,
        created_at          DATETIME2      NOT NULL DEFAULT GETDATE(),
        updated_at          DATETIME2      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_complaints PRIMARY KEY (id)
    );
    PRINT 'Tabella complaints creata.';
END
ELSE PRINT 'Tabella complaints gia esistente - skip.';
`;

const SQL_035_SUPPLIERS = `
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'suppliers' AND type = 'U')
BEGIN
    CREATE TABLE suppliers (
        id                  INT IDENTITY(1,1) NOT NULL,
        organization_id     INT            NOT NULL,
        company_id          INT            NULL,
        name                NVARCHAR(255)  NOT NULL,
        vat_number          NVARCHAR(50)   NULL,
        category            NVARCHAR(100)  NULL,
        is_qualified        BIT            NOT NULL DEFAULT 0,
        notes               NVARCHAR(MAX)  NULL,
        created_by          INT            NULL,
        created_at          DATETIME2      NOT NULL DEFAULT GETDATE(),
        updated_at          DATETIME2      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_suppliers PRIMARY KEY (id)
    );
    PRINT 'Tabella suppliers creata.';
END
ELSE PRINT 'Tabella suppliers gia esistente - skip.';
`;

const SQL_035_SUPPLIER_EVALUATIONS = `
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'supplier_evaluations' AND type = 'U')
BEGIN
    CREATE TABLE supplier_evaluations (
        id                   INT IDENTITY(1,1) NOT NULL,
        supplier_id          INT            NOT NULL,
        evaluation_date      DATE           NOT NULL,
        score                INT            NOT NULL
            CONSTRAINT CK_supplier_eval_score CHECK (score BETWEEN 1 AND 5),
        notes                NVARCHAR(MAX)  NULL,
        next_evaluation_date DATE           NULL,
        created_by           INT            NULL,
        created_at           DATETIME2      NOT NULL DEFAULT GETDATE(),
        updated_at           DATETIME2      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_supplier_evaluations PRIMARY KEY (id)
    );
    PRINT 'Tabella supplier_evaluations creata.';
END
ELSE PRINT 'Tabella supplier_evaluations gia esistente - skip.';
`;

const SQL_035_FK = `
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_complaints_org')
    ALTER TABLE complaints ADD CONSTRAINT FK_complaints_org FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_complaints_company')
    ALTER TABLE complaints ADD CONSTRAINT FK_complaints_company FOREIGN KEY (company_id) REFERENCES companies(id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_suppliers_org')
    ALTER TABLE suppliers ADD CONSTRAINT FK_suppliers_org FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_suppliers_company')
    ALTER TABLE suppliers ADD CONSTRAINT FK_suppliers_company FOREIGN KEY (company_id) REFERENCES companies(id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_supplier_eval_supplier')
    ALTER TABLE supplier_evaluations ADD CONSTRAINT FK_supplier_eval_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
`;

async function runMigration() {
  let pool;
  try {
    console.log('Connessione al database...');
    pool = await sql.connect(dbConfig);
    console.log('Connesso.');

    const batches = [
      SQL_035_COMPLAINTS,
      SQL_035_SUPPLIERS,
      SQL_035_SUPPLIER_EVALUATIONS,
      SQL_035_FK
    ];

    for (const batch of batches) {
      const result = await pool.request().query(batch);
      if (result && result.recordset) console.log(result.recordset);
    }

    console.log('Migration 035 completata con successo.');
  } catch (err) {
    console.error('Errore migration 035:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

runMigration();
