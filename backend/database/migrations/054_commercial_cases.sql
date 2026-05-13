-- Commercial cases (contract review / riesame requisiti)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'commercial_cases' AND schema_id = SCHEMA_ID('dbo'))
CREATE TABLE commercial_cases (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  uuid            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
  organization_id INT           NOT NULL,
  company_id      INT           NULL,
  title           NVARCHAR(255) NOT NULL,
  external_ref    NVARCHAR(100) NULL,
  status          NVARCHAR(30)  NOT NULL DEFAULT 'DRAFT'
    CONSTRAINT CK_cc_status CHECK (status IN (
      'DRAFT','INTAKE_REVIEW','CLARIFICATION','QUOTE_PREP',
      'QUOTE_APPROVAL','QUOTE_SENT','ORDER_RECEIVED',
      'FINAL_REVIEW','APPROVED','CANCELLED','REJECTED'
    )),
  current_assignee_id INT      NULL,
  notes           NVARCHAR(MAX) NULL,
  created_by      INT           NOT NULL,
  created_at      DATETIME2     NOT NULL DEFAULT GETDATE(),
  updated_at      DATETIME2     NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_cc_uuid' AND object_id = OBJECT_ID('dbo.commercial_cases'))
  CREATE UNIQUE INDEX IX_cc_uuid ON commercial_cases(uuid);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_cc_org' AND object_id = OBJECT_ID('dbo.commercial_cases'))
  CREATE INDEX IX_cc_org ON commercial_cases(organization_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_cc_status' AND object_id = OBJECT_ID('dbo.commercial_cases'))
  CREATE INDEX IX_cc_status ON commercial_cases(status);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_cc_company' AND object_id = OBJECT_ID('dbo.commercial_cases'))
  CREATE INDEX IX_cc_company ON commercial_cases(company_id);

-- State transition history (audit trail per ISO 9001 §7.5)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'commercial_case_history' AND schema_id = SCHEMA_ID('dbo'))
CREATE TABLE commercial_case_history (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  case_id         INT           NOT NULL,
  from_status     NVARCHAR(30)  NULL,
  to_status       NVARCHAR(30)  NOT NULL,
  changed_by      INT           NOT NULL,
  reason          NVARCHAR(500) NULL,
  created_at      DATETIME2     NOT NULL DEFAULT GETDATE(),
  CONSTRAINT FK_cch_case FOREIGN KEY (case_id) REFERENCES commercial_cases(id)
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_cch_case' AND object_id = OBJECT_ID('dbo.commercial_case_history'))
  CREATE INDEX IX_cch_case ON commercial_case_history(case_id);

-- Checklist riesame (preliminary + final review)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'commercial_case_checklist' AND schema_id = SCHEMA_ID('dbo'))
CREATE TABLE commercial_case_checklist (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  case_id         INT           NOT NULL,
  phase           NVARCHAR(20)  NOT NULL DEFAULT 'preliminary'
    CONSTRAINT CK_ccl_phase CHECK (phase IN ('preliminary','final')),
  item_ref        NVARCHAR(30)  NOT NULL,
  item_text       NVARCHAR(500) NOT NULL,
  answer          NVARCHAR(10)  NULL
    CONSTRAINT CK_ccl_answer CHECK (answer IN ('yes','no','na','partial') OR answer IS NULL),
  notes           NVARCHAR(MAX) NULL,
  ai_suggested    BIT           NOT NULL DEFAULT 0,
  ai_confidence   DECIMAL(3,2)  NULL,
  answered_by     INT           NULL,
  answered_at     DATETIME2     NULL,
  CONSTRAINT FK_ccl_case FOREIGN KEY (case_id) REFERENCES commercial_cases(id)
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ccl_case_phase' AND object_id = OBJECT_ID('dbo.commercial_case_checklist'))
  CREATE INDEX IX_ccl_case_phase ON commercial_case_checklist(case_id, phase);
