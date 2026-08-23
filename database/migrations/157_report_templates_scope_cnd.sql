-- Migration 157: scope cnd su report_templates (CND-4)
-- Estende CK_report_templates_scope e seed modelli sistema VT/PT/MT/UT.
-- Additive, idempotente. Non tocca report_template_assignments.
-- Niente USE. GO solo per DROP/ADD CHECK (SQL Server).

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_report_templates_scope'
      AND parent_object_id = OBJECT_ID('dbo.report_templates')
)
BEGIN
    ALTER TABLE dbo.report_templates DROP CONSTRAINT CK_report_templates_scope;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_report_templates_scope'
      AND parent_object_id = OBJECT_ID('dbo.report_templates')
)
BEGIN
    ALTER TABLE dbo.report_templates
        ADD CONSTRAINT CK_report_templates_scope
        CHECK (scope IN ('audit', 'self_assessment', 'nc', 'cnd'));
END
GO

PRINT 'CK_report_templates_scope aggiornato (cnd)';
GO

IF NOT EXISTS (
    SELECT 1 FROM dbo.report_templates
    WHERE organization_id IS NULL AND scope = 'cnd' AND standard_key = 'VT'
)
BEGIN
    INSERT INTO dbo.report_templates (
        organization_id, name, scope, standard_key, file_path, is_system, created_at, updated_at
    )
    VALUES (
        NULL,
        'Verbale CND VT (sistema)',
        'cnd',
        'VT',
        '/templates/VT-verbale.docx',
        1,
        GETDATE(),
        GETDATE()
    );
    PRINT 'Seed template CND VT inserito';
END
ELSE
    PRINT 'Seed template CND VT gia presente';
GO

IF NOT EXISTS (
    SELECT 1 FROM dbo.report_templates
    WHERE organization_id IS NULL AND scope = 'cnd' AND standard_key = 'PT'
)
BEGIN
    INSERT INTO dbo.report_templates (
        organization_id, name, scope, standard_key, file_path, is_system, created_at, updated_at
    )
    VALUES (
        NULL,
        'Verbale CND PT (sistema)',
        'cnd',
        'PT',
        '/templates/CND-PT-verbale.docx',
        1,
        GETDATE(),
        GETDATE()
    );
    PRINT 'Seed template CND PT inserito';
END
ELSE
    PRINT 'Seed template CND PT gia presente';
GO

IF NOT EXISTS (
    SELECT 1 FROM dbo.report_templates
    WHERE organization_id IS NULL AND scope = 'cnd' AND standard_key = 'MT'
)
BEGIN
    INSERT INTO dbo.report_templates (
        organization_id, name, scope, standard_key, file_path, is_system, created_at, updated_at
    )
    VALUES (
        NULL,
        'Verbale CND MT (sistema) — convertire il .doc Mason una volta in .docx',
        'cnd',
        'MT',
        '/templates/CND-MT-verbale.docx',
        1,
        GETDATE(),
        GETDATE()
    );
    PRINT 'Seed template CND MT (stub) inserito';
END
ELSE
    PRINT 'Seed template CND MT gia presente';
GO

IF NOT EXISTS (
    SELECT 1 FROM dbo.report_templates
    WHERE organization_id IS NULL AND scope = 'cnd' AND standard_key = 'UT'
)
BEGIN
    INSERT INTO dbo.report_templates (
        organization_id, name, scope, standard_key, file_path, is_system, created_at, updated_at
    )
    VALUES (
        NULL,
        'Verbale CND UT (sistema, stub)',
        'cnd',
        'UT',
        '/templates/CND-UT-verbale.docx',
        1,
        GETDATE(),
        GETDATE()
    );
    PRINT 'Seed template CND UT inserito';
END
ELSE
    PRINT 'Seed template CND UT gia presente';
GO
