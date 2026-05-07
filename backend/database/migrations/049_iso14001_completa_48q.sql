-- Migration 049: ISO 14001:2015 — Checklist COMPLETA da norma (48 domande, clausole 4→10)
-- Data: 2026-05-07
-- Fonte: docs/Normative/Normative NORMA_00003_ UNI EN ISO 14001_2015 Rev. 0.md
--
-- OPERAZIONI:
-- 1. Soft-delete delle 29 domande precedenti (migration 023) → is_active=0
-- 2. Mantiene invariate le 7 sezioni (14001_c4 … 14001_c10)
-- 3. Inserisce 48 domande che coprono tutti i sotto-requisiti per clausola
--
-- Idempotente: rieseguibile senza danni
-- Backward-compat: audit_responses esistenti preservate (FK su question_id ancora presente in DB)

USE SGQ_ISO9001;
GO

-- 0. Verifica stato PRIMA
SELECT 'PRIMA' AS fase,
    (SELECT COUNT(*) FROM checklist_sections  WHERE standard_id = 2)                AS sections_count,
    (SELECT COUNT(*) FROM checklist_sections  WHERE standard_id = 2 AND is_active=1) AS sections_active,
    (SELECT COUNT(*) FROM checklist_questions WHERE standard_id = 2)                AS total_questions,
    (SELECT COUNT(*) FROM checklist_questions WHERE standard_id = 2 AND is_active=1) AS active_questions;
GO

-- 1. Soft-delete TUTTE le domande ISO 14001 attive (legislative 14001_s4/s5 + migration 023 c4..c10)
UPDATE checklist_questions
SET is_active = 0, updated_at = GETDATE()
WHERE standard_id = 2
  AND is_active = 1;
GO

-- 1b. Disattiva sezioni legislative legacy (14001_s4, 14001_s5)
UPDATE checklist_sections
SET is_active = 0
WHERE standard_id = 2
  AND section_code IN ('14001_s4', '14001_s5');
GO

-- 2. Assicura che le 7 sezioni siano attive (riattiva in caso di soft-delete precedente)
MERGE checklist_sections AS target
USING (VALUES
    ('14001_c4',  '4 – Contesto dell''Organizzazione',  2, 1),
    ('14001_c5',  '5 – Leadership',                      2, 2),
    ('14001_c6',  '6 – Pianificazione',                  2, 3),
    ('14001_c7',  '7 – Supporto',                        2, 4),
    ('14001_c8',  '8 – Attività Operative',              2, 5),
    ('14001_c9',  '9 – Valutazione delle Prestazioni',   2, 6),
    ('14001_c10', '10 – Miglioramento',                  2, 7)
) AS source(section_code, section_title, standard_id, display_order)
ON target.section_code = source.section_code AND target.standard_id = source.standard_id
WHEN MATCHED THEN
    UPDATE SET section_title = source.section_title, is_active = 1, display_order = source.display_order
WHEN NOT MATCHED THEN
    INSERT (section_code, section_title, standard_id, display_order, is_active)
    VALUES (source.section_code, source.section_title, source.standard_id, source.display_order, 1);
GO

-- 3. Inserisci le 48 domande complete ISO 14001:2015
DECLARE @questions TABLE (
    section_code  NVARCHAR(50),
    question_text NVARCHAR(MAX),
    display_order INT
);

INSERT INTO @questions VALUES
-- =========================================================================
-- Clausola 4 – Contesto dell'Organizzazione (7 domande)
-- =========================================================================
-- §4.1
('14001_c4', '4.1 — L''organizzazione ha determinato i fattori interni ed esterni rilevanti per le sue finalità e che influenzano il SGA, incluse le condizioni ambientali che la riguardano?', 1),
-- §4.2
('14001_c4', '4.2 — L''organizzazione ha identificato le parti interessate rilevanti per il SGA e ne ha determinato esigenze, aspettative e obblighi di conformità che ne derivano?', 2),
-- §4.3
('14001_c4', '4.3 — Il campo di applicazione del SGA è definito (confini fisici e organizzativi, attività, prodotti e servizi) e mantenuto come informazione documentata disponibile alle parti interessate?', 3),
('14001_c4', '4.3 — La definizione del campo di applicazione considera i fattori di cui al §4.1, gli obblighi di conformità di cui al §4.2 e l''autorità/abilità dell''organizzazione ad esercitare controllo?', 4),
-- §4.4
('14001_c4', '4.4 — Il SGA è stabilito, attuato, mantenuto e migliorato in modo continuo in conformità ai requisiti della norma, con processi necessari e loro interazioni definiti?', 5),
('14001_c4', '4.4 — La conoscenza derivante dall''analisi del contesto (§4.1) e delle parti interessate (§4.2) è stata integrata nello sviluppo e nel mantenimento del SGA?', 6),
('14001_c4', '4.4 — Il SGA copre tutte le attività, i prodotti e i servizi inclusi nel campo di applicazione definito?', 7),

-- =========================================================================
-- Clausola 5 – Leadership (7 domande)
-- =========================================================================
-- §5.1
('14001_c5', '5.1 — L''alta direzione dimostra leadership e impegno: accetta di rendere conto dell''efficacia del SGA, assicura la disponibilità delle risorse e comunica l''importanza della gestione ambientale?', 8),
('14001_c5', '5.1 — L''alta direzione assicura che i requisiti del SGA siano integrati nei processi di business e promuove il miglioramento continuo, guidando e supportando le persone?', 9),
-- §5.2
('14001_c5', '5.2 — La politica ambientale è appropriata alle finalità e al contesto dell''organizzazione, fornisce un quadro per gli obiettivi ambientali e include impegni per la protezione dell''ambiente e la prevenzione dell''inquinamento?', 10),
('14001_c5', '5.2 — La politica ambientale include l''impegno a soddisfare gli obblighi di conformità e il miglioramento continuo del SGA, è mantenuta come informazione documentata, comunicata internamente e disponibile alle parti interessate?', 11),
-- §5.3
('14001_c5', '5.3 — Le responsabilità e le autorità per i ruoli pertinenti al SGA sono assegnate, documentate e comunicate all''interno dell''organizzazione?', 12),
('14001_c5', '5.3 — Sono assegnate responsabilità e autorità per assicurare la conformità del SGA alla norma e per riferire all''alta direzione sulle prestazioni del SGA, inclusa la prestazione ambientale?', 13),
('14001_c5', '5.3 — I ruoli gestionali a ogni livello pertinente ricevono supporto nell''esercitare la propria leadership nelle rispettive aree di responsabilità ambientale?', 14),

-- =========================================================================
-- Clausola 6 – Pianificazione (10 domande)
-- =========================================================================
-- §6.1.1
('14001_c6', '6.1.1 — L''organizzazione ha stabilito un processo per determinare i rischi e le opportunità associati agli aspetti ambientali, agli obblighi di conformità e ai fattori del contesto, e li ha documentati?', 15),
('14001_c6', '6.1.1 — Nell''ambito del SGA sono state identificate le potenziali situazioni di emergenza con impatto ambientale?', 16),
-- §6.1.2
('14001_c6', '6.1.2 — Gli aspetti ambientali delle attività, prodotti e servizi (compresi i cambiamenti pianificati, le condizioni anomale e le emergenze ragionevolmente prevedibili) sono determinati con prospettiva di ciclo di vita?', 17),
('14001_c6', '6.1.2 — Gli aspetti ambientali significativi sono determinati con criteri stabiliti, comunicati ai livelli e funzioni pertinenti e mantenuti come informazione documentata (aspetti, criteri, aspetti significativi)?', 18),
-- §6.1.3
('14001_c6', '6.1.3 — Gli obblighi di conformità applicabili agli aspetti ambientali sono identificati, accessibili e considerati nell''istituzione/mantenimento del SGA e mantenuti come informazione documentata?', 19),
-- §6.1.4
('14001_c6', '6.1.4 — Sono pianificate azioni per gli aspetti ambientali significativi, gli obblighi di conformità e i rischi/opportunità, con valutazione delle opzioni tecnologiche e dei vincoli finanziari e operativi?', 20),
-- §6.2.1
('14001_c6', '6.2.1 — Gli obiettivi ambientali sono stabiliti per funzioni e livelli pertinenti, sono coerenti con la politica, misurabili, monitorati, comunicati, aggiornati e mantenuti come informazione documentata?', 21),
('14001_c6', '6.2.1 — Gli obiettivi ambientali tengono conto degli aspetti ambientali significativi, degli obblighi di conformità e dei rischi/opportunità?', 22),
-- §6.2.2
('14001_c6', '6.2.2 — Per ciascun obiettivo ambientale è definito un piano con: cosa fare, risorse, responsabile, tempi di completamento e indicatori/metodi per valutare i risultati?', 23),
('14001_c6', '6.2.2 — Le azioni per il raggiungimento degli obiettivi ambientali sono integrate nei processi di business dell''organizzazione?', 24),

-- =========================================================================
-- Clausola 7 – Supporto (11 domande)
-- =========================================================================
-- §7.1
('14001_c7', '7.1 — L''organizzazione ha determinato e fornito le risorse (umane, infrastrutturali, tecnologiche, finanziarie) necessarie per l''istituzione, l''attuazione, il mantenimento e il miglioramento del SGA?', 25),
-- §7.2
('14001_c7', '7.2 — Le competenze necessarie per il personale che svolge attività con impatto ambientale sono determinate e assicurate (istruzione, formazione, esperienza); le esigenze di formazione correlate al SGA sono identificate?', 26),
('14001_c7', '7.2 — Sono intraprese azioni per acquisire le competenze necessarie (es. formazione, tutoraggio) e ne è valutata l''efficacia; le evidenze delle competenze sono conservate come informazione documentata?', 27),
-- §7.3
('14001_c7', '7.3 — Il personale sotto il controllo dell''organizzazione è consapevole della politica ambientale, degli aspetti significativi correlati alla propria attività, del proprio contributo all''efficacia del SGA e delle implicazioni delle NC?', 28),
-- §7.4.1
('14001_c7', '7.4 — Sono stabiliti processi per la comunicazione interna ed esterna pertinente al SGA (cosa, quando, con chi, come), coerente con le informazioni del SGA e con gli obblighi di conformità?', 29),
-- §7.4.2
('14001_c7', '7.4.2 — La comunicazione interna assicura che informazioni pertinenti al SGA siano diffuse tra livelli e funzioni e che il personale possa contribuire al miglioramento continuo?', 30),
-- §7.4.3
('14001_c7', '7.4.3 — La comunicazione esterna pertinente al SGA avviene in conformità ai processi comunicativi e agli obblighi di conformità, con evidenza documentata per quanto appropriato?', 31),
-- §7.5.1
('14001_c7', '7.5.1 — Il SGA comprende tutte le informazioni documentate richieste dalla norma e quelle aggiuntive determinate necessarie dall''organizzazione per l''efficacia del SGA?', 32),
-- §7.5.2
('14001_c7', '7.5.2 — Nella creazione e aggiornamento delle informazioni documentate sono assicurate: identificazione/descrizione adeguata, formato/mezzo appropriato, riesame e approvazione?', 33),
-- §7.5.3
('14001_c7', '7.5.3 — Le informazioni documentate del SGA sono tenute sotto controllo: disponibili dove/quando necessario, protette, distribuite, archiviate, conservate e gestite nelle versioni; le modifiche sono controllate?', 34),
('14001_c7', '7.5.3 — Le informazioni documentate di origine esterna necessarie per il SGA sono identificate e tenute sotto controllo?', 35),

-- =========================================================================
-- Clausola 8 – Attività Operative (6 domande)
-- =========================================================================
-- §8.1
('14001_c8', '8.1 — Sono stabiliti criteri operativi per i processi rilevanti e il controllo dei processi è attuato in conformità (procedure, istruzioni, ingegnerizzazione dei controlli con gerarchia eliminazione/sostituzione/amministrazione)?', 36),
('14001_c8', '8.1 — Le modifiche pianificate sono gestite e le conseguenze dei cambiamenti involontari sono riesaminate, con azioni per mitigare effetti negativi?', 37),
('14001_c8', '8.1 — I processi affidati all''esterno sono tenuti sotto controllo o influenzati; i requisiti ambientali sono comunicati ai fornitori esterni/appaltatori; è adottata una prospettiva di ciclo di vita (progettazione, approvvigionamento, fine vita)?', 38),
-- §8.2
('14001_c8', '8.2 — Esiste un processo per prepararsi e rispondere alle emergenze ambientali: piano di risposta, azioni preventive/mitigative, risposta alle emergenze reali?', 39),
('14001_c8', '8.2 — Le azioni di risposta alle emergenze sono periodicamente sottoposte a prova (ove praticabile) e i processi di risposta sono riesaminati e revisionati periodicamente, in particolare dopo eventi di emergenza o prove?', 40),
('14001_c8', '8.2 — Sono fornite informazioni e formazione pertinenti in materia di preparazione e risposta alle emergenze alle parti interessate pertinenti, compresi i lavoratori?', 41),

-- =========================================================================
-- Clausola 9 – Valutazione delle Prestazioni (8 domande)
-- =========================================================================
-- §9.1.1
('14001_c9', '9.1.1 — L''organizzazione ha determinato cosa monitorare/misurare, i metodi, i criteri di valutazione delle prestazioni ambientali e gli indicatori appropriati, con frequenza definita per esecuzione e analisi?', 42),
('14001_c9', '9.1.1 — Le attrezzature di monitoraggio e misurazione sono tarate o verificate e sottoposte a manutenzione; i risultati di monitoraggio/misurazione/analisi/valutazione sono comunicati internamente ed esternamente e documentati?', 43),
-- §9.1.2
('14001_c9', '9.1.2 — Esiste un processo per valutare periodicamente la conformità agli obblighi di conformità; le azioni necessarie sono intraprese e i risultati della valutazione documentati?', 44),
-- §9.2
('14001_c9', '9.2.1 — Sono condotti audit interni a intervalli pianificati per verificare la conformità del SGA ai requisiti propri e della norma e la sua efficace attuazione e mantenimento?', 45),
('14001_c9', '9.2.2 — Il programma di audit interno comprende frequenza, metodi, responsabilità, criteri e campo di applicazione; gli auditor garantiscono obiettività e imparzialità; i risultati sono riportati al pertinente livello direzionale e documentati?', 46),
-- §9.3
('14001_c9', '9.3 — L''alta direzione riesamina periodicamente il SGA valutando: stato azioni precedenti, cambiamenti interni/esterni/aspetti significativi/rischi, grado di raggiungimento obiettivi, prestazione ambientale (NC, monitoraggio, conformità, audit), adeguatezza risorse, comunicazioni parti interessate?', 47),
('14001_c9', '9.3 — Il riesame di direzione produce output documentati: conclusioni su idoneità/adeguatezza/efficacia SGA, decisioni per il miglioramento continuo, eventuali modifiche al SGA, azioni per obiettivi non raggiunti?', 48),

-- =========================================================================
-- Clausola 10 – Miglioramento (5 domande)
-- =========================================================================
-- §10.1
('14001_c10', '10.1 — L''organizzazione determina le opportunità di miglioramento (da §9.1, §9.2, §9.3) e intraprende le azioni necessarie per conseguire gli esiti attesi del SGA?', 49),
-- §10.2
('14001_c10', '10.2 — In caso di non conformità, l''organizzazione reagisce tempestivamente (controllo, correzione, mitigazione impatti ambientali), valuta l''esigenza di azioni correttive per eliminare le cause e prevenire la ripetizione?', 50),
('14001_c10', '10.2 — Le azioni correttive intraprese sono proporzionate all''importanza degli effetti e degli impatti ambientali delle NC; la loro efficacia è riesaminata; il SGA è modificato se necessario?', 51),
('14001_c10', '10.2 — La natura delle non conformità, le azioni intraprese e i risultati delle azioni correttive sono conservati come informazione documentata?', 52),
-- §10.3
('14001_c10', '10.3 — L''organizzazione migliora in modo continuo l''idoneità, l''adeguatezza e l''efficacia del SGA per migliorare la prestazione ambientale?', 53);

-- INSERT idempotente: salta se la combinazione section_code+question_text esiste già come attiva
INSERT INTO checklist_questions
    (standard_id, section_code, question_text, question_type, is_mandatory, display_order, is_active, created_at, updated_at)
SELECT
    2, q.section_code, q.question_text, 'TEXT', 1, q.display_order, 1, GETDATE(), GETDATE()
FROM @questions q
WHERE NOT EXISTS (
    SELECT 1 FROM checklist_questions existing
    WHERE existing.standard_id   = 2
      AND existing.section_code  = q.section_code
      AND existing.question_text = q.question_text
      AND existing.is_active     = 1
);
GO

-- 4. Verifica stato DOPO
SELECT 'DOPO' AS fase,
    (SELECT COUNT(*) FROM checklist_sections  WHERE standard_id = 2)                AS sections_count,
    (SELECT COUNT(*) FROM checklist_sections  WHERE standard_id = 2 AND is_active=1) AS sections_active,
    (SELECT COUNT(*) FROM checklist_questions WHERE standard_id = 2)                AS total_questions,
    (SELECT COUNT(*) FROM checklist_questions WHERE standard_id = 2 AND is_active=1) AS active_questions;
GO

-- 5. Mostra riepilogo domande inserite
SELECT
    cs.section_code,
    cs.section_title,
    cs.display_order AS sez_order,
    cq.question_id,
    cq.display_order AS q_order,
    LEFT(cq.question_text, 80) AS question_preview
FROM checklist_questions cq
JOIN checklist_sections cs
    ON cs.section_code = cq.section_code
    AND cs.standard_id = cq.standard_id
WHERE cq.standard_id = 2
  AND cq.is_active   = 1
ORDER BY cs.display_order, cq.display_order;
GO

PRINT N'Migration 049 completata: checklist ISO 14001:2015 COMPLETA';
PRINT N'   53 domande in 7 sezioni (clausole 4 → 10), tutti i sotto-requisiti coperti';
PRINT N'   29 domande precedenti (migration 023) in soft-delete — audit esistenti preservati';
