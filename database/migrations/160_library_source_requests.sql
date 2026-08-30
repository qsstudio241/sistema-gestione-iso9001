-- =============================================================================
-- Migration 160 — library_source_requests (LG-1 Gap fonti)
-- Richieste lacune know-how rilevate dall'assistente AI o create in Libreria.
-- Persistenza server (non localStorage). Idempotente: IF NOT EXISTS.
-- Niente GO. Nessun ON DELETE CASCADE.
-- =============================================================================

SET NOCOUNT ON;

IF NOT EXISTS (
    SELECT 1 FROM sys.objects WHERE name = 'library_source_requests' AND type = 'U'
)
BEGIN
    CREATE TABLE dbo.library_source_requests (
        id                           INT            IDENTITY(1,1) NOT NULL,
        requesting_organization_id   INT            NOT NULL,
        requesting_user_id           INT            NULL,
        company_id                   INT            NULL,
        source_code                  NVARCHAR(200)  NOT NULL,
        source_title                 NVARCHAR(500)  NULL,
        reason                       NVARCHAR(MAX)  NULL,
        quality_notes                NVARCHAR(MAX)  NULL,
        closure_path                 NVARCHAR(32)   NOT NULL
            CONSTRAINT DF_lsr_closure_path DEFAULT N'platform',
        status                       NVARCHAR(32)   NOT NULL
            CONSTRAINT DF_lsr_status DEFAULT N'open',
        chat_message_preview         NVARCHAR(500)  NULL,
        email_notified_at            DATETIME2      NULL,
        created_at                   DATETIME2      NOT NULL
            CONSTRAINT DF_lsr_created_at DEFAULT SYSUTCDATETIME(),
        updated_at                   DATETIME2      NOT NULL
            CONSTRAINT DF_lsr_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_library_source_requests PRIMARY KEY CLUSTERED (id)
    );
END

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints WHERE name = 'CK_lsr_closure_path'
)
BEGIN
    ALTER TABLE dbo.library_source_requests
    ADD CONSTRAINT CK_lsr_closure_path
        CHECK (closure_path IN (N'platform', N'tenant'));
END

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints WHERE name = 'CK_lsr_status'
)
BEGIN
    ALTER TABLE dbo.library_source_requests
    ADD CONSTRAINT CK_lsr_status
        CHECK (status IN (N'open', N'in_progress', N'digitized', N'closed'));
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_lsr_org_code_status'
      AND object_id = OBJECT_ID('dbo.library_source_requests')
)
BEGIN
    CREATE INDEX IX_lsr_org_code_status
        ON dbo.library_source_requests (requesting_organization_id, source_code, status);
END
