-- Companion di verifica di 183_weld_sketches.sql
-- Sole SELECT. Tabelle assenti (CI apply-on-empty) = PASS.

SET NOCOUNT ON;

DECLARE @wp_presente INT = CASE WHEN OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @sk_presente INT = CASE WHEN OBJECT_ID(N'dbo.weld_sketches', N'U') IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @colonne_sk INT = 0;
DECLARE @colonne_wp INT = 0;
DECLARE @fk_delete INT = 0;
DECLARE @attese_sk INT = 0;
DECLARE @attese_wp INT = 0;

IF @sk_presente = 1
BEGIN
    SET @attese_sk = 29;
    SELECT @colonne_sk = COUNT(*)
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.weld_sketches')
      AND name IN (
          N'id', N'organization_id', N'company_id', N'slot', N'source_kind',
          N'wpqr_id', N'source_attachment_id', N'source_page', N'crop_bbox_pt',
          N'file_url', N'width_px', N'height_px', N'sha256',
          N'joint_type', N'preparation', N'product_form',
          N'thickness_min_mm', N'thickness_max_mm', N'throat_mm', N'outside_diameter_mm',
          N'process_iso4063', N'position_iso6947', N'run_mode', N'n_passes',
          N'backing', N'dimension_text', N'status', N'created_by', N'created_at'
      );

    SELECT @fk_delete = COUNT(*)
    FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID(N'dbo.weld_sketches')
      AND (delete_referential_action <> 0 OR update_referential_action <> 0);
END

IF @wp_presente = 1
BEGIN
    SET @attese_wp = 2;
    SELECT @colonne_wp = COUNT(*)
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.welding_procedures')
      AND name IN (N'joint_sketch_id', N'sequence_sketch_id')
      AND is_nullable = 1;
END

SELECT
    CASE
        WHEN @wp_presente = 0 AND @sk_presente = 0 THEN N'PASS'
        WHEN @colonne_sk >= 27 AND @colonne_wp = @attese_wp AND @fk_delete = 0 THEN N'PASS'
        ELSE N'FAIL'
    END AS esito,
    @sk_presente AS tabella_sketches,
    @colonne_sk AS colonne_sketches,
    @colonne_wp AS colonne_wps_nullable,
    @fk_delete AS fk_con_delete;
