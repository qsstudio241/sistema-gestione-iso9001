-- 066: Note di contesto studio per l'assistente AI (Livello 1 — profilo organizzazione)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.organizations') AND name = N'ai_context_notes'
)
BEGIN
  ALTER TABLE dbo.organizations ADD ai_context_notes NVARCHAR(2000) NULL;
END;
