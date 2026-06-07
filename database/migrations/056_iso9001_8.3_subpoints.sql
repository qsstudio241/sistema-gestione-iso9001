-- ============================================================
-- Migrazione 056: ISO 9001:2015 — Clausola 8.3 sotto-punti
-- Sostituisce la domanda generica 8.3 "Progettazione" (question_id 108)
-- con i 6 sotto-punti normativi 8.3.1÷8.3.6 (question_id 200-205)
-- standard_id=1 (ISO 9001), section_code='clause8'
-- IDEMPOTENTE: IF NOT EXISTS per ogni INSERT
-- Data: 2026-05-13
-- Segnalazione: Camellini - mancano sotto-punti 8.3.x
-- ============================================================

-- Soft-delete della domanda 8.3 generica (question_id 108)
-- Le risposte esistenti rimangono valide (FK intatta, domanda solo nascosta)
UPDATE checklist_questions
SET is_active = 0, updated_at = GETDATE()
WHERE question_id = 108 AND standard_id = 1;
GO

-- Inserimento 6 sotto-punti 8.3.x con IDENTITY_INSERT
SET IDENTITY_INSERT checklist_questions ON;

IF NOT EXISTS (SELECT 1 FROM checklist_questions WHERE question_id = 200)
  INSERT INTO checklist_questions (question_id, question_uuid, standard_id, section_code, question_text, question_type, is_mandatory, display_order)
  VALUES (200, NEWID(), 1, 'clause8', N'8.3.1 — Progettazione e sviluppo: Generalità', 'conformity', 1, 45);

IF NOT EXISTS (SELECT 1 FROM checklist_questions WHERE question_id = 201)
  INSERT INTO checklist_questions (question_id, question_uuid, standard_id, section_code, question_text, question_type, is_mandatory, display_order)
  VALUES (201, NEWID(), 1, 'clause8', N'8.3.2 — Pianificazione della progettazione e sviluppo', 'conformity', 1, 46);

IF NOT EXISTS (SELECT 1 FROM checklist_questions WHERE question_id = 202)
  INSERT INTO checklist_questions (question_id, question_uuid, standard_id, section_code, question_text, question_type, is_mandatory, display_order)
  VALUES (202, NEWID(), 1, 'clause8', N'8.3.3 — Input alla progettazione e sviluppo', 'conformity', 1, 47);

IF NOT EXISTS (SELECT 1 FROM checklist_questions WHERE question_id = 203)
  INSERT INTO checklist_questions (question_id, question_uuid, standard_id, section_code, question_text, question_type, is_mandatory, display_order)
  VALUES (203, NEWID(), 1, 'clause8', N'8.3.4 — Controlli della progettazione e sviluppo', 'conformity', 1, 48);

IF NOT EXISTS (SELECT 1 FROM checklist_questions WHERE question_id = 204)
  INSERT INTO checklist_questions (question_id, question_uuid, standard_id, section_code, question_text, question_type, is_mandatory, display_order)
  VALUES (204, NEWID(), 1, 'clause8', N'8.3.5 — Output della progettazione e sviluppo', 'conformity', 1, 49);

IF NOT EXISTS (SELECT 1 FROM checklist_questions WHERE question_id = 205)
  INSERT INTO checklist_questions (question_id, question_uuid, standard_id, section_code, question_text, question_type, is_mandatory, display_order)
  VALUES (205, NEWID(), 1, 'clause8', N'8.3.6 — Modifiche della progettazione e sviluppo', 'conformity', 1, 50);

SET IDENTITY_INSERT checklist_questions OFF;
GO

-- Verifica post-migrazione
-- SELECT question_id, question_text, is_active, display_order
-- FROM checklist_questions
-- WHERE standard_id = 1 AND section_code = 'clause8'
-- ORDER BY display_order;

PRINT N'✅ Migration 056 completata: 8.3 generica disattivata, 6 sotto-punti 8.3.1÷8.3.6 inseriti (IDs 200-205)';
