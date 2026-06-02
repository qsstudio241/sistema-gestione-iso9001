-- Estensioni modulo riesame requisiti: chiarimenti, link document registry, allegati caso

-- Chiarimenti cliente (stato CLARIFICATION)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'commercial_case_clarifications' AND schema_id = SCHEMA_ID('dbo'))
CREATE TABLE commercial_case_clarifications (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  case_id         INT           NOT NULL,
  message         NVARCHAR(MAX) NOT NULL,
  due_date        DATE          NULL,
  response_text   NVARCHAR(MAX) NULL,
  resolved_at     DATETIME2     NULL,
  created_by      INT           NOT NULL,
  created_at      DATETIME2     NOT NULL DEFAULT GETDATE(),
  updated_at      DATETIME2     NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_cccl_case' AND object_id = OBJECT_ID('dbo.commercial_case_clarifications'))
  CREATE INDEX IX_cccl_case ON commercial_case_clarifications(case_id);

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_cccl_case'
)
BEGIN
  ALTER TABLE commercial_case_clarifications
  ADD CONSTRAINT FK_cccl_case FOREIGN KEY (case_id) REFERENCES commercial_cases(id);
END;

-- Collegamento documenti registro al caso commerciale
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'commercial_case_documents' AND schema_id = SCHEMA_ID('dbo'))
CREATE TABLE commercial_case_documents (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  case_id         INT           NOT NULL,
  document_id     INT           NOT NULL,
  doc_role        NVARCHAR(30)  NOT NULL DEFAULT 'other',
  direction       NVARCHAR(10)  NOT NULL DEFAULT 'in'
    CONSTRAINT CK_ccd_direction CHECK (direction IN ('in','out')),
  counterparty    NVARCHAR(20)  NOT NULL DEFAULT 'customer'
    CONSTRAINT CK_ccd_counterparty CHECK (counterparty IN ('customer','supplier','internal')),
  linked_by       INT           NOT NULL,
  linked_at       DATETIME2     NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ccd_case' AND object_id = OBJECT_ID('dbo.commercial_case_documents'))
  CREATE INDEX IX_ccd_case ON commercial_case_documents(case_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_ccd_case_doc' AND object_id = OBJECT_ID('dbo.commercial_case_documents'))
  CREATE UNIQUE INDEX UQ_ccd_case_doc ON commercial_case_documents(case_id, document_id);

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ccd_case'
)
BEGIN
  ALTER TABLE commercial_case_documents
  ADD CONSTRAINT FK_ccd_case FOREIGN KEY (case_id) REFERENCES commercial_cases(id);
END;

-- Allegati legati al caso (senza audit/nc)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.attachments') AND name = 'commercial_case_id'
)
BEGIN
  ALTER TABLE dbo.attachments ADD commercial_case_id INT NULL;
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.attachments') AND name = 'commercial_direction'
)
BEGIN
  ALTER TABLE dbo.attachments ADD commercial_direction NVARCHAR(10) NULL;
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.attachments') AND name = 'commercial_counterparty'
)
BEGIN
  ALTER TABLE dbo.attachments ADD commercial_counterparty NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.attachments') AND name = 'commercial_doc_role'
)
BEGIN
  ALTER TABLE dbo.attachments ADD commercial_doc_role NVARCHAR(30) NULL;
END;

GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_attachments_commercial_case' AND object_id = OBJECT_ID('dbo.attachments'))
  CREATE INDEX IX_attachments_commercial_case ON attachments(commercial_case_id)
    WHERE commercial_case_id IS NOT NULL;
