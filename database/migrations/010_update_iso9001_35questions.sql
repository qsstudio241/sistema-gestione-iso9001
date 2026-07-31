node --versionssh spascarella@busato.selfip.com -p 1122-- Migration 010: Aggiorna checklist ISO 9001 da 78 a 35 domande (da cliente)
-- Data: 2026-01-17
-- Source: CheckList\ChekList9001.txt

USE SGQ_ISO9001;
GO

-- 1. Rimuovi domande esistenti ISO 9001
DELETE FROM checklist_questions WHERE standard_id = 1;
DELETE FROM checklist_sections WHERE standard_id = 1;
GO

-- 2. Inserisci sezioni ISO 9001 (clausole principali)
INSERT INTO checklist_sections (section_code, section_title, standard_id, display_order) VALUES
('clause4', 'Contesto dell''Organizzazione', 1, 1),
('clause5', 'Leadership', 1, 2),
('clause6', 'Pianificazione', 1, 3),
('clause7', 'Supporto', 1, 4),
('clause8', 'Attività Operative', 1, 5),
('clause9', 'Valutazione delle Prestazioni', 1, 6),
('clause10', 'Miglioramento', 1, 7);
GO

-- 3. Inserisci 35 domande da ChekList9001.txt
INSERT INTO checklist_questions (standard_id, section_code, question_text, question_type, is_mandatory, display_order, is_active) VALUES
-- Clausola 4: Contesto (4 domande)
(1, 'clause4', 'Comprendere l''Organizzazione e il suo contesto', 'text', 1, 1, 1),
(1, 'clause4', 'Esigenze e aspettative delle parti interessate', 'text', 1, 2, 1),
(1, 'clause4', 'Campo di applicazione', 'text', 1, 3, 1),
(1, 'clause4', 'Informazioni necessarie per supportare l''attuazione dei processi', 'text', 1, 4, 1),

-- Clausola 5: Leadership (4 domande)
(1, 'clause5', 'Leadership E Impegno', 'text', 1, 5, 1),
(1, 'clause5', 'Politica per la Qualità', 'text', 1, 6, 1),
(1, 'clause5', 'Comunicazione della Politica per la Qualità', 'text', 1, 7, 1),
(1, 'clause5', 'Ruoli organizzativi, responsabilità e autorità', 'text', 1, 8, 1),

-- Clausola 6: Pianificazione (2 domande)
(1, 'clause6', 'Azioni per affrontare rischi e opportunita', 'text', 1, 9, 1),
(1, 'clause6', 'Obiettivi per la Qualità', 'text', 1, 10, 1),

-- Clausola 7: Supporto (9 domande)
(1, 'clause7', 'Persone', 'text', 1, 11, 1),
(1, 'clause7', 'Infrastruttura', 'text', 1, 12, 1),
(1, 'clause7', 'Ambiente', 'text', 1, 13, 1),
(1, 'clause7', 'Idoneità allo scopo delle risorse per il monitoraggio e la misurazione', 'text', 1, 14, 1),
(1, 'clause7', 'Riferibilità metrologica per la taratura/verifica delle apparecchiature di misura', 'text', 1, 15, 1),
(1, 'clause7', 'Evidenza delle competenze del personale', 'text', 1, 16, 1),
(1, 'clause7', 'Consapevolezza', 'text', 1, 17, 1),
(1, 'clause7', 'Comunicazione', 'text', 1, 18, 1),
(1, 'clause7', 'Informazioni Documentate', 'text', 1, 19, 1),

-- Clausola 8: Attività Operative (10 domande)
(1, 'clause8', 'Requisiti per prodotti e servizi', 'text', 1, 20, 1),
(1, 'clause8', 'Riesame dei requisiti', 'text', 1, 21, 1),
(1, 'clause8', 'Progettazione', 'text', 1, 22, 1),
(1, 'clause8', 'Valutazione, selezione, monitoraggio delle prestazioni e rivalutazione dei fornitori esterni', 'text', 1, 23, 1),
(1, 'clause8', 'Rintracciabilità degli output', 'text', 1, 24, 1),
(1, 'clause8', 'Proprietà del cliente/fornitore', 'text', 1, 25, 1),
(1, 'clause8', 'Post vendita', 'text', 1, 26, 1),
(1, 'clause8', 'Controllo delle modifiche', 'text', 1, 27, 1),
(1, 'clause8', 'Rilascio dei prodotti/servizi', 'text', 1, 28, 1),
(1, 'clause8', 'Descrizione delle Non Conformità, Azioni adottate, concessioni ottenute', 'text', 1, 29, 1),

-- Clausola 9: Valutazione Prestazioni (4 domande)
(1, 'clause9', 'Valutazione delle prestazioni del SGQ (KPI)', 'text', 1, 30, 1),
(1, 'clause9', 'Customer Satisfaction', 'text', 1, 31, 1),
(1, 'clause9', 'Attuazione del programma di audit e risultati di audit', 'text', 1, 32, 1),
(1, 'clause9', 'Risultati dei Riesami di Direzione', 'text', 1, 33, 1),

-- Clausola 10: Miglioramento (2 domande)
(1, 'clause10', 'Non conformità e Azioni Correttive', 'text', 1, 34, 1),
(1, 'clause10', 'Miglioramento continuo', 'text', 1, 35, 1);
GO

-- 4. Verifica
SELECT 
    'Sezioni ISO 9001' AS tipo, 
    COUNT(*) AS count 
FROM checklist_sections 
WHERE standard_id = 1
UNION ALL
SELECT 
    'Domande ISO 9001' AS tipo, 
    COUNT(*) AS count 
FROM checklist_questions 
WHERE standard_id = 1;
GO

PRINT '✅ Migration 010 completata: 35 domande ISO 9001 da checklist cliente';
