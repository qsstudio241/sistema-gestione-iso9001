IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'knowledge_chunks')
CREATE TABLE knowledge_chunks (
  id                INT IDENTITY(1,1) PRIMARY KEY,
  organization_id   INT NOT NULL,
  entity_type       NVARCHAR(50) NOT NULL,
  entity_id         INT NULL,
  chunk_text        NVARCHAR(MAX) NOT NULL,
  embedding         NVARCHAR(MAX) NULL,
  last_indexed_at   DATETIME2 DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_knowledge_chunks_org')
  CREATE INDEX IX_knowledge_chunks_org ON knowledge_chunks(organization_id, entity_type);
