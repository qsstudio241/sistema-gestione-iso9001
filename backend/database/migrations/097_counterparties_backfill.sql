-- Migration 097: backfill controparti da testo 095 + projects.end_customer_id
-- Idempotente — non rimuove colonne snapshot commercial_customer_name/ref

-- 1) Crea controparti mancanti da commercial_cases (ruolo end_customer)
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'company_counterparties')
   AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'commercial_cases')
BEGIN
    INSERT INTO company_counterparties (
        organization_id, company_id, name, external_ref, role, is_active
    )
    SELECT DISTINCT
        cc.organization_id,
        cc.company_id,
        LTRIM(RTRIM(cc.commercial_customer_name)),
        NULLIF(LTRIM(RTRIM(cc.commercial_customer_ref)), ''),
        'end_customer',
        1
    FROM commercial_cases cc
    WHERE cc.company_id IS NOT NULL
      AND cc.commercial_customer_name IS NOT NULL
      AND LTRIM(RTRIM(cc.commercial_customer_name)) <> ''
      AND NOT EXISTS (
          SELECT 1
          FROM company_counterparties cp
          WHERE cp.organization_id = cc.organization_id
            AND cp.company_id = cc.company_id
            AND cp.role = 'end_customer'
            AND LOWER(LTRIM(RTRIM(cp.name))) = LOWER(LTRIM(RTRIM(cc.commercial_customer_name)))
            AND (
                (cp.external_ref IS NULL AND (cc.commercial_customer_ref IS NULL OR LTRIM(RTRIM(cc.commercial_customer_ref)) = ''))
                OR LOWER(LTRIM(RTRIM(ISNULL(cp.external_ref, '')))) =
                   LOWER(LTRIM(RTRIM(ISNULL(cc.commercial_customer_ref, ''))))
            )
      );
    PRINT 'Backfill company_counterparties da commercial_cases: ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' inserite.';
END
GO

-- 2) Collega commercial_customer_id e allinea snapshot name/ref
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('commercial_cases') AND name = 'commercial_customer_id')
BEGIN
    UPDATE cc
    SET cc.commercial_customer_id = cp.id,
        cc.commercial_customer_name = cp.name,
        cc.commercial_customer_ref = cp.external_ref
    FROM commercial_cases cc
    INNER JOIN company_counterparties cp
        ON cp.company_id = cc.company_id
       AND cp.organization_id = cc.organization_id
       AND cp.role = 'end_customer'
       AND cp.is_active = 1
       AND LOWER(LTRIM(RTRIM(cp.name))) = LOWER(LTRIM(RTRIM(cc.commercial_customer_name)))
    WHERE cc.commercial_customer_id IS NULL
      AND cc.company_id IS NOT NULL
      AND cc.commercial_customer_name IS NOT NULL
      AND LTRIM(RTRIM(cc.commercial_customer_name)) <> '';
    PRINT 'Backfill commercial_cases.commercial_customer_id: ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' aggiornati.';
END
GO

-- 3) projects.end_customer_id (nullable FK verso company_counterparties)
IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'projects' AND type = 'U')
   AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('projects') AND name = 'end_customer_id')
BEGIN
    ALTER TABLE projects ADD end_customer_id INT NULL;
    PRINT 'Colonna projects.end_customer_id aggiunta.';
END
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'projects' AND type = 'U')
   AND EXISTS (SELECT 1 FROM sys.objects WHERE name = 'company_counterparties' AND type = 'U')
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_projects_end_customer')
BEGIN
    ALTER TABLE projects
    ADD CONSTRAINT FK_projects_end_customer
        FOREIGN KEY (end_customer_id) REFERENCES company_counterparties(id);
    PRINT 'FK FK_projects_end_customer aggiunto.';
END
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'projects' AND type = 'U')
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('projects') AND name = 'IX_projects_end_customer')
BEGIN
    CREATE INDEX IX_projects_end_customer ON projects (end_customer_id);
    PRINT 'Indice IX_projects_end_customer creato.';
END
GO

-- 4) Backfill projects: crea controparti da client_name e collega end_customer_id
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('projects') AND name = 'end_customer_id')
   AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('projects') AND name = 'client_name')
BEGIN
    INSERT INTO company_counterparties (
        organization_id, company_id, name, role, is_active
    )
    SELECT DISTINCT
        p.organization_id,
        p.company_id,
        LTRIM(RTRIM(p.client_name)),
        'end_customer',
        1
    FROM projects p
    WHERE p.company_id IS NOT NULL
      AND p.client_name IS NOT NULL
      AND LTRIM(RTRIM(p.client_name)) <> ''
      AND NOT EXISTS (
          SELECT 1
          FROM company_counterparties cp
          WHERE cp.organization_id = p.organization_id
            AND cp.company_id = p.company_id
            AND cp.role = 'end_customer'
            AND LOWER(LTRIM(RTRIM(cp.name))) = LOWER(LTRIM(RTRIM(p.client_name)))
      );
    PRINT 'Backfill company_counterparties da projects.client_name: ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' inserite.';

    UPDATE p
    SET p.end_customer_id = cp.id
    FROM projects p
    INNER JOIN company_counterparties cp
        ON cp.company_id = p.company_id
       AND cp.organization_id = p.organization_id
       AND cp.role = 'end_customer'
       AND cp.is_active = 1
       AND LOWER(LTRIM(RTRIM(cp.name))) = LOWER(LTRIM(RTRIM(p.client_name)))
    WHERE p.end_customer_id IS NULL
      AND p.company_id IS NOT NULL
      AND p.client_name IS NOT NULL
      AND LTRIM(RTRIM(p.client_name)) <> '';
    PRINT 'Backfill projects.end_customer_id: ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' aggiornati.';
END
GO

PRINT 'Migration 097 completata.';
GO
