-- Migration 064: AI Usage Log + Optimization Runs + Knowledge Chunks extensions
-- Idempotent: safe to re-run

-- Tabella tracciamento uso assistente AI
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ai_usage_log')
BEGIN
  CREATE TABLE ai_usage_log (
    id INT IDENTITY(1,1) PRIMARY KEY,
    organization_id INT NOT NULL,
    user_id INT NOT NULL,
    company_id INT NULL,
    message NVARCHAR(2000) NOT NULL,
    reply_preview NVARCHAR(500) NULL,
    chunks_used INT DEFAULT 0,
    chunk_ids NVARCHAR(MAX) NULL,
    avg_chunk_score DECIMAL(5,4) NULL,
    response_time_ms INT NULL,
    follow_up_count INT DEFAULT 0,
    was_reformulated BIT DEFAULT 0,
    feedback_signal NVARCHAR(20) NULL,
    created_at DATETIME2 DEFAULT GETDATE()
  );
  CREATE INDEX IX_ai_usage_org ON ai_usage_log(organization_id, created_at);
  CREATE INDEX IX_ai_usage_company ON ai_usage_log(organization_id, company_id);
END;

-- Tabella run di ottimizzazione
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ai_optimization_runs')
BEGIN
  CREATE TABLE ai_optimization_runs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    organization_id INT NOT NULL,
    run_type NVARCHAR(50) NOT NULL,
    started_at DATETIME2 DEFAULT GETDATE(),
    completed_at DATETIME2 NULL,
    chunks_before INT DEFAULT 0,
    chunks_after INT DEFAULT 0,
    chunks_removed INT DEFAULT 0,
    chunks_created INT DEFAULT 0,
    details NVARCHAR(MAX) NULL,
    status NVARCHAR(20) DEFAULT 'running'
  );
  CREATE INDEX IX_ai_opt_runs_org ON ai_optimization_runs(organization_id, started_at);
END;

-- Colonna is_stale per pruning su knowledge_chunks
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('knowledge_chunks') AND name = 'is_stale'
)
BEGIN
  ALTER TABLE knowledge_chunks ADD is_stale BIT DEFAULT 0;
END;

-- Colonna usage_count per tracking popolarità chunk
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('knowledge_chunks') AND name = 'usage_count'
)
BEGIN
  ALTER TABLE knowledge_chunks ADD usage_count INT DEFAULT 0;
END;
