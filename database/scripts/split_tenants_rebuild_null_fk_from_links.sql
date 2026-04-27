/*
  Ricostruzione legami (NULL / mismatch) da dati gia presenti — senza ipotesi Camellini
  --------------------------------------------------------------------------------------
  Regole (in ordine, stessa transazione):

  1) organization_id: se created_by e valorizzato e diverso da users.organization_id,
     allinea al tenant del creatore.
     Tabelle: risks, objectives, qualifications, complaints, suppliers, import_jobs.

  2) company_id (solo se ancora NULL): prima societa attiva (ORDER BY id) dello studio
     dell utente creatore, con vincolo auditor_orgs.organization_id = users.organization_id.
     Se creatore senza studio o senza societa coerenti, resta NULL.

  3) audits.company_id (solo NULL), in ordine:
     3a studio del creatore; 3a2 client_name = nome societa univoco nel tenant;
     3c creatore senza auditor_org ma organization_id = audit (es. admin legacy);
     3b created_by NULL → prima societa tenant (debole).

  Note audits: filtro is_deleted con ISNULL(...,0)=0 (se is_deleted NULL le righe non erano escluse prima).
  Per company su audit: si preferisce is_active=1 ma si accetta societa inattiva se e l unica (ORDER BY).

  Non modifica: document_registry (gia gestito da script dedicati), users, organizations.
  Backup + prova su copia DB prima della produzione.
  Diagnostica se tutto 0: database/scripts/split_tenants_diagnose_audits_company_id_null.sql
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

PRINT N'--- 1) organization_id da created_by (mismatch o correzione tenant) ---';

IF OBJECT_ID(N'dbo.risks', N'U') IS NOT NULL
BEGIN
    UPDATE r
    SET r.organization_id = u.organization_id,
        r.updated_at      = SYSUTCDATETIME()
    FROM dbo.risks AS r
    INNER JOIN dbo.users AS u ON u.user_id = r.created_by
    WHERE r.created_by IS NOT NULL
      AND r.organization_id <> u.organization_id
      AND r.is_deleted = 0;
    PRINT N'risks: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));
END;

IF OBJECT_ID(N'dbo.objectives', N'U') IS NOT NULL
BEGIN
    UPDATE ob
    SET ob.organization_id = u.organization_id,
        ob.updated_at      = SYSUTCDATETIME()
    FROM dbo.objectives AS ob
    INNER JOIN dbo.users AS u ON u.user_id = ob.created_by
    WHERE ob.created_by IS NOT NULL
      AND ob.organization_id <> u.organization_id
      AND ob.is_deleted = 0;
    PRINT N'objectives: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));
END;

IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
BEGIN
    UPDATE q
    SET q.organization_id = u.organization_id,
        q.updated_at      = SYSUTCDATETIME()
    FROM dbo.qualifications AS q
    INNER JOIN dbo.users AS u ON u.user_id = q.created_by
    WHERE q.created_by IS NOT NULL
      AND q.organization_id <> u.organization_id;
    PRINT N'qualifications org: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));
END;

IF OBJECT_ID(N'dbo.complaints', N'U') IS NOT NULL
BEGIN
    UPDATE cp
    SET cp.organization_id = u.organization_id,
        cp.updated_at      = SYSUTCDATETIME()
    FROM dbo.complaints AS cp
    INNER JOIN dbo.users AS u ON u.user_id = cp.created_by
    WHERE cp.created_by IS NOT NULL
      AND cp.organization_id <> u.organization_id;
    PRINT N'complaints org: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));
END;

IF OBJECT_ID(N'dbo.suppliers', N'U') IS NOT NULL
BEGIN
    UPDATE s
    SET s.organization_id = u.organization_id,
        s.updated_at      = SYSUTCDATETIME()
    FROM dbo.suppliers AS s
    INNER JOIN dbo.users AS u ON u.user_id = s.created_by
    WHERE s.created_by IS NOT NULL
      AND s.organization_id <> u.organization_id;
    PRINT N'suppliers org: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));
END;

IF OBJECT_ID(N'dbo.import_jobs', N'U') IS NOT NULL
BEGIN
    UPDATE j
    SET j.organization_id = u.organization_id,
        j.updated_at      = SYSUTCDATETIME()
    FROM dbo.import_jobs AS j
    INNER JOIN dbo.users AS u ON u.user_id = j.created_by
    WHERE j.created_by IS NOT NULL
      AND j.organization_id <> u.organization_id;
    PRINT N'import_jobs org: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));
END;

PRINT N'--- 2) company_id NULL → prima societa dello studio del creatore (se esiste) ---';

IF OBJECT_ID(N'dbo.risks', N'U') IS NOT NULL
BEGIN
    UPDATE r
    SET r.company_id = sub.company_id,
        r.updated_at = SYSUTCDATETIME()
    FROM dbo.risks AS r
    INNER JOIN dbo.users AS u ON u.user_id = r.created_by
    OUTER APPLY (
        SELECT TOP 1 c.id AS company_id
        FROM dbo.companies AS c
        INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
        WHERE u.auditor_org_id IS NOT NULL
          AND ao.id = u.auditor_org_id
          AND ao.organization_id = u.organization_id
          AND c.is_active = 1
        ORDER BY c.id
    ) AS sub
    WHERE r.company_id IS NULL
      AND r.created_by IS NOT NULL
      AND sub.company_id IS NOT NULL
      AND r.is_deleted = 0;
    PRINT N'risks company_id: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));
END;

IF OBJECT_ID(N'dbo.objectives', N'U') IS NOT NULL
BEGIN
    UPDATE ob
    SET ob.company_id = sub.company_id,
        ob.updated_at = SYSUTCDATETIME()
    FROM dbo.objectives AS ob
    INNER JOIN dbo.users AS u ON u.user_id = ob.created_by
    OUTER APPLY (
        SELECT TOP 1 c.id AS company_id
        FROM dbo.companies AS c
        INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
        WHERE u.auditor_org_id IS NOT NULL
          AND ao.id = u.auditor_org_id
          AND ao.organization_id = u.organization_id
          AND c.is_active = 1
        ORDER BY c.id
    ) AS sub
    WHERE ob.company_id IS NULL
      AND ob.created_by IS NOT NULL
      AND sub.company_id IS NOT NULL
      AND ob.is_deleted = 0;
    PRINT N'objectives company_id: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));
END;

IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
BEGIN
    UPDATE q
    SET q.company_id = sub.company_id,
        q.updated_at = SYSUTCDATETIME()
    FROM dbo.qualifications AS q
    INNER JOIN dbo.users AS u ON u.user_id = q.created_by
    OUTER APPLY (
        SELECT TOP 1 c.id AS company_id
        FROM dbo.companies AS c
        INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
        WHERE u.auditor_org_id IS NOT NULL
          AND ao.id = u.auditor_org_id
          AND ao.organization_id = u.organization_id
          AND c.is_active = 1
        ORDER BY c.id
    ) AS sub
    WHERE q.company_id IS NULL
      AND q.created_by IS NOT NULL
      AND sub.company_id IS NOT NULL;
    PRINT N'qualifications company_id: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));
END;

IF OBJECT_ID(N'dbo.complaints', N'U') IS NOT NULL
BEGIN
    UPDATE cp
    SET cp.company_id = sub.company_id,
        cp.updated_at = SYSUTCDATETIME()
    FROM dbo.complaints AS cp
    INNER JOIN dbo.users AS u ON u.user_id = cp.created_by
    OUTER APPLY (
        SELECT TOP 1 c.id AS company_id
        FROM dbo.companies AS c
        INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
        WHERE u.auditor_org_id IS NOT NULL
          AND ao.id = u.auditor_org_id
          AND ao.organization_id = u.organization_id
          AND c.is_active = 1
        ORDER BY c.id
    ) AS sub
    WHERE cp.company_id IS NULL
      AND cp.created_by IS NOT NULL
      AND sub.company_id IS NOT NULL;
    PRINT N'complaints company_id: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));
END;

IF OBJECT_ID(N'dbo.suppliers', N'U') IS NOT NULL
BEGIN
    UPDATE s
    SET s.company_id = sub.company_id,
        s.updated_at = SYSUTCDATETIME()
    FROM dbo.suppliers AS s
    INNER JOIN dbo.users AS u ON u.user_id = s.created_by
    OUTER APPLY (
        SELECT TOP 1 c.id AS company_id
        FROM dbo.companies AS c
        INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
        WHERE u.auditor_org_id IS NOT NULL
          AND ao.id = u.auditor_org_id
          AND ao.organization_id = u.organization_id
          AND c.is_active = 1
        ORDER BY c.id
    ) AS sub
    WHERE s.company_id IS NULL
      AND s.created_by IS NOT NULL
      AND sub.company_id IS NOT NULL;
    PRINT N'suppliers company_id: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));
END;

IF OBJECT_ID(N'dbo.import_jobs', N'U') IS NOT NULL
BEGIN
    UPDATE j
    SET j.company_id = sub.company_id,
        j.updated_at = SYSUTCDATETIME()
    FROM dbo.import_jobs AS j
    INNER JOIN dbo.users AS u ON u.user_id = j.created_by
    OUTER APPLY (
        SELECT TOP 1 c.id AS company_id
        FROM dbo.companies AS c
        INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
        WHERE u.auditor_org_id IS NOT NULL
          AND ao.id = u.auditor_org_id
          AND ao.organization_id = u.organization_id
          AND c.is_active = 1
        ORDER BY c.id
    ) AS sub
    WHERE j.company_id IS NULL
      AND j.created_by IS NOT NULL
      AND sub.company_id IS NOT NULL;
    PRINT N'import_jobs company_id: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));
END;

PRINT N'--- 3) audits.company_id NULL ---';

IF OBJECT_ID(N'dbo.audits', N'U') IS NOT NULL
BEGIN
    -- 3a) Da studio utente creatore (preferito)
    UPDATE a
    SET a.company_id = sub.company_id,
        a.updated_at = GETDATE()
    FROM dbo.audits AS a
    INNER JOIN dbo.users AS u ON u.user_id = a.created_by
    OUTER APPLY (
        SELECT TOP 1 c.id AS company_id
        FROM dbo.companies AS c
        INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
        WHERE u.auditor_org_id IS NOT NULL
          AND ao.id = u.auditor_org_id
          AND ao.organization_id = u.organization_id
        ORDER BY CASE WHEN c.is_active = 1 THEN 0 ELSE 1 END, c.id
    ) AS sub
    WHERE a.company_id IS NULL
      AND a.created_by IS NOT NULL
      AND sub.company_id IS NOT NULL
      AND (COL_LENGTH(N'dbo.audits', N'is_deleted') IS NULL OR ISNULL(a.is_deleted, 0) = 0);

    PRINT N'audits company_id (da created_by/studio): ' + CAST(@@ROWCOUNT AS NVARCHAR(20));

    -- 3a2) client_name uguale a companies.name (case-insensitive), una sola societa candidata nel tenant
    IF COL_LENGTH(N'dbo.audits', N'client_name') IS NOT NULL
    BEGIN
        UPDATE a
        SET a.company_id = x.company_id,
            a.updated_at = GETDATE()
        FROM dbo.audits AS a
        INNER JOIN (
            SELECT a2.audit_id,
                   MIN(c.id) AS company_id
            FROM dbo.audits AS a2
            INNER JOIN dbo.auditor_orgs AS ao ON ao.organization_id = a2.organization_id
            INNER JOIN dbo.companies AS c ON c.auditor_org_id = ao.id AND c.is_active = 1
            WHERE a2.company_id IS NULL
              AND NULLIF(LTRIM(RTRIM(a2.client_name)), N'') IS NOT NULL
              AND LOWER(LTRIM(RTRIM(c.name))) = LOWER(LTRIM(RTRIM(a2.client_name)))
            GROUP BY a2.audit_id
            HAVING COUNT(DISTINCT c.id) = 1
        ) AS x ON x.audit_id = a.audit_id
        WHERE a.company_id IS NULL
          AND (COL_LENGTH(N'dbo.audits', N'is_deleted') IS NULL OR ISNULL(a.is_deleted, 0) = 0);

        PRINT N'audits company_id (match univoco client_name): ' + CAST(@@ROWCOUNT AS NVARCHAR(20));
    END;

    -- 3c) Creatore senza auditor_org ma stesso tenant dell audit: prima societa del tenant (admin legacy; rivedere se piu societa)
    UPDATE a
    SET a.company_id = sub.company_id,
        a.updated_at = GETDATE()
    FROM dbo.audits AS a
    INNER JOIN dbo.users AS u ON u.user_id = a.created_by
    OUTER APPLY (
        SELECT TOP 1 c.id AS company_id
        FROM dbo.companies AS c
        INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
        WHERE ao.organization_id = a.organization_id
          AND u.organization_id = a.organization_id
          AND u.auditor_org_id IS NULL
        ORDER BY CASE WHEN c.is_active = 1 THEN 0 ELSE 1 END, ao.id, c.id
    ) AS sub
    WHERE a.company_id IS NULL
      AND a.created_by IS NOT NULL
      AND sub.company_id IS NOT NULL
      AND (COL_LENGTH(N'dbo.audits', N'is_deleted') IS NULL OR ISNULL(a.is_deleted, 0) = 0);

    PRINT N'audits company_id (creatore senza studio, stesso tenant): ' + CAST(@@ROWCOUNT AS NVARCHAR(20));

    -- 3b) Solo se created_by NULL: prima societa di un qualsiasi studio del tenant (euristica debole; rivedere a mano)
    UPDATE a
    SET a.company_id = sub.company_id,
        a.updated_at = GETDATE()
    FROM dbo.audits AS a
    OUTER APPLY (
        SELECT TOP 1 c.id AS company_id
        FROM dbo.companies AS c
        INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
        WHERE ao.organization_id = a.organization_id
        ORDER BY CASE WHEN c.is_active = 1 THEN 0 ELSE 1 END, ao.id, c.id
    ) AS sub
    WHERE a.company_id IS NULL
      AND a.created_by IS NULL
      AND sub.company_id IS NOT NULL
      AND (COL_LENGTH(N'dbo.audits', N'is_deleted') IS NULL OR ISNULL(a.is_deleted, 0) = 0);

    PRINT N'audits company_id (fallback tenant, solo senza created_by): ' + CAST(@@ROWCOUNT AS NVARCHAR(20));
END;

COMMIT TRANSACTION;

PRINT N'Fine. Rieseguire split_tenants_08_nullable_tenant_fk_audit.sql e split_tenants_05/06 per controllo.';
