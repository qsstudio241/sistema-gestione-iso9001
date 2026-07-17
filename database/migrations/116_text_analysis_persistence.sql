-- Migration 116 — Persistenza analisi AI del capitolato (riesame requisiti) sul caso commerciale.
-- Generalizza le tabelle della migrazione 101 (estrazione disegni) per accogliere anche
-- l'analisi testuale del capitolato/offerta, evitando tabelle parallele (vedi spec D.3).
--   1) commercial_case_drawing_extractions  -> colonna `source` ('drawing'|'text'|'ocr'|'table')
--   2) commercial_case_extracted_requirements -> estende il CHECK su req_type con i tipi testuali
-- Pattern SQL Server idempotente: IF [NOT] EXISTS; ALTER/ADD CONSTRAINT in statement separati.

-- 1) Colonna `source` sul job di analisi (default 'drawing' per retro-compatibilità coi record esistenti).
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.commercial_case_drawing_extractions') AND name = 'source'
)
BEGIN
    ALTER TABLE commercial_case_drawing_extractions
        ADD source NVARCHAR(20) NOT NULL CONSTRAINT DF_ccde_source DEFAULT 'drawing';
END;

-- CHECK sui valori ammessi per `source` (constraint separata, idempotente).
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_ccde_source' AND parent_object_id = OBJECT_ID('dbo.commercial_case_drawing_extractions')
)
BEGIN
    ALTER TABLE commercial_case_drawing_extractions
        ADD CONSTRAINT CK_ccde_source CHECK (source IN ('drawing','text','ocr','table'));
END;

-- 2) Estende il CHECK su req_type per includere i requisiti di tipo testuale (capitolato/offerta).
--    Drop + re-add idempotente: a regime la constraint contiene già l'insieme completo.
IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_ccer_req_type' AND parent_object_id = OBJECT_ID('dbo.commercial_case_extracted_requirements')
)
BEGIN
    ALTER TABLE commercial_case_extracted_requirements DROP CONSTRAINT CK_ccer_req_type;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_ccer_req_type' AND parent_object_id = OBJECT_ID('dbo.commercial_case_extracted_requirements')
)
BEGIN
    ALTER TABLE commercial_case_extracted_requirements
        ADD CONSTRAINT CK_ccer_req_type CHECK (req_type IN (
            -- tipi da disegno (migr. 101)
            'dimension','tolerance','gdt','material','weld_symbol','surface','note','title_block',
            -- tipi testuali (capitolato/offerta — migr. 116)
            'delivery','legal','commercial','spec'
        ));
END;

-- Indice per recupero veloce dell'ultima analisi testo per caso (filtrato).
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_ccde_case_source' AND object_id = OBJECT_ID('dbo.commercial_case_drawing_extractions')
)
BEGIN
    CREATE INDEX IX_ccde_case_source
        ON commercial_case_drawing_extractions(case_id, source, status, id DESC);
END;
