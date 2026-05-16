-- Migration 065: Add source_run_id to knowledge_chunks for AI-generated chunk audit trail
-- Idempotent: safe to re-run

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('knowledge_chunks') AND name = 'source_run_id'
)
BEGIN
  ALTER TABLE knowledge_chunks ADD source_run_id INT NULL;
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_knowledge_chunks_source_run'
)
BEGIN
  CREATE INDEX IX_knowledge_chunks_source_run ON knowledge_chunks(source_run_id)
  WHERE source_run_id IS NOT NULL;
END;
