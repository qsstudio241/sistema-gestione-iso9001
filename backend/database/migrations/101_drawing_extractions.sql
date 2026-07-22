-- Migration 101 — Estrazione automatica requisiti tecnici dai disegni di commessa
-- Provider-agnostic (gemini ora, werk24 in futuro). Scope multi-tenant obbligatorio.
-- Pattern SQL Server idempotente: IF NOT EXISTS, ALTER/ADD CONSTRAINT/CREATE INDEX separati.

-- 1) Job di estrazione: una riga per ciascun tentativo su un documento/allegato di commessa
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'commercial_case_drawing_extractions' AND schema_id = SCHEMA_ID('dbo'))
CREATE TABLE commercial_case_drawing_extractions (
  id               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ccde PRIMARY KEY,
  organization_id  INT           NOT NULL,
  case_id          INT           NOT NULL,
  document_id      INT           NULL,
  attachment_id    INT           NULL,
  provider         NVARCHAR(30)  NOT NULL DEFAULT 'gemini',
  external_job_id  NVARCHAR(200) NULL,
  status           NVARCHAR(20)  NOT NULL DEFAULT 'pending'
    CONSTRAINT CK_ccde_status CHECK (status IN ('pending','processing','done','error')),
  raw_response     NVARCHAR(MAX) NULL,
  error_message    NVARCHAR(MAX) NULL,
  page_count       INT           NULL,
  created_by       INT           NULL,
  created_at       DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
  completed_at     DATETIME2     NULL
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ccde_case' AND object_id = OBJECT_ID('dbo.commercial_case_drawing_extractions'))
  CREATE INDEX IX_ccde_case ON commercial_case_drawing_extractions(case_id, created_at DESC);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ccde_org' AND object_id = OBJECT_ID('dbo.commercial_case_drawing_extractions'))
  CREATE INDEX IX_ccde_org ON commercial_case_drawing_extractions(organization_id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ccde_case')
BEGIN
  ALTER TABLE commercial_case_drawing_extractions
  ADD CONSTRAINT FK_ccde_case FOREIGN KEY (case_id) REFERENCES commercial_cases(id);
END;

-- 2) Requisiti estratti normalizzati (un record per requisito), con revisione umana
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'commercial_case_extracted_requirements' AND schema_id = SCHEMA_ID('dbo'))
CREATE TABLE commercial_case_extracted_requirements (
  id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ccer PRIMARY KEY,
  extraction_id  INT           NOT NULL,
  req_type       NVARCHAR(30)  NOT NULL
    CONSTRAINT CK_ccer_req_type CHECK (req_type IN
      ('dimension','tolerance','gdt','material','weld_symbol','surface','note','title_block')),
  field_key      NVARCHAR(100) NULL,
  value_text     NVARCHAR(MAX) NULL,
  unit           NVARCHAR(30)  NULL,
  confidence     DECIMAL(5,4)  NULL,
  source_bbox    NVARCHAR(200) NULL,
  review_status  NVARCHAR(20)  NOT NULL DEFAULT 'extracted'
    CONSTRAINT CK_ccer_review_status CHECK (review_status IN ('extracted','confirmed','rejected','edited')),
  reviewed_by    INT           NULL,
  created_at     DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ccer_extraction' AND object_id = OBJECT_ID('dbo.commercial_case_extracted_requirements'))
  CREATE INDEX IX_ccer_extraction ON commercial_case_extracted_requirements(extraction_id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ccer_extraction')
BEGIN
  ALTER TABLE commercial_case_extracted_requirements
  ADD CONSTRAINT FK_ccer_extraction FOREIGN KEY (extraction_id)
    REFERENCES commercial_case_drawing_extractions(id);
END;
