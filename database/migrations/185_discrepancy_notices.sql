-- TYPE: additive
-- BACKFILL: none
-- VERIFY: 185_verify.sql
-- ROLLBACK: 185_rollback.sql
--
-- Avvisi di discrepanza (WPQR, poi WPS e qualifiche saldatore).
-- Solo lo stato dell'azione umana. Il testo si ricalcola dalle regole.
-- Nessun dato esistente viene riscritto. Nessuna FK e nessun ON DELETE.
-- Non è un campo riletto dal PDF: niente voce in Rielaborazioni.
-- Apply: solo TEST, dopo backup COPY_ONLY + CHECKSUM + VERIFYONLY.
-- PROD: non applicare da questo script.

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.discrepancy_notices', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.discrepancy_notices (
        id               INT IDENTITY(1,1) NOT NULL,
        organization_id  INT            NOT NULL,
        domain           NVARCHAR(40)   NOT NULL,
        entity_id        INT            NOT NULL,
        rule_code        NVARCHAR(80)   NOT NULL,
        fingerprint      NVARCHAR(80)   NOT NULL,
        status           NVARCHAR(20)   NOT NULL CONSTRAINT DF_discrepancy_notices_status DEFAULT N'aperto',
        message_it       NVARCHAR(1000) NULL,
        note             NVARCHAR(500)  NULL,
        acted_by         INT            NULL,
        acted_at         DATETIME2(7)   NULL,
        created_at       DATETIME2(7)   NOT NULL CONSTRAINT DF_discrepancy_notices_created DEFAULT SYSUTCDATETIME(),
        updated_at       DATETIME2(7)   NOT NULL CONSTRAINT DF_discrepancy_notices_updated DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_discrepancy_notices PRIMARY KEY CLUSTERED (id)
    );
    PRINT N'185: tabella discrepancy_notices creata.';
END
ELSE
    PRINT N'185: discrepancy_notices già presente - skip.';
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'material_group_range') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD material_group_range NVARCHAR(80) NULL;
    PRINT N'185: wpqr_records.material_group_range aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'fillet_throat_range') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD fillet_throat_range NVARCHAR(80) NULL;
    PRINT N'185: wpqr_records.fillet_throat_range aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.discrepancy_notices', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE name = N'CK_discrepancy_notices_status'
          AND parent_object_id = OBJECT_ID(N'dbo.discrepancy_notices')
   )
BEGIN
    ALTER TABLE dbo.discrepancy_notices ADD CONSTRAINT CK_discrepancy_notices_status
        CHECK (status IN (N'aperto', N'confermato', N'in_correzione', N'segnalato', N'corretto'));
    PRINT N'185: check status aggiunto.';
END
GO

IF OBJECT_ID(N'dbo.discrepancy_notices', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'UX_discrepancy_notices_entity_rule'
          AND object_id = OBJECT_ID(N'dbo.discrepancy_notices')
   )
BEGIN
    CREATE UNIQUE INDEX UX_discrepancy_notices_entity_rule
        ON dbo.discrepancy_notices (organization_id, domain, entity_id, rule_code, fingerprint);
    PRINT N'185: indice univoco avviso aggiunto.';
END
GO
