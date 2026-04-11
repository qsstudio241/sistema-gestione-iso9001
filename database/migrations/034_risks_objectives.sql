-- Migration 034: Rischi & Obiettivi ISO 9001 §6.1 + §6.2
-- Sprint 6: registro rischi con trattamento, registro obiettivi con avanzamento

-- ─── TABELLA risks ──────────────────────────────────────────────────────────

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'risks'
)
BEGIN
    CREATE TABLE risks (
        risk_id         INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_risks PRIMARY KEY,
        organization_id INT NOT NULL,
        company_id      INT NULL,
        title           NVARCHAR(200) NOT NULL,
        description     NVARCHAR(MAX) NULL,
        context         NVARCHAR(50) NOT NULL DEFAULT 'internal'
                        CONSTRAINT CHK_risks_context
                        CHECK (context IN ('internal','external','interested_party')),
        category        NVARCHAR(50) NULL,          -- es. "operativo","legale","ambientale"
        probability     TINYINT NOT NULL DEFAULT 2  -- 1=bassa 2=media 3=alta
                        CONSTRAINT CHK_risks_prob CHECK (probability BETWEEN 1 AND 3),
        impact          TINYINT NOT NULL DEFAULT 2  -- 1=basso 2=medio 3=alto
                        CONSTRAINT CHK_risks_impact CHECK (impact BETWEEN 1 AND 3),
        -- score = probability * impact (1-9), calcolato applicazione
        treatment       NVARCHAR(20) NOT NULL DEFAULT 'mitigate'
                        CONSTRAINT CHK_risks_treatment
                        CHECK (treatment IN ('accept','mitigate','transfer','avoid')),
        treatment_desc  NVARCHAR(MAX) NULL,         -- descrizione azione di trattamento
        responsible     NVARCHAR(200) NULL,
        review_date     DATE NULL,
        status          NVARCHAR(20) NOT NULL DEFAULT 'open'
                        CONSTRAINT CHK_risks_status
                        CHECK (status IN ('open','in_treatment','mitigated','closed')),
        created_by      INT NULL,
        created_at      DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at      DATETIME2 NOT NULL DEFAULT GETDATE(),
        is_deleted      BIT NOT NULL DEFAULT 0
    );

    CREATE INDEX IX_risks_org ON risks(organization_id, is_deleted);
    PRINT 'Tabella risks creata.';
END
ELSE
    PRINT 'Tabella risks gia esistente - skip.';

-- ─── TABELLA objectives ─────────────────────────────────────────────────────

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'objectives'
)
BEGIN
    CREATE TABLE objectives (
        objective_id    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_objectives PRIMARY KEY,
        organization_id INT NOT NULL,
        company_id      INT NULL,
        title           NVARCHAR(200) NOT NULL,
        description     NVARCHAR(MAX) NULL,
        iso_clause      NVARCHAR(20) NULL,          -- es. "6.2","8.1","9.1"
        kpi_description NVARCHAR(MAX) NULL,         -- come si misura
        target_value    NVARCHAR(100) NULL,         -- valore target (testo libero)
        current_value   NVARCHAR(100) NULL,         -- valore attuale
        progress_pct    TINYINT NOT NULL DEFAULT 0  -- 0-100
                        CONSTRAINT CHK_obj_progress CHECK (progress_pct BETWEEN 0 AND 100),
        responsible     NVARCHAR(200) NULL,
        due_date        DATE NULL,
        status          NVARCHAR(20) NOT NULL DEFAULT 'active'
                        CONSTRAINT CHK_obj_status
                        CHECK (status IN ('active','achieved','cancelled','paused')),
        created_by      INT NULL,
        created_at      DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at      DATETIME2 NOT NULL DEFAULT GETDATE(),
        is_deleted      BIT NOT NULL DEFAULT 0
    );

    CREATE INDEX IX_objectives_org ON objectives(organization_id, is_deleted);
    PRINT 'Tabella objectives creata.';
END
ELSE
    PRINT 'Tabella objectives gia esistente - skip.';
