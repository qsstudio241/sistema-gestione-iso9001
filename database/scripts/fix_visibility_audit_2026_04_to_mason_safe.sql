/*
  Fix sicuro visibilita audit 2026-04 per studio Mason
  ====================================================

  Scopo:
  - riallineare l'audit 2026-04 al tenant/studio Mason
    (organization_id = 1003, auditor_org_id = 2)
  - mantenendo un approccio transazionale e verificabile.

  NOTE:
  - script pensato per esecuzione manuale in SSMS su DB produzione
  - non esegue modifiche se i controlli di coerenza non passano
  - rollback automatico su errore
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @AuditNumber NVARCHAR(50) = N'2026-04';
DECLARE @TargetOrganizationId INT = 1003; -- Mason
DECLARE @TargetAuditorOrgId INT = 2;      -- Mason studio
DECLARE @ExpectedClientNameLike NVARCHAR(200) = N'%MANITOU%';

DECLARE @AuditId INT;
DECLARE @CurrentOrgId INT;
DECLARE @CurrentCompanyId INT;
DECLARE @CurrentClientName NVARCHAR(255);
DECLARE @CurrentIsDeleted BIT;
DECLARE @TargetCompanyId INT;

PRINT N'=== STEP 1: lookup audit target ===';
SELECT TOP 1
    @AuditId = a.audit_id,
    @CurrentOrgId = a.organization_id,
    @CurrentCompanyId = a.company_id,
    @CurrentClientName = a.client_name,
    @CurrentIsDeleted = ISNULL(a.is_deleted, 0)
FROM dbo.audits a
WHERE a.audit_number = @AuditNumber
ORDER BY a.audit_id DESC;

IF @AuditId IS NULL
BEGIN
    RAISERROR(N'Audit %s non trovato.', 16, 1, @AuditNumber);
    RETURN;
END;

IF @CurrentIsDeleted = 1
BEGIN
    RAISERROR(N'Audit %s risulta eliminato (is_deleted=1). Stop.', 16, 1, @AuditNumber);
    RETURN;
END;

PRINT N'Audit trovato: id=' + CAST(@AuditId AS NVARCHAR(20))
    + N' org=' + CAST(@CurrentOrgId AS NVARCHAR(20))
    + N' company=' + ISNULL(CAST(@CurrentCompanyId AS NVARCHAR(20)), N'NULL')
    + N' client=' + ISNULL(@CurrentClientName, N'NULL');

IF (@CurrentClientName IS NULL OR @CurrentClientName NOT LIKE @ExpectedClientNameLike)
BEGIN
    RAISERROR(N'Client name non coerente con atteso (%s). Stop di sicurezza.', 16, 1, @ExpectedClientNameLike);
    RETURN;
END;

PRINT N'=== STEP 2: risoluzione company Mason compatibile ===';

;WITH candidates AS (
    SELECT
        c.id AS company_id,
        c.name AS company_name,
        c.auditor_org_id,
        ao.organization_id,
        ROW_NUMBER() OVER (ORDER BY c.id DESC) AS rn,
        COUNT(*) OVER () AS cnt
    FROM dbo.companies c
    INNER JOIN dbo.auditor_orgs ao ON ao.id = c.auditor_org_id
    WHERE ao.id = @TargetAuditorOrgId
      AND ao.organization_id = @TargetOrganizationId
      AND c.name LIKE @ExpectedClientNameLike
      AND ISNULL(c.is_active, 1) = 1
)
SELECT @TargetCompanyId = company_id
FROM candidates
WHERE rn = 1;

IF @TargetCompanyId IS NULL
BEGIN
    RAISERROR(N'Nessuna company attiva Mason trovata con nome compatibile (%s). Stop.', 16, 1, @ExpectedClientNameLike);
    RETURN;
END;

PRINT N'Company Mason target: ' + CAST(@TargetCompanyId AS NVARCHAR(20));

PRINT N'=== STEP 3: anteprima stato pre-fix ===';
SELECT
    a.audit_id,
    a.audit_number,
    a.client_name,
    a.organization_id AS audit_org_id,
    a.company_id,
    c.name AS company_name,
    c.auditor_org_id,
    ao.organization_id AS company_org_id
FROM dbo.audits a
LEFT JOIN dbo.companies c ON c.id = a.company_id
LEFT JOIN dbo.auditor_orgs ao ON ao.id = c.auditor_org_id
WHERE a.audit_id = @AuditId;

BEGIN TRANSACTION;
BEGIN TRY

    PRINT N'=== STEP 4: update audit -> tenant/studio Mason ===';
    UPDATE dbo.audits
    SET
        organization_id = @TargetOrganizationId,
        company_id = @TargetCompanyId,
        updated_at = SYSUTCDATETIME()
    WHERE audit_id = @AuditId
      AND ISNULL(is_deleted, 0) = 0;

    IF @@ROWCOUNT <> 1
    BEGIN
        RAISERROR(N'Update audit non applicato (rowcount <> 1). Stop.', 16, 1);
    END;

    PRINT N'=== STEP 5: verifica post-fix ===';
    SELECT
        a.audit_id,
        a.audit_number,
        a.client_name,
        a.organization_id AS audit_org_id,
        a.company_id,
        c.name AS company_name,
        c.auditor_org_id,
        ao.organization_id AS company_org_id
    FROM dbo.audits a
    LEFT JOIN dbo.companies c ON c.id = a.company_id
    LEFT JOIN dbo.auditor_orgs ao ON ao.id = c.auditor_org_id
    WHERE a.audit_id = @AuditId;

    COMMIT TRANSACTION;
    PRINT N'FIX APPLICATO: audit ' + @AuditNumber + N' riallineato a Mason.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrLine INT = ERROR_LINE();
    RAISERROR(N'Errore fix audit 2026-04 (linea %d): %s', 16, 1, @ErrLine, @ErrMsg);
END CATCH;

PRINT N'=== STEP 6: query di controllo visibilita RBAC (simulazione Mason) ===';
SELECT
    a.audit_id,
    a.audit_number,
    a.client_name,
    a.organization_id,
    a.company_id
FROM dbo.audits a
WHERE a.audit_id = @AuditId
  AND a.organization_id = @TargetOrganizationId
  AND (
      a.company_id IN (SELECT id FROM dbo.companies WHERE auditor_org_id = @TargetAuditorOrgId)
      OR (a.company_id IS NULL) -- fallback RBAC legacy
  );

