-- Migration 069: consentire allegati con solo commercial_case_id (Riesame requisiti)
-- Fix smoke import-from-job: CHK_attachments_parent ignorava commercial_case_id (068)

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CHK_attachments_parent')
BEGIN
    ALTER TABLE dbo.attachments DROP CONSTRAINT CHK_attachments_parent;
    PRINT 'Constraint CHK_attachments_parent rimosso.';
END
GO

ALTER TABLE dbo.attachments
ADD CONSTRAINT CHK_attachments_parent CHECK (
    audit_id IS NOT NULL
    OR nc_id IS NOT NULL
    OR document_id IS NOT NULL
    OR custom_item_id IS NOT NULL
    OR commercial_case_id IS NOT NULL
);
GO

PRINT 'Constraint CHK_attachments_parent aggiornato con commercial_case_id.';
GO
