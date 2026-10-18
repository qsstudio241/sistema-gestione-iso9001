-- NON APPLICARE senza sì. Companion di verifica di 175_entity_change_log.sql
-- Sole SELECT. Nessuna riga di business. CI apply-on-empty: la tabella deve esistere dopo l'apply.

SET NOCOUNT ON;

DECLARE @tabella INT = CASE WHEN OBJECT_ID(N'dbo.entity_change_log', N'U') IS NULL THEN 0 ELSE 1 END;
DECLARE @colonne INT = 0;
DECLARE @check_action INT = 0;
DECLARE @check_ref INT = 0;
DECLARE @idx_org INT = 0;
DECLARE @idx_entity INT = 0;
DECLARE @fk INT = 0;
DECLARE @cascade INT = 0;

IF @tabella = 1
BEGIN
    SELECT @colonne = COUNT(*)
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.entity_change_log')
      AND name IN (
        N'id', N'organization_id', N'entity_table', N'entity_id', N'action_type',
        N'field_name', N'old_value', N'new_value', N'actor_user_id', N'created_at'
      );

    IF EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE name = N'CK_entity_change_log_action'
          AND parent_object_id = OBJECT_ID(N'dbo.entity_change_log')
    ) SET @check_action = 1;

    IF EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE name = N'CK_entity_change_log_entity_ref'
          AND parent_object_id = OBJECT_ID(N'dbo.entity_change_log')
    ) SET @check_ref = 1;

    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_entity_change_log_org_created'
          AND object_id = OBJECT_ID(N'dbo.entity_change_log')
    ) SET @idx_org = 1;

    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_entity_change_log_entity'
          AND object_id = OBJECT_ID(N'dbo.entity_change_log')
    ) SET @idx_entity = 1;

    SELECT @fk = COUNT(*)
    FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID(N'dbo.entity_change_log');

    SELECT @cascade = COUNT(*)
    FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID(N'dbo.entity_change_log')
      AND delete_referential_action <> 0;
END

SELECT
    CASE
        WHEN @tabella = 1
         AND @colonne = 10
         AND @check_action = 1
         AND @check_ref = 1
         AND @idx_org = 1
         AND @idx_entity = 1
         AND @fk = 0
         AND @cascade = 0 THEN N'PASS'
        ELSE N'FAIL'
    END AS esito,
    @tabella AS tabella_presente,
    @colonne AS colonne_attese_10,
    @check_action AS check_action,
    @check_ref AS check_ref,
    @idx_org AS indice_org,
    @idx_entity AS indice_entita,
    @fk AS fk,
    @cascade AS fk_con_delete;
