-- ============================================================
-- Migration 090: template Word scheda NC (scope nc)
-- Assegnazione per organizzazione + seed modello di sistema
-- Eseguire con: node backend/scripts/run-migration-090.js
-- ============================================================

-- Estendi scope ammessi su report_templates
IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_report_templates_scope' AND parent_object_id = OBJECT_ID('dbo.report_templates')
)
BEGIN
    ALTER TABLE dbo.report_templates DROP CONSTRAINT CK_report_templates_scope;
END

ALTER TABLE dbo.report_templates
    ADD CONSTRAINT CK_report_templates_scope
    CHECK (scope IN ('audit', 'self_assessment', 'nc'));

PRINT 'CK_report_templates_scope aggiornato (nc)';
GO

-- Tipo assegnazione (standard ISO | checklist custom | export NC)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.report_template_assignments') AND name = 'assignment_type'
)
BEGIN
    ALTER TABLE dbo.report_template_assignments
        ADD assignment_type NVARCHAR(20) NOT NULL
            CONSTRAINT DF_rta_assignment_type DEFAULT 'standard';
    PRINT 'Colonna assignment_type aggiunta';
END
ELSE
    PRINT 'Colonna assignment_type gia presente';
GO

-- Allinea righe esistenti PRIMA del nuovo vincolo CHECK
UPDATE dbo.report_template_assignments
SET assignment_type = 'custom_checklist'
WHERE custom_checklist_id IS NOT NULL;

UPDATE dbo.report_template_assignments
SET assignment_type = 'standard'
WHERE custom_checklist_id IS NULL AND standard_id IS NOT NULL;
GO

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_rta_at_least_one' AND parent_object_id = OBJECT_ID('dbo.report_template_assignments')
)
BEGIN
    ALTER TABLE dbo.report_template_assignments DROP CONSTRAINT CK_rta_at_least_one;
END

ALTER TABLE dbo.report_template_assignments
    ADD CONSTRAINT CK_rta_at_least_one CHECK (
        (assignment_type = 'standard' AND standard_id IS NOT NULL AND custom_checklist_id IS NULL)
        OR (assignment_type = 'custom_checklist' AND custom_checklist_id IS NOT NULL AND standard_id IS NULL)
        OR (assignment_type = 'nc' AND standard_id IS NULL AND custom_checklist_id IS NULL)
    );

PRINT 'CK_rta_at_least_one aggiornato (nc)';
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UQ_rta_org_nc' AND object_id = OBJECT_ID('dbo.report_template_assignments')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_rta_org_nc
        ON dbo.report_template_assignments(organization_id)
        WHERE assignment_type = 'nc';
    PRINT 'Indice UQ_rta_org_nc creato';
END
GO

-- Seed template di sistema NC
IF NOT EXISTS (
    SELECT 1 FROM dbo.report_templates
    WHERE organization_id IS NULL AND scope = 'nc' AND standard_key = 'default'
)
BEGIN
    INSERT INTO dbo.report_templates (
        organization_id, name, scope, standard_key, file_path, is_system, created_at, updated_at
    )
    VALUES (
        NULL,
        'Scheda NC (default)',
        'nc',
        'default',
        '/templates/NC-scheda.docx',
        1,
        GETDATE(),
        GETDATE()
    );
    PRINT 'Seed template NC di sistema inserito';
END
ELSE
    PRINT 'Seed template NC di sistema gia presente';
