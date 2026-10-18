-- TYPE: additive
-- BACKFILL: none
-- VERIFY: 178_verify.sql
-- ROLLBACK: 178_rollback.sql
--
-- Due date sul certificato oculistico (visita acuità e test dei colori).
-- Nullable: i record già presenti restano NULL e continuano a usare expiry_date.
-- Non è un backfill da PDF: le date si inseriscono a mano. Nessuna rielaborazione.
-- Nessuna FK e nessun ON DELETE.

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.qualifications', N'near_vision_expiry_date') IS NULL
BEGIN
    ALTER TABLE dbo.qualifications ADD near_vision_expiry_date DATE NULL;
    PRINT N'178: qualifications.near_vision_expiry_date aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.qualifications', N'colour_vision_expiry_date') IS NULL
BEGIN
    ALTER TABLE dbo.qualifications ADD colour_vision_expiry_date DATE NULL;
    PRINT N'178: qualifications.colour_vision_expiry_date aggiunta.';
END
GO
