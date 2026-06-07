-- ============================================================================
-- Migration 076: Template albero SGQ con estensione ISO 3834-2
-- ============================================================================
-- sgq_3834_v1: struttura Camellini + sotto-cartelle saldatura (9.x) condizionate
-- a requires_standards ["ISO_3834_2"]. Idempotente.
-- ============================================================================

USE SGQ_ISO9001;
GO

SET NOCOUNT ON;
PRINT '';
PRINT '================================================================================';
PRINT 'Migration 076: Template sgq_3834_v1';
PRINT '================================================================================';
PRINT '';

IF NOT EXISTS (SELECT 1 FROM dbo.document_tree_templates WHERE template_code = 'sgq_3834_v1')
BEGIN
    INSERT INTO dbo.document_tree_templates (template_code, name, description, structure, applicable_standards, is_default)
    VALUES (
        'sgq_3834_v1',
        'Struttura SGQ + Saldatura ISO 3834-2',
        'Albero SGQ standard con sotto-cartelle WPS/WPQR, qualifiche saldatori e CND sotto Produzione quando ISO 3834-2 � attivo.',
        N'[
  {"code":"1","title":"DOCUMENTAZIONE INTERNA","children":[
    {"code":"1.1","title":"MANUALE"},
    {"code":"1.2","title":"PROCEDURE"},
    {"code":"1.3","title":"ISTRUZIONI"},
    {"code":"1.4","title":"MODULI"}
  ]},
  {"code":"2","title":"DOCUMENTAZIONE ESTERNA","children":[
    {"code":"2.1","title":"CERTIFICATI"},
    {"code":"2.2","title":"CAPITOLATI"},
    {"code":"2.3","title":"NORME E LEGGI"}
  ]},
  {"code":"3","title":"CONTESTO DELL''ORGANIZZAZIONE","clause_ref":"4","children":[
    {"code":"3.1","title":"ANALISI CONTESTO"},
    {"code":"3.2","title":"ANALISI AMBIENTALE","requires_standards":["ISO_14001"]},
    {"code":"3.3","title":"ASPETTI AMBIENTALI","requires_standards":["ISO_14001"]},
    {"code":"3.4","title":"GESTIONE DEL CAMBIAMENTO"}
  ]},
  {"code":"4","title":"GESTIONE DEL PERSONALE","clause_ref":"7.2","children":[
    {"code":"4.1","title":"ORGANIGRAMMA"},
    {"code":"4.2","title":"MANSIONARIO"},
    {"code":"4.3","title":"SKILL MATRIX"},
    {"code":"4.4","title":"PIANO FORMAZIONE"},
    {"code":"4.5","title":"QUALIFICHE SALDATORI","requires_standards":["ISO_3834_2"]}
  ]},
  {"code":"5","title":"OBIETTIVI-INDICATORI-KPI","clause_ref":"6.2"},
  {"code":"6","title":"ANALISI RISCHI","clause_ref":"6.1","children":[
    {"code":"6.1","title":"ANALISI RISCHI-OPPORTUNITA''"},
    {"code":"6.2","title":"VALUTAZIONE RISCHI SICUREZZA (DVR)","requires_standards":["ISO_45001"]}
  ]},
  {"code":"7","title":"FORNITORI","clause_ref":"8.4","children":[
    {"code":"7.1","title":"QUALIFICA"},
    {"code":"7.2","title":"MONITORAGGIO"}
  ]},
  {"code":"8","title":"PROGETTAZIONE","clause_ref":"8.3"},
  {"code":"9","title":"PRODUZIONE","clause_ref":"8.5","children":[
    {"code":"9.1","title":"WPS / WPQR","requires_standards":["ISO_3834_2"]},
    {"code":"9.2","title":"DOCUMENTI SALDATURA","requires_standards":["ISO_3834_2"]},
    {"code":"9.3","title":"CND / PROVE NON DISTRUTTIVE","requires_standards":["ISO_3834_2"]}
  ]},
  {"code":"10","title":"EMERGENZE","clause_ref":"8.2","requires_standards":["ISO_14001","ISO_45001"]},
  {"code":"11","title":"RECLAMI-NC-AC","clause_ref":"10.2"},
  {"code":"12","title":"AUDIT","clause_ref":"9.2","children":[
    {"code":"12.1","title":"QUALITA''","requires_standards":["ISO_9001"]},
    {"code":"12.2","title":"AMBIENTE","requires_standards":["ISO_14001"]},
    {"code":"12.3","title":"SICUREZZA","requires_standards":["ISO_45001"]},
    {"code":"12.4","title":"CONFORMITA'' LEGISLATIVA"}
  ]},
  {"code":"13","title":"CUSTOMER SATISFACTION","clause_ref":"9.1.2"},
  {"code":"14","title":"RIESAME DIREZIONE","clause_ref":"9.3"},
  {"code":"15","title":"MIGLIORAMENTO","clause_ref":"10.3"},
  {"code":"99","title":"SCADENZARIO"}
]',
        '["ISO_9001","ISO_14001","ISO_45001","ISO_3834_2"]',
        0
    );
    PRINT '  Template sgq_3834_v1 inserito';
END
ELSE
    PRINT '  Template sgq_3834_v1 gi� presente';
GO

PRINT '';
PRINT 'Migration 076 completata.';
GO
