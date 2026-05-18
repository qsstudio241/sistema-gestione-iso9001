-- Migration 066: Document Registry — collegamento audit + align status CHECK
-- Data: 2026-05-18
-- Scopo:
--   1. Aggiunge colonna audit_id (INT NULL) e audit_uuid (NVARCHAR(36) NULL) a
--      document_registry per il tie-in audit → registro (ADR-009 Fase 5).
--   2. Allinea il CHECK su status con i valori effettivi usati dal controller
--      (aggiunge 'rilasciato' e 'bozza' che mancavano in migration 029).
--   3. Aggiunge type_specific_data (NVARCHAR(MAX) NULL) se non ancora presente.
-- Idempotente: sicura da rieseguire.

USE SGQ_ISO9001;
GO

SET NOCOUNT ON;
PRINT '';
PRINT '================================================================================';
PRINT 'Migration 066: document_registry — audit link + status CHECK align';
PRINT '================================================================================';
PRINT '';

-- 1. Colonna audit_id (FK a audits.audit_id)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.document_registry') AND name = 'audit_id'
)
BEGIN
    ALTER TABLE dbo.document_registry ADD audit_id INT NULL;
    PRINT '  Colonna audit_id aggiunta a document_registry';
END
ELSE
    PRINT '  Colonna audit_id gia presente';
GO

-- 2. Colonna audit_uuid (per riferimento al UUID dell''audit)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.document_registry') AND name = 'audit_uuid'
)
BEGIN
    ALTER TABLE dbo.document_registry ADD audit_uuid NVARCHAR(36) NULL;
    PRINT '  Colonna audit_uuid aggiunta a document_registry';
END
ELSE
    PRINT '  Colonna audit_uuid gia presente';
GO

-- 3. Colonna type_specific_data (usata dal controller, potrebbe mancare)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.document_registry') AND name = 'type_specific_data'
)
BEGIN
    ALTER TABLE dbo.document_registry ADD type_specific_data NVARCHAR(MAX) NULL;
    PRINT '  Colonna type_specific_data aggiunta a document_registry';
END
ELSE
    PRINT '  Colonna type_specific_data gia presente';
GO

-- 4. FK audit_id → audits.audit_id (nullable, NO ACTION per evitare cicli con soft-delete)
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_doc_registry_audit_id'
    AND parent_object_id = OBJECT_ID('dbo.document_registry')
)
BEGIN
    ALTER TABLE dbo.document_registry
    ADD CONSTRAINT FK_doc_registry_audit_id
        FOREIGN KEY (audit_id) REFERENCES dbo.audits(audit_id)
        ON DELETE SET NULL;
    PRINT '  FK FK_doc_registry_audit_id creata';
END
ELSE
    PRINT '  FK FK_doc_registry_audit_id gia presente';
GO

-- 5. Indice per lookup veloce per audit_id
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_doc_registry_audit_id'
    AND object_id = OBJECT_ID('dbo.document_registry')
)
BEGIN
    CREATE INDEX IX_doc_registry_audit_id
        ON dbo.document_registry (audit_id)
        WHERE audit_id IS NOT NULL;
    PRINT '  Indice IX_doc_registry_audit_id creato';
END
ELSE
    PRINT '  Indice IX_doc_registry_audit_id gia presente';
GO

-- 6. Allinea CHECK constraint su status.
--    La migration 029 aveva solo: vigente, in_revisione, obsoleto, in_approvazione.
--    Il controller usa anche: rilasciato, bozza.
--    Strategia: se il constraint CK_doc_registry_status esiste ancora con la
--    definizione vecchia, lo ricreiamo con il set completo.
IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_doc_registry_status'
    AND parent_object_id = OBJECT_ID('dbo.document_registry')
)
BEGIN
    -- Verifica se contiene 'rilasciato' nella definizione
    DECLARE @def NVARCHAR(MAX);
    SELECT @def = DEFINITION FROM sys.check_constraints
    WHERE name = 'CK_doc_registry_status'
    AND parent_object_id = OBJECT_ID('dbo.document_registry');

    IF CHARINDEX(N'rilasciato', @def) = 0
    BEGIN
        -- Il constraint non include rilasciato: drop e ricrea
        ALTER TABLE dbo.document_registry
            DROP CONSTRAINT CK_doc_registry_status;
        PRINT '  Vecchio CK_doc_registry_status rimosso';

        ALTER TABLE dbo.document_registry
            ADD CONSTRAINT CK_doc_registry_status
            CHECK (status IN (
                'vigente', 'rilasciato', 'bozza',
                'in_revisione', 'in_approvazione', 'obsoleto'
            ));
        PRINT '  Nuovo CK_doc_registry_status creato con tutti i valori';
    END
    ELSE
        PRINT '  CK_doc_registry_status gia allineato';
END
ELSE
BEGIN
    -- Constraint non esiste: crea dal nuovo
    ALTER TABLE dbo.document_registry
        ADD CONSTRAINT CK_doc_registry_status
        CHECK (status IN (
            'vigente', 'rilasciato', 'bozza',
            'in_revisione', 'in_approvazione', 'obsoleto'
        ));
    PRINT '  CK_doc_registry_status creato';
END
GO

PRINT '';
PRINT 'Migration 066 completata.';
GO
