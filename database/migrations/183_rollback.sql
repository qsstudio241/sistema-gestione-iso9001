-- Rollback di 183_weld_sketches.sql (NON eseguito dal runner).
-- Rimuove le due colonne WPS e la tabella libreria. Fare un backup prima. Idempotente.

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'sequence_sketch_id') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN sequence_sketch_id;
    PRINT N'183 rollback: sequence_sketch_id rimossa.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'joint_sketch_id') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN joint_sketch_id;
    PRINT N'183 rollback: joint_sketch_id rimossa.';
END
GO

IF OBJECT_ID(N'dbo.weld_sketches', N'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.weld_sketches;
    PRINT N'183 rollback: tabella weld_sketches rimossa.';
END
GO
