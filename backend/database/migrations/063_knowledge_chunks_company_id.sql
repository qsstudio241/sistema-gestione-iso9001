-- 063: Aggiunge company_id a knowledge_chunks per filtro contesto azienda nell'assistente AI
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('knowledge_chunks') AND name = 'company_id'
)
BEGIN
  ALTER TABLE knowledge_chunks ADD company_id INT NULL;
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_knowledge_chunks_company'
    AND object_id = OBJECT_ID('knowledge_chunks')
)
BEGIN
  CREATE INDEX IX_knowledge_chunks_company
    ON knowledge_chunks(organization_id, company_id);
END;
