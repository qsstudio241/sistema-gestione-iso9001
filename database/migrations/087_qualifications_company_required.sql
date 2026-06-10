-- Migration 087: company_id obbligatorio su qualifications + indice anti-duplicato cross-azienda
-- Idempotente. Eseguire backfill prima di NOT NULL.

-- 1) Backfill qualifiche orfane: prima azienda dell'organizzazione (MIN id)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'company_id')
BEGIN
    UPDATE q
    SET q.company_id = fb.fallback_company_id
    FROM qualifications q
    INNER JOIN (
        SELECT ao.organization_id, MIN(c.id) AS fallback_company_id
        FROM companies c
        INNER JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
        GROUP BY ao.organization_id
    ) fb ON fb.organization_id = q.organization_id
    WHERE q.company_id IS NULL;
END
GO

-- 2) NOT NULL (solo se colonna ancora nullable) — drop/ricrea indice su company_id
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_qualif_company' AND object_id = OBJECT_ID('qualifications'))
    DROP INDEX IX_qualif_company ON qualifications;
GO

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('qualifications')
      AND name = 'company_id'
      AND is_nullable = 1
)
BEGIN
    ALTER TABLE qualifications ALTER COLUMN company_id INT NOT NULL;
    PRINT 'Colonna qualifications.company_id impostata NOT NULL.';
END
ELSE
BEGIN
    PRINT 'Colonna qualifications.company_id già NOT NULL — nessuna modifica.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_qualif_company' AND object_id = OBJECT_ID('qualifications'))
    CREATE INDEX IX_qualif_company ON qualifications(company_id);
GO

-- 3) Indice unico filtrato: stesso certificato+persona per azienda (escluse revocate / senza numero)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_qualif_org_company_cert_person_active'
      AND object_id = OBJECT_ID('qualifications')
)
BEGIN
    CREATE UNIQUE INDEX UX_qualif_org_company_cert_person_active
        ON qualifications (organization_id, company_id, certificate_number, person_name)
        WHERE status <> 'revocata'
          AND certificate_number IS NOT NULL
          AND certificate_number <> '';
    PRINT 'Indice UX_qualif_org_company_cert_person_active creato.';
END
ELSE
BEGIN
    PRINT 'Indice UX_qualif_org_company_cert_person_active già presente.';
END
GO
