-- AI Feedback for personalized learning (Level B)
-- Stores user reactions to AI suggestions: accepted, rejected, rephrased
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ai_feedback')
CREATE TABLE ai_feedback (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  organization_id INT           NOT NULL,
  user_id         INT           NOT NULL,
  feature         NVARCHAR(50)  NOT NULL,  -- 'audit_conclusions', 'review_requirements', etc.
  audit_id        NVARCHAR(100) NULL,      -- links to specific audit if applicable
  action          NVARCHAR(20)  NOT NULL,  -- 'accepted', 'rejected', 'rephrased'
  ai_text         NVARCHAR(MAX) NULL,      -- what the AI suggested
  final_text      NVARCHAR(MAX) NULL,      -- what the user actually kept (= ai_text if accepted, user edit if rephrased)
  recommendation  NVARCHAR(30)  NULL,      -- AI recommendation tag (conforme, non_conforme, etc.)
  context_summary NVARCHAR(500) NULL,      -- brief description of context used
  model_used      NVARCHAR(50)  NULL,      -- which AI model produced this
  created_at      DATETIME2     NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ai_feedback_user_feature')
  CREATE INDEX IX_ai_feedback_user_feature ON ai_feedback(user_id, feature, created_at DESC);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ai_feedback_org')
  CREATE INDEX IX_ai_feedback_org ON ai_feedback(organization_id, feature, created_at DESC);
