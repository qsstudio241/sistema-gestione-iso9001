IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'norm_chunks')
CREATE TABLE norm_chunks (
  id                  INT IDENTITY(1,1) PRIMARY KEY,
  document_source_id  INT NOT NULL,
  organization_id     INT NOT NULL,
  standard_code       NVARCHAR(50),
  chunk_index         INT NOT NULL,
  chunk_text          NVARCHAR(MAX) NOT NULL,
  embedding           NVARCHAR(MAX) NULL,
  token_count         INT,
  created_at          DATETIME2 DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_norm_chunks_org_std')
  CREATE INDEX IX_norm_chunks_org_std ON norm_chunks(organization_id, standard_code);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_norm_chunks_source')
  CREATE INDEX IX_norm_chunks_source ON norm_chunks(document_source_id);
