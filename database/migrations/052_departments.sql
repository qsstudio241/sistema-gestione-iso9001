-- Migration 052: tabella departments (reparti produttivi = fornitori interni)
-- ISO 9001:2015 §8.5 - Produzione e fornitura di servizi.
-- Struttura gerarchica via parent_id; collegamento opzionale a users per il responsabile.

CREATE TABLE departments (
    id               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_departments PRIMARY KEY,
    organization_id  INT NOT NULL,
    name             NVARCHAR(200) NOT NULL,
    code             NVARCHAR(50)  NULL,
    description      NVARCHAR(500) NULL,
    manager_name     NVARCHAR(200) NULL,
    manager_user_id  INT           NULL,
    parent_id        INT           NULL,
    is_active        BIT           NOT NULL DEFAULT 1,
    notes            NVARCHAR(MAX) NULL,
    created_by       INT           NULL,
    created_at       DATETIME2     NOT NULL DEFAULT GETDATE(),
    updated_at       DATETIME2     NOT NULL DEFAULT GETDATE()
);
ALTER TABLE departments ADD CONSTRAINT FK_departments_org FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
ALTER TABLE departments ADD CONSTRAINT FK_departments_parent FOREIGN KEY (parent_id) REFERENCES departments(id);
ALTER TABLE departments ADD CONSTRAINT UQ_departments_code UNIQUE (organization_id, code);
CREATE INDEX IX_departments_org ON departments(organization_id);
