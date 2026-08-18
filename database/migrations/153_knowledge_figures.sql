-- =============================================================================
-- Migration 153 — knowledge_figures (Multimodal RAG MR-1)
-- Tabella additiva: ritagli figura (bbox + PNG path + embedding CLIP locale).
-- Spazio vettoriale DISTINTO da knowledge_chunks (Gemini testo): colonna
-- embedding_space obbligatoria, niente mix di dimensioni/modelli.
-- Idempotente: IF NOT EXISTS su tabella, CHECK, indice.
-- Niente GO (lo script VPS esegue gli stessi statement a step).
-- Nessun ON DELETE CASCADE.
-- =============================================================================

SET NOCOUNT ON;

IF NOT EXISTS (
    SELECT 1 FROM sys.objects WHERE name = 'knowledge_figures' AND type = 'U'
)
BEGIN
    CREATE TABLE dbo.knowledge_figures (
        id                 INT            IDENTITY(1,1) NOT NULL,
        organization_id    INT            NOT NULL,
        company_id         INT            NULL,
        source_pdf         NVARCHAR(500)  NULL,
        page               INT            NOT NULL,
        bbox               NVARCHAR(120)  NOT NULL,
        kind               NVARCHAR(16)   NOT NULL,
        caption            NVARCHAR(500)  NULL,
        png_path           NVARCHAR(1000) NULL,
        embedding          NVARCHAR(MAX)  NULL,
        embedding_space    NVARCHAR(64)   NOT NULL,
        created_at         DATETIME2      NOT NULL
            CONSTRAINT DF_knowledge_figures_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_knowledge_figures PRIMARY KEY CLUSTERED (id)
    );
END

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints WHERE name = 'CK_knowledge_figures_kind'
)
BEGIN
    ALTER TABLE dbo.knowledge_figures
    ADD CONSTRAINT CK_knowledge_figures_kind
        CHECK (kind IN (N'raster', N'vector'));
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_knowledge_figures_org_space'
      AND object_id = OBJECT_ID('dbo.knowledge_figures')
)
BEGIN
    CREATE INDEX IX_knowledge_figures_org_space
        ON dbo.knowledge_figures (organization_id, embedding_space);
END
