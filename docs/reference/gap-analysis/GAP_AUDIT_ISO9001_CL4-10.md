# Gap analysis - Modulo Audit ISO 9001 (clausole 4-10)

> Analisi strutturata modulo **audit/checklist ISO 9001:2015** nel perimetro app (`app/`, `backend/`).  
> Skill: `.cursor/skills/gap-analysis-normativa/SKILL.md` - Template: `docs/reference/GAP_ANALYSIS_TEMPLATE.md`

---

## Intestazione

| Campo | Valore |
|-------|--------|
| **Data** | 2026-05-31 |
| **Modulo** | audit (checklist ISO 9001, verbale, export Word, re-audit) |
| **Standard** | ISO_9001_2015 |
| **Scope** | Clausole 4-10 (HLS) - esclusi moduli NC standalone, 14001, 45001, SAL, RDP salvo collegamenti evidenza |
| **Analista** | agente Cursor |

---

## Executive summary

- Il **nucleo operativo audit ISO 9001 è in produzione**: checklist con esiti C/NC/OSS/OM/NA/NV, note, allegati, sync offline, verbale (dati generali + obiettivo), chiusura/approvazione, export Word, pendenze re-audit (`pending_issues`).
- La **checklist attuale conta 41 domande** (`checklistTemplates.js` + migration 042), contro **~47 punti auditabili Conforma** (ADR-002): copertura quantitativa ~**87%**, ma con **sottoclausole accorpate** - rischio audit certificazione **normativo PARZIALE**.
- **Gap P0/P1 principali**: (1) domande mancanti o fuse (6.3, 7.1.1, 7.1.6, 9.1.3, 9.2.1, 9.3.1/9.3.2, 10.1; split 5.1, 8.2, 7.5, 8.3); (2) `norm_excerpt` assente su ISO 9001 nel report Word (presente solo 14001); (3) registro NC in audit non persistito server-side (ponte stub verso `/nc`).
- **Funzionalità trasversali solide**: read-only post-chiusura UI+API, metriche Sezione 11, deep-link pendenze (S-A4), multi-standard base.

---

## Legenda stati (analisi dettagliata)

| Stato | Significato |
|-------|-------------|
| **CONFORME** | Requisito coperto in checklist + flusso audit coerente con Conforma/norma |
| **PARZIALE** | Copertura presente ma incompleta (domanda unica al posto di sottopunti, solo UI, testo generico) |
| **GAP** | Requisito/sottopunto non presente in checklist o flusso |
| **NON APPLICABILE** | Requisito condizionale (es. 8.3 progettazione) - l'app prevede NA ma non distingue sottopunti |
| **NON VERIFICATO** | Non verificabile solo da codice/statico (richiede smoke L3 su produzione) |

---

## Analisi per clausola (4-10)

### Clausola 4 - Contesto dell'organizzazione

| Sottoclausola | Requisito normativo (sintesi operativa) | Evidenza attesa in audit (Conforma) | Implementazione attuale | Stato | Gap / note | Pri | Azione suggerita | Roadmap |
|---------------|----------------------------------------|-------------------------------------|-------------------------|-------|------------|-----|------------------|---------|
| **4.1** | Determinare e monitorare fattori interni/esterni rilevanti per obiettivi e SGQ | Analisi contesto, coerenza con rischi (6.1) e riesame (9.3); evidenze documentali o intervista TM | Domanda checklist `4.1` (`checklistTemplates.js` q87); compilazione via `QuestionCard` + note/allegati; campo `processes` in `GeneralDataSection.jsx` (processi, non contesto esplicito) | **PARZIALE** | Una sola domanda; nessun campo strutturato fattori interni/esterni; nessun link a registro rischi org | P1 | Aggiungere domanda Conforma 4.1 dettagliata o checklist secondaria; opz. collegamento futuro modulo rischi (cl. 6.1 org) | ADR-002; roadmap Fase 0.2 |
| **4.2** | Identificare parti interessate rilevanti e loro requisiti/aspettative | Elenco parti interessate, criterio rilevanza, aggiornamento periodico | Domanda `4.2` (q88); stesso flusso checklist | **PARZIALE** | Copertura a livello singola domanda; testo non allineato verbatim Conforma | P2 | Riformulare testo domanda da Conforma; valutare seconda domanda su solo parti rilevanti | ADR-002 |
| **4.3** | Definire scope SGQ; giustificare esclusioni; scope documentato e disponibile | Scope scritto, coerenza con 4.1/4.2, esclusioni motivate | Domanda `4.3` (q89); campo **scope** in `GeneralDataSection.jsx` -> export Word `{scope}` (`wordExport.js`) | **PARZIALE** | Scope verbale s; nessun campo dedicato esclusioni/giustificazione | P1 | Aggiungere campo UI `scopeExclusions` o sottodomanda checklist 4.3 Conforma | - |
| **4.4** | SGQ e processi: stabilire, mantenere, migliorare; interazioni e criteri | Mappa processi, I/O, criteri metodo, KPI processo, outsourcing | Domanda `4.4` (q90); `processes` in dati generali; metriche aggregate in `AuditOutcomeSection` / `metricsCalculator.js` | **PARZIALE** | 4.4.1 e 4.4.2 fuse; nessuna mappa processi strutturata in audit | P1 | Split 4.4.1/4.4.2 in checklist; testo Conforma | ADR-002 |

**Sintesi clausola 4**: stato **PARZIALE** - copertura ~**75%** vs punti Conforma (4/4 presenti ma granularità insufficiente).

---

### Clausola 5 - Leadership

| Sottoclausola | Requisito normativo (sintesi operativa) | Evidenza attesa in audit | Implementazione attuale | Stato | Gap / note | Pri | Azione suggerita | Roadmap |
|---------------|----------------------------------------|--------------------------|-------------------------|-------|------------|-----|------------------|---------|
| **5.1.1** | Leadership e impegno TM per SGQ | Intervista TM, integrazione SGQ nel business, promozione miglioramento | Domanda unica `5.1` Leadership e Impegno (q91) | **PARZIALE** | Accorpata con 5.1.2 | P1 | Separare 5.1.1 e 5.1.2 come Conforma | ADR-002 |
| **5.1.2** | Focalizzazione sul cliente | Requisiti cliente, soddisfazione, comunicazione | *(inclusa in 5.1)* | **GAP** | Sottopunto non distinto in checklist | P1 | Nuova domanda `5.1.2` da Conforma | ADR-002 |
| **5.2.1** | Stabilire politica qualità appropriata | Politica documentata, coerenza obiettivi | Domanda `5.2.1` (q92) | **CONFORME** | - | - | Mantenere; opz. arricchire testo Conforma | - |
| **5.2.2** | Comunicare politica | Politica comunicata, comprensibile, disponibile | Domanda `5.2.2` (q93) | **CONFORME** | - | - | - | - |
| **5.3** | Ruoli, responsabilità, autorità | Organigramma, mansionari, RQ | Domanda `5.3` (q94) | **CONFORME** | - | - | - | - |

**Sintesi clausola 5**: stato **PARZIALE** - copertura ~**70%** (4 domande vs 5 punti Conforma).

---

### Clausola 6 - Pianificazione

| Sottoclausola | Requisito normativo (sintesi operativa) | Evidenza attesa in audit | Implementazione attuale | Stato | Gap / note | Pri | Azione suggerita | Roadmap |
|---------------|----------------------------------------|--------------------------|-------------------------|-------|------------|-----|------------------|---------|
| **6.1** | Rischi e opportunità; azioni; integrazione processi | Registro rischi, trattamento, efficacia | Domanda `6.1` (q95) | **PARZIALE** | Checklist presente; modulo rischi org separato (`RisksPage`) non integrato in flusso audit | P1 | Domanda Conforma pià specifica; link evidenza da modulo rischi (futuro) | Roadmap cl. 6.1 |
| **6.2** | Obiettivi qualità misurabili, piani, monitoraggio | Obiettivi SMART, chi/quando/come misurare | Domanda `6.2` (q96) | **CONFORME** | - | - | - | - |
| **6.3** | Pianificazione delle modifiche al SGQ | Change planning, impatti, risorse, integrità SGQ | **Assente** in checklist | **GAP** | Nessuna domanda; citato in `DocumentRegistry.jsx` (registro doc) ma non in audit 9001 | **P0** | Inserire domanda 6.3 da Conforma (DB + `checklistTemplates.js`) | ADR-002, roadmap 0.2 |

**Sintesi clausola 6**: stato **PARZIALE** - copertura ~**67%** (2/3 punti Conforma).

---

### Clausola 7 - Supporto

| Sottoclausola | Requisito normativo (sintesi operativa) | Evidenza attesa in audit | Implementazione attuale | Stato | Gap / note | Pri | Azione suggerita | Roadmap |
|---------------|----------------------------------------|--------------------------|-------------------------|-------|------------|-----|------------------|---------|
| **7.1.1** | Generalità risorse | Adeguamento risorse al SGQ | **Assente** | **GAP** | Manca domanda dedicata | P1 | Aggiungere da Conforma | ADR-002 |
| **7.1.2** | Persone | Personale sufficiente e competente | q97 | **CONFORME** | - | - | - | - |
| **7.1.3** | Infrastrutture | Manutenzione, idoneità | q98 | **CONFORME** | - | - | - | - |
| **7.1.4** | Ambiente per il funzionamento dei processi | Condizioni fisiche/sociale | q99 | **CONFORME** | - | - | - | - |
| **7.1.5.1** | Idoneità strumenti monitoraggio | Idoneità apparecchi | q100 | **CONFORME** | - | - | - | - |
| **7.1.5.2** | Riferibilità metrologica | Tarature, certificati | q101 | **CONFORME** | - | - | - | - |
| **7.1.6** | Conoscenza organizzativa | Know-how, lessons learned | **Assente** | **GAP** | Requisito 2015 non in checklist cliente | P1 | Aggiungere domanda Conforma | ADR-002 |
| **7.2** | Competenze | Matrice competenze, formazione | q102 | **CONFORME** | Modulo qualifiche org separato | P2 | Cross-link evidenze qualifiche | Roadmap cl. 7.2 |
| **7.3** | Consapevolezza | Politica, obiettivi, contributo personale | q103 | **CONFORME** | - | - | - | - |
| **7.4** | Comunicazione | Comunicazioni interne/esterne SGQ | q104 | **CONFORME** | - | - | - | - |
| **7.5.1** | Documenti - generalità | Set documenti SGQ | Domanda unica `7.5` (q105) | **PARZIALE** | 7.5.1/7.5.2/7.5.3 fuse | P1 | Split in 3 domande Conforma | ADR-002 |
| **7.5.2** | Creazione e aggiornamento | Approvazione, revisione | *(in 7.5)* | **PARZIALE** | - | P1 | Vedi sopra | ADR-002 |
| **7.5.3** | Controllo informazioni documentate | Distribuzione, conservazione, obsolescenza | *(in 7.5)* | **PARZIALE** | Registro documenti org (`DocumentRegistry`) non collegato automaticamente | P1 | Split + link Registra in documentale (G8 backlog) | REG-NORM-SOT, G8 |

**Sintesi clausola 7**: stato **PARZIALE** - copertura ~**69%** (9/13 punti Conforma).

---

### Clausola 8 - Attivit operative

| Sottoclausola | Requisito normativo (sintesi operativa) | Evidenza attesa in audit | Implementazione attuale | Stato | Gap / note | Pri | Azione suggerita | Roadmap |
|---------------|----------------------------------------|--------------------------|-------------------------|-------|------------|-----|------------------|---------|
| **8.1** | Pianificazione e controllo operativi | Piani operativi, criteri accettazione | q194 (migration 042) | **CONFORME** | Aggiunto 2026-04 | - | - | - |
| **8.2.1** | Comunicazione con il cliente | Canali, feedback | Domanda generica `8.2` (q106) | **PARZIALE** | 8.2.1/8.2.2/8.2.4 non distinti | P1 | Split sottopunti Conforma | ADR-002 |
| **8.2.2** | Determinazione requisiti | Requisiti prodotto/servizio | *(in 8.2)* | **PARZIALE** | - | P1 | Vedi sopra | ADR-002 |
| **8.2.3** | Riesame requisiti | Riesame prima impegno | q107 | **CONFORME** | Modulo Commesse/riesame in backlog separato | P2 | MINI_SPEC_RIESAME | Roadmap Sprint 11 |
| **8.2.4** | Modifiche requisiti | Gestione cambi contrattuali | *(in 8.2)* | **PARZIALE** | - | P1 | Nuova domanda | ADR-002 |
| **8.3** (1-6) | Progettazione e sviluppo | Fasi progettazione, input/output, revisioni, validazione | Domanda unica `8.3` (q108); esito **NA** ammesso | **PARZIALE** / **N/A** | Se applicabile: 6 sottopunti Conforma non distinti | P1 | Flag progettazione applicabile + domande condizionali 8.3.x | ADR-002 |
| **8.4.1** | Controllo fornitori - generalità | Criteri selezione, valutazione | q109 | **CONFORME** | - | - | - | - |
| **8.4.2** | Tipo ed estensione controllo | Outsourcing, controllo processi esterni | q195 (migration 042) | **CONFORME** | - | - | - | - |
| **8.4.3** | Informazioni ai fornitori | Specifiche, approvazioni | q196 | **CONFORME** | - | - | - | - |
| **8.5.1** | Controllo produzione/erogazione | Istruzioni operative, parametri | q197 | **CONFORME** | - | - | - | - |
| **8.5.2** | Identificazione e rintracciabilità | Lotto, serial number | q110 | **CONFORME** | - | - | - | - |
| **8.5.3** | Proprietà cliente/fornitore | Custodia materiali cliente | q111 | **CONFORME** | - | - | - | - |
| **8.5.4** | Conservazione output | Stoccaggio, imballo | q198 | **CONFORME** | - | - | - | - |
| **8.5.5** | Post-vendita | Garanzia, assistenza | q112 | **CONFORME** | - | - | - | - |
| **8.5.6** | Controllo modifiche | Change control produzione | q113 | **CONFORME** | - | - | - | - |
| **8.6** | Rilascio prodotti/servizi | Criteri rilascio, registrazioni | q114 | **CONFORME** | - | - | - | - |
| **8.7.1** | Output NC - azioni | Segregazione, correzione | q199 | **CONFORME** | - | - | - | - |
| **8.7.2** | Output NC - registrazione | Tracciamento NC prodotto | q115 | **CONFORME** | Collegamento concettuale a NC audit / modulo `/nc` | P2 | Rafforzare ponte audit -> NC org | G6, S-A6 |

**Sintesi clausola 8**: stato **PARZIALE** - copertura ~**78%** (16/23 punti Conforma; ~88% se 8.3 escluso come N/A).

---

### Clausola 9 - Valutazione delle prestazioni

| Sottoclausola | Requisito normativo (sintesi operativa) | Evidenza attesa in audit | Implementazione attuale | Stato | Gap / note | Pri | Azione suggerita | Roadmap |
|---------------|----------------------------------------|--------------------------|-------------------------|-------|------------|-----|------------------|---------|
| **9.1.1** | Monitoraggio, misurazione, analisi - generalità | KPI, metodi, frequenza | q116 | **CONFORME** | - | - | - | - |
| **9.1.2** | Soddisfazione cliente | Indagini, reclami, trend | q117 | **CONFORME** | - | - | - | - |
| **9.1.3** | Analisi e valutazione | Analisi dati, decisioni | **Assente** | **GAP** | Terzo sottopunto 9.1 Conforma mancante | **P0** | Aggiungere domanda 9.1.3 | ADR-002 |
| **9.2.1** | Audit interni - programma | Piano audit, copertura processi | **Assente** (solo 9.2.2) | **GAP** | Programma audit != risultati audit | **P0** | Domanda 9.2.1; collegare a meta-audit (pianificazione in `GeneralDataSection` parziale) | ADR-002 |
| **9.2.2** | Audit interni - esecuzione e report | Report audit, follow-up | q118 | **CONFORME** | L'app à lo strumento di audit interno | - | - | - |
| **9.3.1** | Riesame direzione - generalità | Periodicità, partecipazione TM | **Assente** | **GAP** | Solo output 9.3.3 in checklist | P1 | Domande 9.3.1, 9.3.2 | ADR-002 |
| **9.3.2** | Riesame direzione - input | Input obbligatori (audit, NC, obiettivi...) | **Assente** | **GAP** | - | P1 | Vedi sopra | ADR-002 |
| **9.3.3** | Riesame direzione - output | Decisioni, risorse, miglioramenti | q119 | **CONFORME** | - | - | - | - |

**Sintesi clausola 9**: stato **PARZIALE** - copertura ~**57%** (4/7 punti Conforma) - **clausola pià debole**.

---

### Clausola 10 - Miglioramento

| Sottoclausola | Requisito normativo (sintesi operativa) | Evidenza attesa in audit | Implementazione attuale | Stato | Gap / note | Pri | Azione suggerita | Roadmap |
|---------------|----------------------------------------|--------------------------|-------------------------|-------|------------|-----|------------------|---------|
| **10.1** | Generalità - miglioramento | Opportunità da 9.x, azioni | **Assente** in checklist 9001 | **GAP** | Presente in template 14001 (q271) ma non 9001 | P1 | Aggiungere 10.1 | ADR-002 |
| **10.2** | NC e azioni correttive | Registro NC, cause, efficacia | q120; `NonConformitiesManager.jsx` in audit; modulo `/nc` con drawer ISO 10.2; stub Registra nel modulo NC (S-A6) | **PARZIALE** | NC audit **non persistite** server (`nonConformities: []` in converter); metriche NC = esiti checklist | P1 | Persistenza o deprecazione registro audit; flusso unico verso `/nc` | G6, NC module |
| **10.3** | Miglioramento continuo | Evidenze PDCA, obiettivi miglioramento | q121 | **CONFORME** | - | - | - | - |

**Sintesi clausola 10**: stato **PARZIALE** - copertura ~**67%** (2/3 punti Conforma + gap funzionale NC).

---

## Matrice gap (formato template)

| Modulo | Clausola / requisito | Fonte | Stato app oggi | Gap | Tipo | Priorit | Evidenza file |
|--------|----------------------|-------|----------------|-----|------|----------|---------------|
| audit | 4.1-4.4 Contesto | ISO cl.4 + Conforma cl.4 | Parziale | Sottopunti 4.4.1/4.4.2 fusi; scope senza esclusioni | Normativo | P1 | `checklistTemplates.js`, `GeneralDataSection.jsx` |
| audit | 5.1.1 / 5.1.2 Leadership | ISO cl.5.1 + Conforma | Parziale | 5.1.2 cliente non distinto | Normativo | P1 | `checklistTemplates.js` q91 |
| audit | 5.2-5.3 Politica e ruoli | ISO cl.5.2-5.3 | Implementato | - | - | - | q92-94 |
| audit | 6.3 Pianificazione modifiche | ISO cl.6.3 + Conforma | Assente | Domanda mancante | Normativo | **P0** | ADR-002 |
| audit | 6.1-6.2 Rischi/obiettivi | ISO cl.6.1-6.2 | Parziale | Non integrato modulo rischi org | Funzionale | P1 | `RisksPage.jsx` (fuori audit) |
| audit | 7.1.1 / 7.1.6 Risorse | ISO cl.7.1 | Assente | 2 domande mancanti | Normativo | P1 | ADR-002 |
| audit | 7.5 Documenti | ISO cl.7.5 + Conforma | Parziale | 7.5.1/2/3 fuse | Normativo | P1 | q105 |
| audit | 8.1-8.7 Operatività | ISO cl.8 + mig. 042 | Parziale | 8.2.x split; 8.3.x condizionale | Normativo | P1 | `042_add_iso9001_missing_questions.sql` |
| audit | 9.1.3 Analisi dati | ISO cl.9.1.3 | Assente | Domanda mancante | Normativo | **P0** | - |
| audit | 9.2.1 Programma audit | ISO cl.9.2.1 | Assente | Solo 9.2.2 | Normativo | **P0** | q118 |
| audit | 9.3.1-9.3.2 Riesame input | ISO cl.9.3 | Assente | Solo 9.3.3 | Normativo | P1 | q119 |
| audit | 10.1 Miglioramento gen. | ISO cl.10.1 | Assente | Domanda mancante | Normativo | P1 | - |
| audit | 10.2 NC in audit | ISO cl.10.2 | Parziale | Registro NC audit non su server | Funzionale | P1 | `NonConformitiesManager.jsx`, `auditConverter.js` |
| audit | norm_excerpt report Word | Roadmap 0.4 | Assente (9001) | Stralcio norma solo 14001 | Funzionale | P1 | `ExportPanel.jsx`, `ChecklistAdminPage.jsx` |
| audit | Read-only post-chiusura | ISO cl.7.5/9.2 tracciabilità | Implementato | UI+API bloccano edit | - | - | `AuditAccordionLayout.jsx`, `response.controller.js` |
| audit | Export Word verbale | ISO cl.9.2 evidenza | Implementato | Template + checklist colorata | - | - | `wordExport.js` |
| audit | Re-audit pendenze | ISO cl.10.2 follow-up | Implementato | Deep-link S-A4 | - | - | `PendingIssuesCascade.jsx` |
| audit | Sezione 11 drill-down NC | UX audit | Parziale | Solo metriche aggregate | Funzionale | P2 | `AuditOutcomeSection.jsx`, G5 |

---

## Funzionalità trasversali modulo audit (clausole 4-10)

| Area | Descrizione | File / API | Stato |
|------|-------------|------------|-------|
| Shell audit | Route `/audit`, lista, creazione, re-audit | `App.jsx`, `AuditSelector.jsx` | CONFORME |
| Verbale - dati generali | Scope, processi, date, auditor, standard | `GeneralDataSection.jsx`, `audit.controller.js` | PARZIALE |
| Verbale - obiettivo | Obiettivo, partecipanti | `AuditObjectiveSection.jsx` | CONFORME |
| Checklist ISO 9001 | 41 domande, accordion clausole | `ChecklistModule.jsx`, `QuestionCard.jsx`, `GET /checklist/questions` | PARZIALE |
| Esiti e note | C/NC/OSS/OM/NA/NV + textarea + allegati | `QuestionCard.jsx`, `AttachmentSection.jsx`, `response.controller.js` | CONFORME |
| Metriche / Sezione 11 | Conteggio NC/OSS/OM per ISO+custom | `metricsCalculator.js`, `AuditOutcomeSection.jsx` | PARZIALE |
| Chiusura / approvazione | Soglia 100% risposte, stati completed/approved | `AuditClosePanel.jsx`, API complete/approve | CONFORME |
| Export Word | Report audit + tabella checklist | `ExportPanel.jsx`, `wordExport.js`, template `.docx` | CONFORME |
| Sync offline | IndexedDB, server-wins, bulk save | `StorageContext.jsx`, `syncService.js`, ADR-008 | CONFORME |
| Pendenze re-audit | NC/OSS/NV da audit precedente | `pending_issues`, `PendingIssuesCascade.jsx` | CONFORME |
| NC collegate | Registro locale + push modulo NC | `NonConformitiesManager.jsx`, `nc.controller.js` | PARZIALE |
| AI assistenza clausola | Focus clausola attiva | `AiAssistantPage.jsx`, `aiAssistantContext.js` | PARZIALE |

---

## Limiti documentali rilevati

| Voce mancante | Impatto | Fonte alternativa |
|---------------|---------|-------------------|
| `checklistInitializer.js` (legacy 26 domande) | **Rimosso/assente** - ADR-002 riferisce file obsoleto | `checklistTemplates.js`  la fonte FE attuale |
| Allineamento quantitativo Conforma automatizzato | Gap analysis manuale | Parsing `Quaderni/Linea Guida Conforma 9001_2015.txt` (ADR-002 Opzione A non completata) |
| `Quaderno_2_Linea_Guida_1090.txt` (+ md/json) | Digitalizzata 26/08/2026 | Non impatta ISO 9001 cl. 4-10 (contesto EN 1090) |
| Tabella `norm_requirements` vs checklist UI | Due livelli distinti (ADR-010) | Seed `import-norms-from-markdown.js` - non equivale a copertura checklist |
| `clauseRef` solo frontend | DB non ha colonna `clause_ref` per ISO 9001 (migration 042) | Mapping in `checklistTemplates.js` |

---

## Slice consigliate

| ID | Titolo | Perimetro | Priorit |
|----|--------|-----------|----------|
| **GA-9001-01** | Completare checklist Conforma (6.3, 7.1.1, 7.1.6, 9.1.3, 9.2.1, 9.3.1, 9.3.2, 10.1) | Migration SQL + `checklistTemplates.js` + sync API | **P0** |
| **GA-9001-02** | Split sottoclausole fuse (5.1, 8.2, 7.5, 8.3 condizionale) | ADR-002 Opzione A - seed da Conforma | P1 |
| **GA-9001-03** | `norm_excerpt` ISO 9001 in Word | Roadmap 0.4 - admin UI già pronta | P1 |
| **GA-9001-04** | NC audit -> persistenza o solo modulo `/nc` | Decisione G6 / S-A6 estensione | P1 |
| **GA-9001-05** | Campo scope esclusioni + split 4.4 | `GeneralDataSection` + template Word | P2 |

---

## Riferimenti consultati

- [x] `docs/Normative/UNI EN ISO 9001_2015 Rev. 0.md`
- [x] `Quaderni/Linea Guida Conforma 9001_2015.txt`
- [x] `Quaderni/Quaderni Qualità 2-Fattori del contesto e parti interessate_ocred.txt` (contesto 4.1-4.2)
- [x] `Quaderni/Quaderni Qualità 3-Risk based thinking_ocred.txt` (6.1)
- [x] `Quaderni/Quaderni Qualità 4-Approccio per processi_ocred.txt` (4.4)
- [x] `Quaderni/Quaderni qualità 5-Audit_ocred.txt` (metodologia audit)
- [x] `docs/PROJECT_ROADMAP.md`
- [x] `docs/agent-tasks/AUDIT_MODULE_LEAD_BRIEF.md`
- [x] `docs/adr/ADR-002-checklist-alignment-strategy.md`
- [x] Codice: `checklistTemplates.js`, `ChecklistModule.jsx`, `QuestionCard.jsx`, `GeneralDataSection.jsx`, `AuditOutcomeSection.jsx`, `AuditClosePanel.jsx`, `ExportPanel.jsx`, `wordExport.js`, `PendingIssuesCascade.jsx`, `NonConformitiesManager.jsx`, `response.controller.js`, migration `010`, `042`

---

## Sintesi finale

### Tabella riepilogo copertura per clausola

| Clausola | Titolo | Domande app | Punti Conforma | Copertura quantitativa | Stato complessivo |
|----------|--------|-------------|----------------|------------------------|-------------------|
| **4** | Contesto organizzazione | 4 | 4 | ~75% (granularità) | **PARZIALE** |
| **5** | Leadership | 4 | 5 | ~70% | **PARZIALE** |
| **6** | Pianificazione | 2 | 3 | ~67% | **PARZIALE** |
| **7** | Supporto | 9 | 13 | ~69% | **PARZIALE** |
| **8** | Attivit operative | 16 | 23 (18 se 8.3 N/A) | ~78% (~88% senza 8.3) | **PARZIALE** |
| **9** | Valutazione prestazioni | 4 | 7 | ~57% | **PARZIALE** |
| **10** | Miglioramento | 2 | 3 | ~67% | **PARZIALE** |
| **Totale** | | **41** | **~47** | **~87%** (con accorpamenti) | **PARZIALE** |

*Copertura funzionale flusso audit (compilazione, evidenze, export, re-audit): ~**85%*** - superiore alla sola checklist grazie a verbale, allegati e pendenze.

### Top 5 gap P0/P1

| # | Gap | Tipo | Pri |
|---|-----|------|-----|
| 1 | **6 domande Conforma assenti** (6.3, 7.1.1, 7.1.6, 9.1.3, 9.2.1, 10.1) + split 9.3.1/9.3.2 | Normativo | **P0** |
| 2 | **Sottoclausole fuse** (5.1.1/5.1.2, 8.2.x, 7.5.x, 8.3.x) - audit certificazione richiede granularità Conforma | Normativo | P1 |
| 3 | **`norm_excerpt` assente su ISO 9001** nel report Word (disponibile solo 14001) | Funzionale | P1 |
| 4 | **Registro NC in audit non persistito** su server; disallineamento metriche checklist vs registro CAPA | Funzionale | P1 |
| 5 | **Clausola 9 incompleta** (manca programma audit 9.2.1 e input riesame 9.3.1/9.3.2) - rischio debolezza su cl. 9 | Normativo | **P0** |

### Raccomandazioni ordinate

**Quick wins (1-2 settimane)**

1. Migration + template: aggiungere le **8 domande mancanti** a priorità P0/P1 (lista GA-9001-01).
2. Popolare **`norm_excerpt`** per ISO 9001 via `ChecklistAdminPage.jsx` (roadmap 0.4) - infrastruttura già pronta.
3. Riformulare testi domande esistenti allineandoli a Conforma (senza cambiare ID domanda).

**Interventi strutturali (2-4 settimane)**

4. Eseguire **ADR-002 Opzione A**: seed checklist da Conforma con `clause_ref` in DB (oggi `clauseRef` solo FE).
5. Domande **8.3 condizionali** (mostrare sottopunti solo se non NA).
6. Chiudere **G6**: una sola fonte NC (modulo `/nc`) o persistenza registro audit server-side.
7. Campo **esclusioni scope** nel verbale + export Word.

**Non urgenti (P2)**

8. Drill-down Sezione 11 (G5); token monouso allegati Word (G7); export -> documentale (G8); allegati offline SYNC-5 (G9).

---

*Documento generato per review committente. Nessun commit automatico.*
