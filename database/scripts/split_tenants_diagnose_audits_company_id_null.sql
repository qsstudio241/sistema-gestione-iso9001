/*
  Diagnostica read-only: perche rebuild (3a–3c) puo dare @@ROWCOUNT = 0
  --------------------------------------------------------------------
  Eseguire in SSMS; nessuna modifica ai dati.

  Leggere la scheda Messaggi: i conteggi compaiono sempre anche se le griglie Risultati sono vuote.
*/

SET NOCOUNT ON;

DECLARE @cnt INT;

PRINT N'';
PRINT N'========== Riepilogo (Messaggi) ==========';

-- A
IF OBJECT_ID(N'dbo.audits', N'U') IS NULL
    PRINT N'A) Tabella audits assente.';
ELSE
BEGIN
    SELECT @cnt = COUNT(*)
    FROM dbo.audits AS a
    WHERE a.company_id IS NULL
      AND (COL_LENGTH(N'dbo.audits', N'is_deleted') IS NULL OR ISNULL(a.is_deleted, 0) = 0);

    PRINT N'A) Audit con company_id NULL e non eliminati: ' + CAST(@cnt AS NVARCHAR(20));
    IF @cnt = 0
        PRINT N'   => Nessun candidato: o tutti gli audit hanno gia company_id, o sono marcati eliminati.';
    ELSE
    BEGIN
        PRINT N'   (dettaglio nella griglia Risultati 1)';
        SELECT TOP 50
            a.audit_id,
            a.organization_id,
            a.created_by,
            a.company_id,
            a.client_name,
            is_del = CASE WHEN COL_LENGTH(N'dbo.audits', N'is_deleted') IS NOT NULL THEN ISNULL(a.is_deleted, 0) ELSE NULL END
        FROM dbo.audits AS a
        WHERE a.company_id IS NULL
          AND (COL_LENGTH(N'dbo.audits', N'is_deleted') IS NULL OR ISNULL(a.is_deleted, 0) = 0)
        ORDER BY a.audit_id DESC;
    END;
END;

PRINT N'';

-- B
IF OBJECT_ID(N'dbo.companies', N'U') IS NULL
    OR OBJECT_ID(N'dbo.auditor_orgs', N'U') IS NULL
    PRINT N'B) Tabelle companies o auditor_orgs assenti.';
ELSE
BEGIN
    SELECT @cnt = COUNT(*) FROM dbo.auditor_orgs;
    PRINT N'B) Righe in auditor_orgs: ' + CAST(@cnt AS NVARCHAR(20));
    IF @cnt = 0
        PRINT N'   => Nessuno studio: impossibile agganciare companies per tenant.';
    ELSE
    BEGIN
        PRINT N'   (dettaglio per studio nella griglia Risultati)';
        SELECT
            ao.id              AS auditor_org_id,
            ao.organization_id,
            ao.name            AS studio_name,
            n_companies_active = (
                SELECT COUNT(*) FROM dbo.companies AS c
                WHERE c.auditor_org_id = ao.id AND ISNULL(c.is_active, 1) = 1
            ),
            n_companies_any = (
                SELECT COUNT(*) FROM dbo.companies AS c WHERE c.auditor_org_id = ao.id
            )
        FROM dbo.auditor_orgs AS ao
        ORDER BY ao.organization_id, ao.id;
    END;
END;

PRINT N'';

-- C
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
    PRINT N'C) Tabella users assente.';
ELSE
BEGIN
    SELECT @cnt = COUNT(*) FROM dbo.users WHERE user_id = 1;
    PRINT N'C) Utente user_id = 1 presente: ' + CAST(@cnt AS NVARCHAR(20));
    IF @cnt = 0
        PRINT N'   => Nessun utente 1: created_by=1 non risolvibile da users.';
    ELSE
    BEGIN
        SELECT u.user_id, u.email, u.organization_id, u.auditor_org_id
        FROM dbo.users AS u
        WHERE u.user_id = 1;
    END;
END;

PRINT N'';

-- D
IF OBJECT_ID(N'dbo.audits', N'U') IS NULL
    OR OBJECT_ID(N'dbo.companies', N'U') IS NULL
    OR OBJECT_ID(N'dbo.auditor_orgs', N'U') IS NULL
    PRINT N'D) Tabelle mancanti per sezione D.';
ELSE
BEGIN
    SELECT @cnt = COUNT(*)
    FROM dbo.audits AS a
    WHERE a.company_id IS NULL
      AND (COL_LENGTH(N'dbo.audits', N'is_deleted') IS NULL OR ISNULL(a.is_deleted, 0) = 0)
      AND EXISTS (
          SELECT 1
          FROM dbo.companies AS c2
          INNER JOIN dbo.auditor_orgs AS ao2 ON ao2.id = c2.auditor_org_id
          WHERE ao2.organization_id = a.organization_id
            AND ISNULL(c2.is_active, 1) = 1
      );

    PRINT N'D) Audit NULL company il cui tenant ha ALMENO una societa attiva: ' + CAST(@cnt AS NVARCHAR(20));
    IF @cnt = 0
    BEGIN
        SELECT @cnt = COUNT(*)
        FROM dbo.audits AS a
        WHERE a.company_id IS NULL
          AND (COL_LENGTH(N'dbo.audits', N'is_deleted') IS NULL OR ISNULL(a.is_deleted, 0) = 0);
        PRINT N'   Audit NULL company totali (non eliminati): ' + CAST(@cnt AS NVARCHAR(20));
        IF @cnt > 0
            PRINT N'   => Ci sono audit senza societa MA nessuna companies attiva su quel organization_id (studi/societa da allineare).';
    END;

    IF EXISTS (
        SELECT 1 FROM dbo.audits AS a
        WHERE a.company_id IS NULL
          AND (COL_LENGTH(N'dbo.audits', N'is_deleted') IS NULL OR ISNULL(a.is_deleted, 0) = 0)
    )
    BEGIN
        PRINT N'   (dettaglio audit vs n societa tenant nella griglia Risultati)';
        SELECT
            a.audit_id,
            a.organization_id,
            a.created_by,
            n_companies_on_tenant = (
                SELECT COUNT(*)
                FROM dbo.companies AS c2
                INNER JOIN dbo.auditor_orgs AS ao2 ON ao2.id = c2.auditor_org_id
                WHERE ao2.organization_id = a.organization_id
                  AND ISNULL(c2.is_active, 1) = 1
            )
        FROM dbo.audits AS a
        WHERE a.company_id IS NULL
          AND (COL_LENGTH(N'dbo.audits', N'is_deleted') IS NULL OR ISNULL(a.is_deleted, 0) = 0)
        ORDER BY a.audit_id DESC;
    END;
END;

PRINT N'';
PRINT N'========== Fine diagnostica ==========';
