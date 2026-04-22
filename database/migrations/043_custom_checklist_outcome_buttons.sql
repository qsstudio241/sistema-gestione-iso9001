-- migration: 043_custom_checklist_outcome_buttons.sql
-- Aggiunge flag has_outcome_buttons a custom_checklists
-- e colonna status a audit_custom_checklist_responses.
-- DA ESEGUIRE DAL LEAD AGENT (NON eseguito dal deputy).

ALTER TABLE dbo.custom_checklists
  ADD has_outcome_buttons BIT NOT NULL DEFAULT 0;

ALTER TABLE dbo.audit_custom_checklist_responses
  ADD status NVARCHAR(10) NULL;
