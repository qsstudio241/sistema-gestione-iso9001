-- 067: Aggiunge standard_id a knowledge_chunks per filtro norma nell'assistente AI
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('knowledge_chunks') AND name = 'standard_id'
)
BEGIN
  ALTER TABLE knowledge_chunks ADD standard_id INT NULL;
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_knowledge_chunks_standard'
    AND object_id = OBJECT_ID('knowledge_chunks')
)
BEGIN
  CREATE INDEX IX_knowledge_chunks_standard
    ON knowledge_chunks(organization_id, standard_id);
END;
