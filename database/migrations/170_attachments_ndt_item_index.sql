-- TYPE: additive
-- BACKFILL: none
-- VERIFY: n/a (solo schema, nessuna riorganizzazione dati)
-- ROLLBACK: n/a (drop solo in migrazione di cleanup successiva)
--
-- Migration 170: indice filtrato IX_attachments_ndt_item su attachments.
-- Allinea TEST a PROD. La 108 crea colonna+indice nello stesso IF NOT EXISTS
-- sulla colonna: se la colonna c'è già, l'indice non viene creato.
-- Su PROD l'indice esiste (non unico, filtro ndt_report_item_id IS NOT NULL).
-- Su TEST la colonna c'è, l'indice manca. Priorità BASSA (solo perf, 235 allegati).
-- Idempotente. Tabella/colonna assente (CI apply-on-empty / gap pre-169) → no-op.
-- NON applicare su TEST/PROD in questa slice.

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.attachments', N'U') IS NULL
   OR COL_LENGTH(N'dbo.attachments', N'ndt_report_item_id') IS NULL
BEGIN
  PRINT N'170: attachments.ndt_report_item_id assente — skip (apply-on-empty / gap pre-169).';
END
ELSE IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_attachments_ndt_item'
      AND object_id = OBJECT_ID(N'dbo.attachments')
)
BEGIN
    CREATE INDEX IX_attachments_ndt_item
        ON dbo.attachments (ndt_report_item_id)
        WHERE ndt_report_item_id IS NOT NULL;
    PRINT N'170: IX_attachments_ndt_item creato.';
END
ELSE
    PRINT N'170: IX_attachments_ndt_item già presente — skip.';
