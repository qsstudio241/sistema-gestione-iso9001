IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'norm_requirements')
CREATE TABLE norm_requirements (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  standard_code   NVARCHAR(50)  NOT NULL,
  clause_ref      NVARCHAR(30)  NOT NULL,
  clause_title    NVARCHAR(500),
  requirement_text NVARCHAR(MAX) NOT NULL,
  applicability   NVARCHAR(200),
  linked_legislation NVARCHAR(500),
  source          NVARCHAR(50)  NOT NULL DEFAULT 'local_file',
  source_url      NVARCHAR(500),
  last_synced_at  DATETIME2     NOT NULL DEFAULT GETDATE(),
  norm_version    NVARCHAR(20),
  is_current      BIT           NOT NULL DEFAULT 1,
  CONSTRAINT UQ_norm_req UNIQUE (standard_code, clause_ref, norm_version)
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_norm_req_code')
  CREATE INDEX IX_norm_req_code ON norm_requirements(standard_code);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_norm_req_clause')
  CREATE INDEX IX_norm_req_clause ON norm_requirements(clause_ref);
