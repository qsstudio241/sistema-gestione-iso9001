'use strict';

/**
 * Migration 083 — deadline_items + deadline_import_config
 * Tabelle per lo Scadenzario Unificato (ADR-013).
 *
 * IDEMPOTENTE: ogni step è wrappato in IF NOT EXISTS.
 * Per eseguire sul VPS:
 *   node backend/scripts/run-migration-083-vps.js
 * oppure via helper:
 *   .\backend\scripts\run-on-vps.ps1 -Script backend\scripts\run-migration-083-vps.js
 *
 * NON eseguire in produzione finché S3/S4 (endpoint API) non sono deployati.
 */

process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const { query } = require('/var/www/sgq-backend/src/config/database');

const STEPS = [
  // ??? 1. Tabella deadline_items ?????????????????????????????????????????????
  `IF NOT EXISTS (
      SELECT 1 FROM sys.objects WHERE name = 'deadline_items' AND type = 'U'
  )
  BEGIN
      CREATE TABLE dbo.deadline_items (
          id                  INT IDENTITY(1,1) NOT NULL,
          organization_id     INT               NOT NULL,
          company_id          INT               NULL,

          -- Origine file
          source_document_id  INT               NOT NULL,
          source_sheet_name   NVARCHAR(100)     NULL,
          source_row_number   INT               NULL,

          -- Contenuto estratto
          title               NVARCHAR(500)     NOT NULL,
          due_date            DATE              NOT NULL,
          category            NVARCHAR(100)     NULL,
          reference_code      NVARCHAR(100)     NULL,
          extra_data          NVARCHAR(MAX)     NULL,

          -- Assegnazione (default: admin studio)
          assigned_to         INT               NULL,
          assigned_email      NVARCHAR(255)     NULL,

          -- Stato operativo
          status              NVARCHAR(20)      NOT NULL DEFAULT 'active',
          completed_at        DATETIME          NULL,
          completed_by        INT               NULL,
          notes               NVARCHAR(MAX)     NULL,

          -- Alert (stessa logica documenti)
          alert_enabled       BIT               NOT NULL DEFAULT 1,

          -- Metadati
          created_by          INT               NOT NULL,
          created_at          DATETIME          NOT NULL DEFAULT GETDATE(),
          updated_at          DATETIME          NOT NULL DEFAULT GETDATE(),

          CONSTRAINT PK_deadline_items
              PRIMARY KEY (id),
          CONSTRAINT CK_deadline_items_status
              CHECK (status IN ('active', 'completed', 'dismissed', 'expired_acknowledged'))
      );
      PRINT 'Tabella deadline_items creata';
  END
  ELSE
      PRINT 'deadline_items già presente — skip';`,

  // ??? 2. FK deadline_items ? document_registry ?????????????????????????????
  `IF NOT EXISTS (
      SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_deadline_items_source'
  )
      ALTER TABLE dbo.deadline_items
      ADD CONSTRAINT FK_deadline_items_source
          FOREIGN KEY (source_document_id) REFERENCES dbo.document_registry(id);`,

  // ??? 3. FK deadline_items ? organizations ??????????????????????????????????
  `IF NOT EXISTS (
      SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_deadline_items_org'
  )
      ALTER TABLE dbo.deadline_items
      ADD CONSTRAINT FK_deadline_items_org
          FOREIGN KEY (organization_id) REFERENCES dbo.organizations(organization_id);`,

  // ??? 4. FK deadline_items ? companies ?????????????????????????????????????
  `IF NOT EXISTS (
      SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_deadline_items_company'
  )
      ALTER TABLE dbo.deadline_items
      ADD CONSTRAINT FK_deadline_items_company
          FOREIGN KEY (company_id) REFERENCES dbo.companies(id);`,

  // ??? 5. FK deadline_items ? users (assigned_to) ???????????????????????????
  `IF NOT EXISTS (
      SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_deadline_items_assigned'
  )
      ALTER TABLE dbo.deadline_items
      ADD CONSTRAINT FK_deadline_items_assigned
          FOREIGN KEY (assigned_to) REFERENCES dbo.users(user_id);`,

  // ??? 6. Indici deadline_items ??????????????????????????????????????????????
  `IF NOT EXISTS (
      SELECT 1 FROM sys.indexes WHERE name = 'IX_deadline_items_org_due' AND object_id = OBJECT_ID('deadline_items')
  )
      CREATE INDEX IX_deadline_items_org_due
          ON dbo.deadline_items (organization_id, due_date)
          WHERE status = 'active';`,

  `IF NOT EXISTS (
      SELECT 1 FROM sys.indexes WHERE name = 'IX_deadline_items_company' AND object_id = OBJECT_ID('deadline_items')
  )
      CREATE INDEX IX_deadline_items_company
          ON dbo.deadline_items (company_id, due_date)
          WHERE status = 'active';`,

  `IF NOT EXISTS (
      SELECT 1 FROM sys.indexes WHERE name = 'IX_deadline_items_source' AND object_id = OBJECT_ID('deadline_items')
  )
      CREATE INDEX IX_deadline_items_source
          ON dbo.deadline_items (source_document_id);`,

  `IF NOT EXISTS (
      SELECT 1 FROM sys.indexes WHERE name = 'IX_deadline_items_assigned' AND object_id = OBJECT_ID('deadline_items')
  )
      CREATE INDEX IX_deadline_items_assigned
          ON dbo.deadline_items (assigned_to)
          WHERE status = 'active';`,

  // ??? 7. Tabella deadline_import_config ????????????????????????????????????
  `IF NOT EXISTS (
      SELECT 1 FROM sys.objects WHERE name = 'deadline_import_config' AND type = 'U'
  )
  BEGIN
      CREATE TABLE dbo.deadline_import_config (
          id                  INT IDENTITY(1,1) NOT NULL,
          document_id         INT               NOT NULL,
          organization_id     INT               NOT NULL,
          company_id          INT               NULL,
          label               NVARCHAR(200)     NULL,
          sheet_name          NVARCHAR(100)     NULL,
          date_column         NVARCHAR(100)     NOT NULL,
          title_column        NVARCHAR(100)     NOT NULL,
          category_column     NVARCHAR(100)     NULL,
          reference_column    NVARCHAR(100)     NULL,
          visibility_days     INT               NOT NULL DEFAULT 30,
          auto_refresh        BIT               NOT NULL DEFAULT 0,
          last_import_at      DATETIME          NULL,
          last_import_rows    INT               NULL,

          CONSTRAINT PK_deadline_import_config
              PRIMARY KEY (id),
          CONSTRAINT UQ_deadline_import_config_doc
              UNIQUE (document_id)
      );
      PRINT 'Tabella deadline_import_config creata';
  END
  ELSE
      PRINT 'deadline_import_config già presente — skip';`,

  // ??? 8. FK deadline_import_config ? document_registry ????????????????????
  `IF NOT EXISTS (
      SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_di_config_doc'
  )
      ALTER TABLE dbo.deadline_import_config
      ADD CONSTRAINT FK_di_config_doc
          FOREIGN KEY (document_id) REFERENCES dbo.document_registry(id);`,

  // ??? 9. FK deadline_import_config ? organizations ?????????????????????????
  `IF NOT EXISTS (
      SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_di_config_org'
  )
      ALTER TABLE dbo.deadline_import_config
      ADD CONSTRAINT FK_di_config_org
          FOREIGN KEY (organization_id) REFERENCES dbo.organizations(organization_id);`,

  // ??? 10. FK deadline_import_config ? companies ????????????????????????????
  `IF NOT EXISTS (
      SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_di_config_company'
  )
      ALTER TABLE dbo.deadline_import_config
      ADD CONSTRAINT FK_di_config_company
          FOREIGN KEY (company_id) REFERENCES dbo.companies(id);`,

  // ??? 11. Indice deadline_import_config ????????????????????????????????????
  `IF NOT EXISTS (
      SELECT 1 FROM sys.indexes WHERE name = 'IX_di_config_org' AND object_id = OBJECT_ID('deadline_import_config')
  )
      CREATE INDEX IX_di_config_org
          ON dbo.deadline_import_config (organization_id, company_id);`,
];

(async () => {
  console.log('Migration 083 — deadline_items + deadline_import_config (ADR-013 Scadenzario)');
  try {
    for (let i = 0; i < STEPS.length; i++) {
      await query(STEPS[i]);
      console.log(`Step ${i + 1}/${STEPS.length} OK`);
    }

    // Verifica finale
    const verify = await query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME IN ('deadline_items', 'deadline_import_config')
      ORDER BY TABLE_NAME
    `);
    const found = verify.recordset.map(r => r.TABLE_NAME);
    if (!found.includes('deadline_items') || !found.includes('deadline_import_config')) {
      console.error('ERRORE: una o entrambe le tabelle non risultano create:', found);
      process.exit(1);
    }

    console.log('Migration 083 completata. Tabelle presenti:', found.join(', '));
    process.exit(0);
  } catch (e) {
    console.error('ERRORE migration 083:', e.message);
    process.exit(1);
  }
})();
