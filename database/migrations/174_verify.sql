-- Companion di verifica per 174_wps_wpqr_links.sql
-- Una riga di risultato con esito = PASS|FAIL (sole SELECT, nessuna scrittura).
-- CI apply-on-empty: welding_procedures o wpqr_records assenti -> PASS.

SET NOCOUNT ON;

DECLARE @base_presente INT = CASE
    WHEN OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
     AND OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @links_presente INT = CASE WHEN OBJECT_ID(N'dbo.wps_wpqr_links', N'U') IS NULL THEN 0 ELSE 1 END;
DECLARE @righe_wps INT = 0;
DECLARE @righe_wpqr INT = 0;
DECLARE @colonne_attese INT = 7;
DECLARE @colonne_presenti INT = 0;
DECLARE @unique_presente INT = 0;
DECLARE @indice_presente INT = 0;
DECLARE @fk_wps_presente INT = 0;
DECLARE @fk_wpqr_presente INT = 0;
DECLARE @fk_con_delete INT = 0;
DECLARE @org_incoerenti INT = 0;

IF @base_presente = 1
BEGIN
    SELECT @righe_wps = COUNT(*) FROM dbo.welding_procedures;
    SELECT @righe_wpqr = COUNT(*) FROM dbo.wpqr_records;
END

IF @links_presente = 1
BEGIN
    SELECT @colonne_presenti = COUNT(*) FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.wps_wpqr_links')
      AND name IN (N'id', N'organization_id', N'wps_id', N'wpqr_id', N'role', N'created_at', N'created_by');

    IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = N'UQ_wps_wpqr_links_wps_wpqr' AND parent_object_id = OBJECT_ID(N'dbo.wps_wpqr_links'))
        SET @unique_presente = 1;

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_wps_wpqr_links_org_wpqr' AND object_id = OBJECT_ID(N'dbo.wps_wpqr_links'))
        SET @indice_presente = 1;

    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_wps_wpqr_links_wps' AND parent_object_id = OBJECT_ID(N'dbo.wps_wpqr_links'))
        SET @fk_wps_presente = 1;

    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_wps_wpqr_links_wpqr' AND parent_object_id = OBJECT_ID(N'dbo.wps_wpqr_links'))
        SET @fk_wpqr_presente = 1;

    SELECT @fk_con_delete = COUNT(*) FROM sys.foreign_keys
    WHERE name IN (N'FK_wps_wpqr_links_wps', N'FK_wps_wpqr_links_wpqr')
      AND parent_object_id = OBJECT_ID(N'dbo.wps_wpqr_links')
      AND (delete_referential_action <> 0 OR update_referential_action <> 0);

    IF @base_presente = 1
        SELECT @org_incoerenti = COUNT(*)
        FROM dbo.wps_wpqr_links l
        LEFT JOIN dbo.welding_procedures w ON w.id = l.wps_id
        LEFT JOIN dbo.wpqr_records q ON q.id = l.wpqr_id
        WHERE w.id IS NULL OR q.id IS NULL
           OR l.organization_id <> w.organization_id
           OR l.organization_id <> q.organization_id;
END

SELECT
    CASE
        WHEN @base_presente = 0 THEN N'PASS'
        WHEN @links_presente = 1
             AND @colonne_presenti = @colonne_attese
             AND @unique_presente = 1
             AND @indice_presente = 1
             AND @fk_wps_presente = 1
             AND @fk_wpqr_presente = 1
             AND @fk_con_delete = 0
             AND @org_incoerenti = 0 THEN N'PASS'
        ELSE N'FAIL'
    END AS esito,
    @righe_wps AS righe_welding_procedures,
    @righe_wpqr AS righe_wpqr_records,
    @links_presente AS tabella_links_presente,
    @colonne_presenti AS colonne_presenti,
    @colonne_attese AS colonne_attese,
    @unique_presente AS unique_presente,
    @indice_presente AS indice_presente,
    @fk_wps_presente AS fk_wps_presente,
    @fk_wpqr_presente AS fk_wpqr_presente,
    @fk_con_delete AS fk_con_delete,
    @org_incoerenti AS org_incoerenti,
    CASE
        WHEN @base_presente = 0 THEN N'welding_procedures o wpqr_records assenti (CI apply-on-empty / gap pre-169)'
        ELSE N'tabella, colonne, unique, indice, due FK senza azioni referenziali; link coerenti per organization_id'
    END AS nota;
