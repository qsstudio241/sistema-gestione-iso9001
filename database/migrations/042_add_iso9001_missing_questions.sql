-- ============================================================
-- Migrazione 042: Aggiunge domande ISO 9001:2015 mancanti
-- Clausola 8 (Attività Operative): 8.1, 8.4.2, 8.4.3, 8.5.1, 8.5.4, 8.7.1
-- standard_id=1 (ISO 9001), section_code='clause8'
-- questionId: 168-173 (progressivi dopo 167, che è l'ultimo ID ISO 14001)
-- IDEMPOTENTE: usa IF NOT EXISTS / MERGE per evitare duplicati
-- ATTENZIONE: non modificare le domande esistenti (question_id 87-121)
-- Data: 2026-04-21
-- ============================================================

-- 8.1 – Pianificazione e controllo operativi
IF NOT EXISTS (SELECT 1 FROM checklist_questions WHERE question_id = 168)
BEGIN
  INSERT INTO checklist_questions
    (question_id, standard_id, section_code, clause_ref, question_text, question_type, is_mandatory, display_order)
  VALUES
    (168, 1, 'clause8', '8.1', 'Pianificazione e controllo operativi', 'conformity', 1, 39);
END;
GO

-- 8.4.2 – Tipo e grado di controllo dei processi, prodotti e servizi forniti esternamente
IF NOT EXISTS (SELECT 1 FROM checklist_questions WHERE question_id = 169)
BEGIN
  INSERT INTO checklist_questions
    (question_id, standard_id, section_code, clause_ref, question_text, question_type, is_mandatory, display_order)
  VALUES
    (169, 1, 'clause8', '8.4.2', 'Tipo e grado di controllo dei processi, prodotti e servizi forniti esternamente', 'conformity', 1, 40);
END;
GO

-- 8.4.3 – Informazioni ai fornitori esterni
IF NOT EXISTS (SELECT 1 FROM checklist_questions WHERE question_id = 170)
BEGIN
  INSERT INTO checklist_questions
    (question_id, standard_id, section_code, clause_ref, question_text, question_type, is_mandatory, display_order)
  VALUES
    (170, 1, 'clause8', '8.4.3', 'Informazioni ai fornitori esterni', 'conformity', 1, 41);
END;
GO

-- 8.5.1 – Controllo della produzione e dell'erogazione del servizio
IF NOT EXISTS (SELECT 1 FROM checklist_questions WHERE question_id = 171)
BEGIN
  INSERT INTO checklist_questions
    (question_id, standard_id, section_code, clause_ref, question_text, question_type, is_mandatory, display_order)
  VALUES
    (171, 1, 'clause8', '8.5.1', 'Controllo della produzione e dell''erogazione del servizio', 'conformity', 1, 42);
END;
GO

-- 8.5.4 – Conservazione degli output
IF NOT EXISTS (SELECT 1 FROM checklist_questions WHERE question_id = 172)
BEGIN
  INSERT INTO checklist_questions
    (question_id, standard_id, section_code, clause_ref, question_text, question_type, is_mandatory, display_order)
  VALUES
    (172, 1, 'clause8', '8.5.4', 'Conservazione degli output', 'conformity', 1, 43);
END;
GO

-- 8.7.1 – Gestione degli output non conformi (azioni da intraprendere)
IF NOT EXISTS (SELECT 1 FROM checklist_questions WHERE question_id = 173)
BEGIN
  INSERT INTO checklist_questions
    (question_id, standard_id, section_code, clause_ref, question_text, question_type, is_mandatory, display_order)
  VALUES
    (173, 1, 'clause8', '8.7.1', 'Gestione degli output non conformi (azioni da intraprendere)', 'conformity', 1, 44);
END;
GO

-- Verifica post-migrazione (eseguire separatamente per controllo)
-- SELECT question_id, clause_ref, question_text FROM checklist_questions
-- WHERE standard_id = 1 AND section_code = 'clause8'
-- ORDER BY display_order;
