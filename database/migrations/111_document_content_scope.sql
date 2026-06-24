-- ============================================================================
-- Migration 111: content_scope su document_registry + template Patrimonio Studio
-- ============================================================================
-- Obiettivo (decisione di prodotto): rendere ESPLICITO l'ambito di ogni documento
-- ("explicit over implicit"), senza piu' dedurre il know-how dello studio dal
-- semplice campo azienda vuoto (company_id NULL).
--
-- content_scope:
--   'client'    -> documento di una specifica azienda cliente (company_id valorizzato)
--   'studio'    -> patrimonio/know-how dello studio (Patrimonio Studio, company_id NULL)
--   'reference' -> norme / riferimenti tecnici condivisi (company_id NULL)
--
-- Puramente ADDITIVA e IDEMPOTENTE: colonna nullable con DEFAULT 'client',
-- nessuna perdita dati. Il backfill aggiorna SOLO i record con content_scope NULL.
-- NON applicare automaticamente in produzione senza verifica.
-- ============================================================================

USE SGQ_ISO9001;
GO

SET NOCOUNT ON;
PRINT '';
PRINT '================================================================================';
PRINT 'Migration 111: document_registry.content_scope + Patrimonio Studio';
PRINT '================================================================================';
PRINT '';

-- --- 1. Colonna content_scope -----------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('document_registry') AND name = 'content_scope'
)
BEGIN
    ALTER TABLE dbo.document_registry ADD content_scope NVARCHAR(20) NULL;
    PRINT '  Colonna content_scope aggiunta a document_registry';
END
ELSE
    PRINT '  Colonna content_scope gia presente - skip';
GO

-- --- 2. CHECK constraint (NULL ammesso per retrocompatibilita) ---------------
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_doc_registry_content_scope')
BEGIN
    ALTER TABLE dbo.document_registry WITH NOCHECK
        ADD CONSTRAINT CK_doc_registry_content_scope
        CHECK (content_scope IS NULL OR content_scope IN ('client','studio','reference'));
    PRINT '  CHECK CK_doc_registry_content_scope creato';
END
ELSE
    PRINT '  CHECK CK_doc_registry_content_scope gia presente - skip';
GO

-- --- 3. DEFAULT 'client' (rete di sicurezza per nuovi insert) ----------------
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_doc_registry_content_scope')
BEGIN
    ALTER TABLE dbo.document_registry
        ADD CONSTRAINT DF_doc_registry_content_scope DEFAULT 'client' FOR content_scope;
    PRINT '  DEFAULT DF_doc_registry_content_scope creato';
END
ELSE
    PRINT '  DEFAULT DF_doc_registry_content_scope gia presente - skip';
GO

-- --- 4. Indice per query per ambito ------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_doc_registry_content_scope' AND object_id = OBJECT_ID('document_registry'))
BEGIN
    CREATE INDEX IX_doc_registry_content_scope
        ON dbo.document_registry(organization_id, content_scope);
    PRINT '  Indice IX_doc_registry_content_scope creato';
END
ELSE
    PRINT '  Indice IX_doc_registry_content_scope gia presente - skip';
GO

-- --- 5. Backfill (solo record non ancora classificati) -----------------------
-- Regola documentata:
--   a) company_id valorizzato                          -> 'client'
--   b) norme (doc_type='norma')                        -> 'reference'
--   c) cartelle di sistema condivise (company_id NULL) -> 'reference'
--      (restano visibili nelle viste azienda; solo 'studio' viene escluso)
--   d) altri company_id NULL                           -> 'studio'
--      (default prudente: know-how dello studio)

UPDATE dbo.document_registry
   SET content_scope = 'client'
 WHERE content_scope IS NULL AND company_id IS NOT NULL;
PRINT '  Backfill (a) client: documenti con company_id';
GO

UPDATE dbo.document_registry
   SET content_scope = 'reference'
 WHERE content_scope IS NULL AND company_id IS NULL AND doc_type = 'norma';
PRINT '  Backfill (b) reference: norme';
GO

UPDATE dbo.document_registry
   SET content_scope = 'reference'
 WHERE content_scope IS NULL AND company_id IS NULL AND ISNULL(is_system_folder, 0) = 1;
PRINT '  Backfill (c) reference: cartelle di sistema condivise';
GO

UPDATE dbo.document_registry
   SET content_scope = 'studio'
 WHERE content_scope IS NULL AND company_id IS NULL;
PRINT '  Backfill (d) studio: restante know-how studio';
GO

-- --- 6. Seed template albero "Patrimonio Studio" -----------------------------
-- Riusa il meccanismo document_tree_templates (migration 059).
-- La radice (folder_code 'STD') e i figli verranno provisionati per studio con
-- company_id NULL e content_scope='studio' tramite il provisioner runtime.
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'document_tree_templates' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.document_tree_templates WHERE template_code = 'studio_patrimonio_v1')
    BEGIN
        INSERT INTO dbo.document_tree_templates (template_code, name, description, structure, applicable_standards, is_default)
        VALUES (
            'studio_patrimonio_v1',
            'Patrimonio Studio',
            'Contenitore documentale del know-how dello studio (modelli, procedure interne, linee guida, riferimenti). Mai visibile nelle viste delle aziende clienti.',
            N'[
  {"code":"STD","title":"PATRIMONIO STUDIO","children":[
    {"code":"STD.1","title":"MODELLI E TEMPLATE"},
    {"code":"STD.2","title":"PROCEDURE INTERNE STUDIO"},
    {"code":"STD.3","title":"KNOW-HOW E LINEE GUIDA"},
    {"code":"STD.4","title":"NORME E RIFERIMENTI"},
    {"code":"STD.5","title":"FORMAZIONE E COMPETENZE"}
  ]}
]',
            NULL,
            0
        );
        PRINT '  Template studio_patrimonio_v1 inserito';
    END
    ELSE
        PRINT '  Template studio_patrimonio_v1 gia presente - skip';
END
ELSE
    PRINT '  Tabella document_tree_templates assente - seed template saltato';
GO

PRINT '';
PRINT 'Migration 111 completata.';
GO
