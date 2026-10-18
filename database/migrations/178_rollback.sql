-- Rollback di 178_qualifications_vision_clocks.sql (NON eseguito dal runner).
-- Elimina le due date oculistiche già registrate. Fare un backup prima.
-- Idempotente. Non tocca expiry_date.

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.qualifications', N'near_vision_expiry_date') IS NOT NULL
BEGIN
    ALTER TABLE dbo.qualifications DROP COLUMN near_vision_expiry_date;
    PRINT N'178 rollback: near_vision_expiry_date rimossa.';
END
GO

IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.qualifications', N'colour_vision_expiry_date') IS NOT NULL
BEGIN
    ALTER TABLE dbo.qualifications DROP COLUMN colour_vision_expiry_date;
    PRINT N'178 rollback: colour_vision_expiry_date rimossa.';
END
GO
