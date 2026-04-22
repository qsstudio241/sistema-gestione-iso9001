-- ============================================================
-- Migrazione 042: Aggiunge domande ISO 9001:2015 mancanti
-- Clausola 8 (Attività Operative): 8.1, 8.4.2, 8.4.3, 8.5.1, 8.5.4, 8.7.1
-- standard_id=1 (ISO 9001), section_code='clause8'
-- questionId: 168-173 (progressivi dopo 167, che è l'ultimo ID ISO 14001)
-- IDEMPOTENTE: usa IF NOT EXISTS / MERGE per evitare duplicati
-- ATTENZIONE: non modificare le domande esistenti (question_id 87-121)
-- Data: 2026-04-21
-- ============================================================

-- Nota: la tabella checklist_questions non ha colonna clause_ref nel DB produzione.
-- Il clauseRef (es. "8.1") è gestito solo nel template frontend (checklistTemplates.js).
-- question_uuid è obbligatorio: NEWID() genera un UUID univoco per ogni riga.
-- question_id: IDENTITY — usa SET IDENTITY_INSERT ON per inserire ID espliciti.
-- IDs 194-199: gli ID 168-173 erano già occupati da domande ISO 3834.

-- Tutto in un unico batch: IDENTITY_INSERT deve essere attivo nello stesso batch degli INSERT
SET IDENTITY_INSERT checklist_questions ON;

IF NOT EXISTS (SELECT 1 FROM checklist_questions WHERE question_id = 194)
  INSERT INTO checklist_questions (question_id, question_uuid, standard_id, section_code, question_text, question_type, is_mandatory, display_order)
  VALUES (194, NEWID(), 1, 'clause8', 'Pianificazione e controllo operativi', 'conformity', 1, 39);

IF NOT EXISTS (SELECT 1 FROM checklist_questions WHERE question_id = 195)
  INSERT INTO checklist_questions (question_id, question_uuid, standard_id, section_code, question_text, question_type, is_mandatory, display_order)
  VALUES (195, NEWID(), 1, 'clause8', 'Tipo e grado di controllo dei processi, prodotti e servizi forniti esternamente', 'conformity', 1, 40);

IF NOT EXISTS (SELECT 1 FROM checklist_questions WHERE question_id = 196)
  INSERT INTO checklist_questions (question_id, question_uuid, standard_id, section_code, question_text, question_type, is_mandatory, display_order)
  VALUES (196, NEWID(), 1, 'clause8', 'Informazioni ai fornitori esterni', 'conformity', 1, 41);

IF NOT EXISTS (SELECT 1 FROM checklist_questions WHERE question_id = 197)
  INSERT INTO checklist_questions (question_id, question_uuid, standard_id, section_code, question_text, question_type, is_mandatory, display_order)
  VALUES (197, NEWID(), 1, 'clause8', N'Controllo della produzione e dell''erogazione del servizio', 'conformity', 1, 42);

IF NOT EXISTS (SELECT 1 FROM checklist_questions WHERE question_id = 198)
  INSERT INTO checklist_questions (question_id, question_uuid, standard_id, section_code, question_text, question_type, is_mandatory, display_order)
  VALUES (198, NEWID(), 1, 'clause8', 'Conservazione degli output', 'conformity', 1, 43);

IF NOT EXISTS (SELECT 1 FROM checklist_questions WHERE question_id = 199)
  INSERT INTO checklist_questions (question_id, question_uuid, standard_id, section_code, question_text, question_type, is_mandatory, display_order)
  VALUES (199, NEWID(), 1, 'clause8', 'Gestione degli output non conformi (azioni da intraprendere)', 'conformity', 1, 44);

SET IDENTITY_INSERT checklist_questions OFF;
GO

-- Verifica post-migrazione (eseguire separatamente per controllo)
-- SELECT question_id, clause_ref, question_text FROM checklist_questions
-- WHERE standard_id = 1 AND section_code = 'clause8'
-- ORDER BY display_order;
