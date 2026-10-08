-- TYPE: additive
-- BACKFILL: none
-- VERIFY: n/a (solo schema, colonne NULL senza default)
-- ROLLBACK: n/a (drop solo in migrazione di cleanup successiva)
--
-- Migration 171: colonne input_* su dbo.management_reviews (riesame di direzione ISO 9001 §9.3.2).
-- Allinea TEST a PROD: su PROD le 4 colonne esistono come NVARCHAR(MAX) NULL senza default.
-- Su TEST mancavano (POST/PUT /management-reviews con questi campi dava "Invalid column name").
--   input_context_changes, input_customer_satisfaction,
--   input_process_performance, input_risk_effectiveness
-- Idempotente: ogni colonna ha il proprio guard COL_LENGTH e il proprio ALTER (statement separati).
-- Tabella assente (CI apply-on-empty / DB senza 112) -> no-op.

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.management_reviews', N'U') IS NULL
BEGIN
    PRINT N'171: dbo.management_reviews assente - skip (apply-on-empty).';
END
GO

IF OBJECT_ID(N'dbo.management_reviews', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.management_reviews', N'input_context_changes') IS NULL
BEGIN
    ALTER TABLE dbo.management_reviews ADD input_context_changes NVARCHAR(MAX) NULL;
    PRINT N'171: management_reviews.input_context_changes aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.management_reviews', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.management_reviews', N'input_customer_satisfaction') IS NULL
BEGIN
    ALTER TABLE dbo.management_reviews ADD input_customer_satisfaction NVARCHAR(MAX) NULL;
    PRINT N'171: management_reviews.input_customer_satisfaction aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.management_reviews', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.management_reviews', N'input_process_performance') IS NULL
BEGIN
    ALTER TABLE dbo.management_reviews ADD input_process_performance NVARCHAR(MAX) NULL;
    PRINT N'171: management_reviews.input_process_performance aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.management_reviews', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.management_reviews', N'input_risk_effectiveness') IS NULL
BEGIN
    ALTER TABLE dbo.management_reviews ADD input_risk_effectiveness NVARCHAR(MAX) NULL;
    PRINT N'171: management_reviews.input_risk_effectiveness aggiunta.';
END
GO
