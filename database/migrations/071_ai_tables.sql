-- Migration 071: tabelle AI (ai_feedback, ai_interactions)
-- Supporto per personalizzazione auditor (Level C) e audit trail interazioni AI

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_feedback')
BEGIN
    CREATE TABLE ai_feedback (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        organization_id INT NOT NULL,
        user_id         INT NOT NULL,
        feature         NVARCHAR(64) NOT NULL,
        audit_id        NVARCHAR(64) NULL,
        action          NVARCHAR(32) NOT NULL,    -- accepted | rejected | rephrased
        ai_text         NVARCHAR(MAX) NULL,
        final_text      NVARCHAR(MAX) NULL,
        recommendation  NVARCHAR(64) NULL,
        context_summary NVARCHAR(512) NULL,
        model_used      NVARCHAR(128) NULL,
        created_at      DATETIME2 DEFAULT GETUTCDATE() NOT NULL
    );

    CREATE INDEX IX_ai_feedback_org_user_feature
        ON ai_feedback (organization_id, user_id, feature);
    CREATE INDEX IX_ai_feedback_created_at
        ON ai_feedback (created_at);
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_interactions')
BEGIN
    CREATE TABLE ai_interactions (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        organization_id INT NOT NULL,
        user_id         INT NOT NULL,
        feature         NVARCHAR(64) NOT NULL,
        provider        NVARCHAR(64) NULL,
        model           NVARCHAR(128) NULL,
        input_tokens    INT NULL,
        output_tokens   INT NULL,
        cost_usd        DECIMAL(10,6) NULL,
        latency_ms      INT NULL,
        status          NVARCHAR(32) NULL,    -- success | error
        context_summary NVARCHAR(512) NULL,
        created_at      DATETIME2 DEFAULT GETUTCDATE() NOT NULL
    );

    CREATE INDEX IX_ai_interactions_org_feature
        ON ai_interactions (organization_id, feature);
    CREATE INDEX IX_ai_interactions_created_at
        ON ai_interactions (created_at);
END
