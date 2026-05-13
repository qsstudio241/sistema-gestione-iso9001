# ADR-009 � Architettura multi-standard / multi-document_type per-norma + AI-ready

> **Stato**: Accettato � 8 maggio 2026
> **Autori**: Lead architect (AI), Product owner
> **Sostituisce parzialmente**: nessun ADR (estende il modello dati senza romperlo)
> **Vincolante**: ogni nuova feature che tocchi audit/SAL/RDP o aggiunga uno standard deve essere progettata in modo compatibile con questo modello.

---

## Contesto e motivazione

### Il bug che ha innescato la riflessione

L'8 maggio 2026, durante la giornata di stabilizzazione di Camellini in produzione, sono emersi 4 bug consecutivi di natura architetturale:

1. **Exception 1 in reconcile** usava `!serverField` per oggetti che potevano essere `{}` truthy ma vuoti ? campi testo si svuotavano dopo qualche secondo dall'apertura audit
2. **Exception 4 in reconcile** aveva condizione hardcoded `serverChecklistKeys[0] === 'ISO_9001'` ? audit con 2+ standard (ISO 9001 + ISO 14001) perdevano risposte/note ogni 45 secondi
3. **`requireLicensedModule`** ignorava il ruolo ? admin riceveva `403 MODULE_NOT_LICENSED` su moduli base
4. **CORS** mancante quando il backend era in restart (nginx restituiva 502 muto)

Tutti e 4 sono **sintomi della stessa debolezza strutturale**: l'app � nata mono-standard (ISO 9001) e i moduli per ISO 14001 / 45001 / 3834-2 / RDP / Custom checklist / SAL sono stati appiccicati sopra a colpi di `if (norm === 'ISO_9001')`. Il debito � tracciabile in:

- `auditConverter.js` � fallback hardcoded ISO_9001
- `StorageContext.jsx` Exception 4 � condizione single-standard
- `AuditAccordionLayout.jsx` `STANDARDS_CONFIG` locale (non SoT condivisa)
- `AuditOutcomeSection.jsx` � una sola casella conclusioni
- `AuditClosePanel.jsx` � soglia di completamento globale, non per-norma
- `wordExport.js` � pensato per "il template ISO 9001"
- `exportPreferences.embedPhotos` � flag globale, non per-norma

### La vision finale del prodotto

Dai documenti di progetto (`PROJECT_ROADMAP.md`, decisione 05/04/2026 "6 entit� universali", Sprint 9-12, vision vincolante 08/04/2026):

> Piattaforma SaaS multi-tenant per la **gestione documentale integrata di SGQ aziendali**, dove l'AI � il moltiplicatore di valore per estrazione/indicizzazione/assistenza contestuale.

Il **modulo audit � dichiarato pilastro e pilota** dell'intero design del `document_registry`: l'architettura multi-standard di audit/SAL/RDP guida le decisioni di schema del registro documentale e dei moduli AI a valle.

### Cosa va deciso in modo strutturale

1. Come si separa ci� che � **per-norma** da ci� che � **condiviso** in un audit multi-standard
2. Come si distingue il caso **sistemi integrati** (Annex SL / HLS) dal caso **non-integrati** (richiedono report e conteggi separati)
3. Come si modellano in modo uniforme **audit, SAL, RDP, riesame contratto, futuri** senza far esplodere il codice
4. Come si rendono i **componenti UI modulari** in modo che diventino punti di aggancio per AI/RAG senza richiedere riscrittura
5. Come si predispone il modello dati ad essere **schema-first** (utile per RAG e LLM)

---

## Decisione

### 1. Modello a due assi ortogonali: `document_type` � `selectedStandards[]`

Un documento del SGQ � caratterizzato da **due assi indipendenti**:

```js
audit.metadata = {
  documentType: 'audit' | 'sal' | 'rdp' | 'contract_review' | <futuri>,
  selectedStandards: ['ISO_9001', 'ISO_14001', 'CUSTOM_42'],   // 0..N norme
  isIntegratedSystem: true | false,                            // valido solo per kind='iso_hls'
  ...campi condivisi (numero, data, azienda, auditor, scope, processi, agenda)
}
```

**Asse 1 � `document_type`**: determina la **shell UI** (componente di compilazione/chiusura) e il **template export base**. Esempi:
- `'audit'` ? checklist + risposte C/NC/OSS/OM/NA/NV
- `'sal'` ? tracker requisiti � stati Discusso/In corso/Da validare/Completato
- `'rdp'` ? form prove + galleria foto + note (Mason, RDP saldatura, VT/MT/PT)
- `'contract_review'` ? matrice requisiti committente vs capacit� (Sprint 11)

**Asse 2 � `selectedStandards[]`**: determina **conteggi per norma**, **conclusioni per norma**, **stralci normativi**, **export per certificatore**. Pu� essere vuoto (`[]`) per documenti puramente custom (es. RDP Mason senza ISO).

### 2. Modello dati per-norma `byStandard[key]`

Tutti i campi che hanno significato per-norma vivono sotto una mappa con la stessa shape:

```js
audit = {
  metadata: { ... },
  checklist: {                      // contenitore parametrico (gi� esistente)
    ISO_9001:  { clause4: { questions: [...] }, ... },
    ISO_14001: { clause4: { questions: [...] }, ... },
    CUSTOM_42: { ... }
  },
  byStandard: {                     // ? NUOVO: tutto ci� che � per-norma
    ISO_9001: {
      conclusions: '...',
      decision: 'conforme' | 'nc_minore' | 'nc_maggiore' | null,
      completionThreshold: 80,
      exportPreferences: { embedPhotos: false, includeAttachments: true, template: null }
    },
    ISO_14001: { ... },
    CUSTOM_42: { ... }
  },
  metrics: {
    overall: { total, answered, conformities, nc, oss, om, completionPercentage },
    byStandard: { ISO_9001: {...}, ISO_14001: {...}, CUSTOM_42: {...} }
  }
}
```

**Persistenza server**: il campo va in `audits.audit_extra_data.byStandard` (il JSON � gi� flessibile, nessuna migrazione DB richiesta nella fase iniziale).

### 3. Registro standard come Source of Truth

Si elimina il duplicato `STANDARDS_CONFIG` locale in `AuditAccordionLayout.jsx`. Si crea un registro centralizzato:

```js
// app/src/data/standardsRegistry.js
export const STANDARDS_REGISTRY = {
  ISO_9001:   { standardId: 1, code: 'ISO_9001_2015',   label: '...', icon: '??',
                kind: 'iso_hls',     templateExport: 'iso9001-report.docx' },
  ISO_14001:  { standardId: 2, code: 'ISO_14001_2015',  label: '...', icon: '??',
                kind: 'iso_hls',     templateExport: 'iso14001-report.docx' },
  ISO_45001:  { standardId: 3, code: 'ISO_45001_2018',  label: '...', icon: '??',
                kind: 'iso_hls',     templateExport: 'iso45001-report.docx' },
  ISO_3834_2: { standardId: 6, code: 'ISO_3834_2',      label: '...', icon: '??',
                kind: 'iso_process', templateExport: 'iso3834-report.docx' },
  RDP_MSN:    { standardId: 7, code: 'RDP_MSN',         label: '...', icon: '??',
                kind: 'rdp',         templateExport: 'rdp-mason-report.docx',
                requiresPhotos: true },
  // CUSTOM_<id> aggiunti runtime quando l'audit ha un custom_checklist_id
};
```

**Propriet� chiave `kind`**: classifica lo standard per consentire/vietare combinazioni:
- `iso_hls` � standard ISO con High Level Structure (9001, 14001, 45001) ? integrabili tra loro
- `iso_process` � standard ISO di processo (3834-2) ? non integrabili con HLS
- `rdp` � rapporti specialistici (RDP Mason, futuri VT/MT/PT) ? singoli, non integrabili
- `custom` � checklist personalizzate ? norma virtuale, mai integrabili con altre

**Test di scalabilit�**: aggiungere un nuovo standard ISO (es. ISO 27001) deve richiedere SOLO:
1. `INSERT INTO standards (...)` + seed domande
2. Una riga in `STANDARDS_REGISTRY`
3. (Opzionale) un template Word dedicato

E **niente altre modifiche** al codice frontend.

### 4. Flag `isIntegratedSystem` � sistemi integrati vs non-integrati

**Decisione**:
- Flag impostato all'atto della selezione standard (creazione audit / aggiunta standard a draft)
- **Valido solo** se TUTTI gli standard selezionati hanno `kind === 'iso_hls'`
- **Immutabile dopo la prima risposta compilata**, modificabile solo finch� l'audit � in stato `draft` puro (zero risposte e zero modifiche a campi ricchi)

**Cosa cambia in funzione del flag** (riassunto operativo):

| Aspetto | `isIntegratedSystem=true` | `isIntegratedSystem=false` |
|---|---|---|
| Sidebar conteggi | 1 totale unico ("5 NC, 3 OSS") | Per norma ("9001: 2 NC � 14001: 3 NC") |
| Sezione 11 conclusioni | 1 casella "Conclusioni complessive" | Tab per norma + opzionale "Sintesi" |
| Esito / decisione | 1 esito complessivo del SGI | 1 esito per norma |
| AuditClosePanel | 1 soglia di completamento globale | Checklist per norma "ISO 9001 ? / ISO 14001 ?" |
| Status audit | Unico (`completed` quando tutto chiuso) | Unico, ma chiusura richiede checkpoint per ogni norma |
| Export Word | 1 file integrato (con tutte le norme) | n file (uno per norma) + ZIP "tutti" + opzione "integrato" facoltativa |

### 5. Cosa � per-norma vs cosa � condiviso

Mappa di riferimento (vincolante per design):

| Elemento | Per norma? | Note |
|---|---|---|
| **Anagrafica** (numero audit, data, azienda, auditor, programma) | ? Unico | Stesso evento, stessa azienda, stesso giorno |
| **Obiettivo audit** (descrizione, agenda, partecipanti) | ? Unico | "Verifica SGI integrato 9001+14001" � UNA descrizione |
| **Scope / Processi / Documenti riferimento** | ? Unici | Spesso convergono nello stesso audit |
| **Checklist domande/risposte** | ? Per norma | Gi� cos� oggi (corretto) |
| **Conteggi NC/OSS/OM** | ? Per norma + totale | Per il certificatore di 9001 contano solo le NC 9001 |
| **Conclusioni** | ? Per norma + opz. complessiva | Vedi flag `isIntegratedSystem` |
| **Decisione finale (esito)** | ? Per norma se non-integrato | Posso dichiarare 9001 conforme e 14001 da rivedere |
| **Soglia completamento per chiusura** | ? Per norma | Override per norma su soglia di default |
| **Status audit** (draft / in_progress / completed) | ? Unico | � UN documento � `completed` significa "tutte le norme chiuse o esplicitamente saltate" |
| **Export Word/PDF** | ? Per norma + integrato opz. | Certificatori diversi vogliono il loro report |
| **Opzioni export** (foto, allegati, intestazioni) | ? Per norma | Posso volere foto in 14001 ma non in 9001 |
| **Allegati audit** | ? Unici | Allegati appartengono all'audit; un allegato pu� essere riferito a domanda di qualsiasi norma |
| **Pending issues / Rilievi pendenti tra audit** | ? Per norma | Un pending nasce su una clausola di una norma specifica |
| **Lock acquisition** | ? Unico | Lock � sull'intero audit, indipendente dalle norme |

### 6. RDP come specializzazione di custom checklist

**Tecnicamente** RDP � una custom checklist con:
- `has_outcome_buttons = false` (no C/NC/OSS/OM, solo "fatto/note/foto")
- `requires_photos = true` (campo da aggiungere a `custom_checklists`)
- Template Word dedicato (`rdp-mason-report.docx`)

**A livello prodotto** RDP � esposto come `document_type='rdp'` � voce di menu separata, validazioni specifiche di chiusura (foto obbligatorie su ogni voce), pannello di compilazione dedicato `<RDPModule>`.

**Sotto il cofano** RDP riusa il motore custom checklist (stesse tabelle DB `custom_checklists` / `audit_custom_checklist_responses`, stesso componente di compilazione `CustomChecklistAuditView` arricchito), zero codice duplicato.

Lo stesso pattern si applicher� a futuri rapporti specialistici (VT, MT, PT, ecc.): tipo documento separato in superficie, motore custom + flag specifici sotto.

### 7. SAL come modulo gestionale separato (non un audit)

**Tecnicamente** SAL � `document_type='sal'`. Differenze strutturali rispetto ad un audit:

| Audit | SAL |
|---|---|
| Evento con data e durata fisse | Stato che evolve nel tempo (mese dopo mese) |
| Conteggi NC/OSS/OM | Conteggio "Discusso/In corso/Da validare/Completato" |
| Si chiude e si congela | Si aggiorna periodicamente (revisioni) |
| Output: report verbale | Output: tracker continuo + revisioni |
| 1 lead auditor | Consulente + azienda con dialogo continuo |
| Allegati come evidenze del momento | Documenti del registro come stato implementazione |

**Riuso massimo**: SAL **deve** appoggiarsi alla tabella `document_registry` (Sprint 1 � gi� in produzione) con un overlay di stato implementazione. Niente nuove tabelle base, solo:
- Filtri per categoria documentale gi� esistenti
- Asse "stato implementazione" sovrapposto a "stato documentale"
- Albero documentale specifico per norma del SGI auditato

`document_type='sal'` con stesso registro standard, stesso modello `byStandard[key]` per i tracker requisiti per norma.

### 8. Custom checklist come "norma virtuale"

Le custom checklist (`custom_checklists` con `id` e `name`) diventano norme virtuali con chiave `CUSTOM_<id>` nel `STANDARDS_REGISTRY` (caricate runtime). Un audit ibrido (es. ISO 9001 + checklist custom) trovs entrambe nelle tab parallele, conteggi separati, export indipendenti.

**Gi� pronto al 80%**: `audit_custom_checklist_responses` � separato, `calculateCustomFindingsMetrics` esiste. Manca solo il **modello UI** che le tratti come pari grado di una ISO.

### 9. Componenti UI modulari come architettura abilitante per AI

I componenti standard replicabili sono il cuore della scalabilit� e il punto di aggancio per AI:

| Componente | Riusato in | Hook AI futuro |
|---|---|---|
| `<NormConclusionsBlock normKey="...">` | Audit, SAL (per norma), RDP (singola) | "? Suggerisci conclusione" |
| `<MetricsByStandardChip standards integrated>` | Sidebar, sezione 11, export | (read-only, alimenta AI) |
| `<StandardSelector mode allowIntegrated>` | Creazione audit/SAL/RDP | "?? Suggerisci norme da contratto" |
| `<EvidenceGallery photos required>` | RDP, audit allegati, SAL evidenze | "?? Cerca evidenze simili" / classificazione foto |
| `<DocumentRegistryGrid filter stateOverlay>` | SAL, tab Documenti generale | "?? Estrai dati da PDF" (Sprint 9 attivo) |
| `<ExportPerStandardPanel audit>` | Ogni `document_type` | (read-only) |
| `<NormExcerptInline clauseRef>` | Domande checklist, sezioni report | RAG: ricerca semantica clausole simili |

**Interfaccia AI generica**: ogni componente standard espone una prop opzionale `aiAssist={({ context }) => Promise<Suggestion>}`. Se la licenza AI � attiva, il componente mostra il pulsante. Implementazione AI singola che vale per N moduli.

### 10. Audit come pilota di `document_registry`

**Decisione strategica confermata** dal product owner:

> Il modulo audit � pilastro e pilota dell'architettura del `document_registry` che deve essere sviluppato proprio per chiudere il modulo audit.

**Tradotto operativamente**:

- Un audit chiuso (`status='completed'`) **�** un documento del registro:
  - `doc_type='audit_report'`
  - `status='vigente'`
  - `expiry_date = audit_date + 1 anno` (o setting per-tenant per la cadenza)
  - allegati audit linkati come evidenze documentali
- Un SAL **�** un documento di gestione del registro:
  - `doc_type='sal'`
  - `status='in_revisione'` finch� aggiornato, `status='vigente'` solo a fine ciclo
- Un RDP **�** un rapporto specialistico nel registro:
  - `doc_type='inspection_report'`
  - `status='vigente'`, scadenza in funzione della commessa
- Riesame contratto �8.2 (Sprint 11) **�** un documento di processo nel registro

**Implementazione predisposta**: il modello `audit.metadata.documentRegistryId` viene riservato come campo opzionale (`null` accettato all'inizio). Verr� popolato quando il collegamento sar� implementato (Fase 5 di questo ADR + completamento Sprint A `document_registry` integration). Nessun refactoring distruttivo richiesto.

### 11. AI integration come licenza separata, comportamento UI "B"

**Decisione confermata** dal product owner: voto "B" � feature AI **completamente nascoste** se la licenza non � attiva (l'utente che paga solo audit base non vede mai un pulsante AI). Riconsiderazione futura se il canale commerciale di upselling viene strutturato.

**Licenze AI previste**:
- `ai_import` (gi� esistente � Sprint 9: estrazione PDF strutturata)
- `ai_assist` (futura � suggerimenti contestuali in compilazione)
- `ai_rag` (futura � ricerca semantica cross-tipo-documento)

**Pattern componenti**: `<NormConclusionsBlock>` e gli altri leggono `licensed_modules` da `AuthContext`. Se `ai_assist` non � in lista, il pulsante "? Suggerisci" semplicemente non si renderizza. Zero divergenze UI tra utenti paganti e non.

---

## Vision allineata: dalla compilazione audit alla pipeline AI

Schema mentale del flusso end-to-end (per orientare le decisioni implementative):

```
        ????????????????????????????????????????????????????????
        ?  Auditor compila audit (UI con componenti modulari)  ?
        ????????????????????????????????????????????????????????
                                 ? schema-first
                                 ?
          ???????????????????????????????????????????????
          ?  audit.checklist + audit.byStandard[key]    ?
          ?  audit.metadata.documentType = 'audit'      ?
          ?  audit.metadata.documentRegistryId (futuro) ?
          ???????????????????????????????????????????????
                           ?
            ??????????????????????????????????????????
            ?              ?                         ?
   ??????????????? ????????????????         ??????????????????
   ? AI assist   ? ? RAG indexing ?         ? Alert engine   ?
   ? in-context  ? ? vettoriale   ?         ? scadenze       ?
   ? - conclusioni? ? ricerca      ?         ? - audit annuali?
   ? - azioni    ? ? semantica    ?         ? - certificati  ?
   ? - cross-ref ? ? cross-tipo   ?         ? - obblighi norma?
   ??????????????? ????????????????         ??????????????????
          ?               ?
          ?               ??? document_registry indicizzato
          ?
          ??? Suggestions inline ? utente accetta/rifiuta ? tracciabilit� ISO 9001 �7.5
```

Tutto si tiene se i mattoni alla base (modello dati strutturato, componenti modulari, `document_type`) sono solidi.

---

## Conseguenze

### Positive

- **Aggiungere un nuovo standard ISO** = 1 INSERT DB + 1 riga `STANDARDS_REGISTRY` + (opz.) 1 template Word. Zero modifiche ai componenti.
- **Aggiungere un nuovo `document_type`** (es. riesame contratto Sprint 11, futuri specialistici) = 1 shell UI dedicata che compone componenti modulari esistenti.
- **AI funziona schema-first** sul modello strutturato `byStandard[key]`, non parsing libero.
- **Custom checklist diventa pari grado** di una norma ISO senza codice duplicato.
- **RDP, SAL, riesame contratto** modellati con la stessa griglia ? un solo insieme di test, un solo set di componenti UI.
- **Audit � pilota di document_registry** � l'architettura impone disciplina cross-modulare sin dall'inizio.

### Negative / Rischi

| Rischio | Probabilit� | Impatto | Mitigazione |
|---|---|---|---|
| Refactoring tocca codice "caldo" (5 fix critici nelle ultime 24h) | Alta | Alto | Implementazione **incrementale** in 5 fasi, ognuna committabile e collaudabile separatamente. Solo dopo conferma stabilit� del fix Exception 4 in produzione. |
| Migrazione audit esistenti richiede backfill `byStandard` | Media | Medio | `byStandard` opzionale con fallback al legacy `audit_extra_data.auditOutcome.conclusions` per audit pre-ADR. Nessun audit esistente si rompe. |
| Sovra-ingegnerizzazione (componenti troppo astratti) | Media | Medio | Test di scalabilit� concreto come criterio di accettazione (aggiungere ISO 27001 = 1+1+1 modifiche). Se non passa, si � andati troppo astratti. |
| Confusione utente con flag `isIntegratedSystem` | Bassa | Medio | Flag visualizzato chiaramente al momento della selezione standard, con tooltip che spiega "SGI integrato vs sistemi separati". UI per audit monorma nasconde completamente il flag. |
| Performance con molti standard selezionati | Bassa | Basso | I conteggi `byStandard` sono calcolati lazy in `useMemo`. Rendering parametrico � React-friendly. |

---

## Strategia di migrazione legacy (zero breaking changes)

Tutti gli audit esistenti continuano a funzionare senza modifiche grazie a:

1. **`byStandard[key]` opzionale**: se assente, i componenti leggono il legacy `auditOutcome.conclusions` come fallback unico (mappato implicitamente a `byStandard[firstStandard].conclusions`).
2. **`isIntegratedSystem` opzionale**: se assente, default `true` per audit monorma, `false` per multinorma ? comportamento UI identico al pre-ADR per gli audit esistenti.
3. **`documentType` opzionale**: se assente, default `'audit'` (oggi � l'unico tipo presente).
4. **`STANDARDS_REGISTRY` retrocompatibile**: i normalize map esistenti (`ISO_9001_2015 ? ISO_9001`, ecc.) vengono mantenuti.
5. **Custom checklist `CUSTOM_<id>`**: caricate runtime, gli audit esistenti con `customChecklistId` vengono trattati identicamente al pre-ADR.

**Conseguenza**: si pu� rilasciare l'ADR fase per fase, ogni commit � retrocompatibile con tutti gli audit in produzione.

---

## Piano di implementazione (5 fasi)

Implementazione **incrementale**. Ogni fase committabile e collaudabile separatamente. Avvio condizionato a stabilit� conclamata del fix Exception 4 in produzione (24-48h senza segnalazioni Camellini).

### Fase 1 � Registro standard centralizzato + metriche per-norma

**Obiettivo**: SoT registro standard + chip "NC per norma" in sidebar audit.

**File coinvolti** (frontend only, niente DB):
- Nuovo: `app/src/data/standardsRegistry.js` (registro centralizzato)
- Modificato: `app/src/components/AuditAccordionLayout.jsx` (consuma `STANDARDS_REGISTRY`)
- Modificato: `app/src/utils/metricsCalculator.js` (aggiunge `metrics.byStandard[key]`)
- Nuovo: `app/src/components/MetricsByStandardChip.jsx` (chip riusabile)
- Test L1: scenari registro + metriche per ogni standard.

**DoD**:
- Sidebar audit ISO 9001+14001 mostra "9001: 2 NC � 14001: 1 NC � totale 3"
- `STANDARDS_CONFIG` locale rimosso (sostituito da import da registro)
- Aggiungere ISO 45001 al registro non richiede modifiche a `AuditAccordionLayout`
- 100% test L1 verdi, build pulita
- Zero modifiche al backend, zero migrazioni DB

**Rischio**: basso. Refactoring puro. Smoke L3 standard.

### Fase 2 � Sezione 11 e Close Panel per-norma + flag SGI integrato

**Obiettivo**: tab UI per norma in sezione conclusioni; flag "Sistemi integrati" alla selezione standard; chiusura per norma.

**File coinvolti**:
- Modificato: `app/src/components/sections/AuditOutcomeSection.jsx` (tab per norma + sintesi opzionale)
- Modificato: `app/src/components/sections/GeneralDataSection.jsx` (checkbox `isIntegratedSystem` se applicabile)
- Modificato: `app/src/components/AuditClosePanel.jsx` (checkpoint per norma)
- Modificato: `app/src/contexts/StorageContext.jsx` (lettura/scrittura `byStandard[key]`)
- Modificato: `app/src/utils/auditConverter.js` (mappa legacy `auditOutcome` ? `byStandard[firstStd]`)

**DoD**:
- Audit con 1 sola norma: UI invariata (flag nascosto, 1 sola casella conclusioni)
- Audit con 2+ norme HLS: flag visibile, comportamento integrated/non-integrated rispettato
- Audit con norma non-HLS (es. ISO 3834): flag non disponibile (forced false)
- Audit esistenti pre-ADR: continuano a mostrare conclusioni come oggi (legacy fallback)
- 100% test L1 verdi (inclusi nuovi test su `byStandard` e flag)
- Smoke L3 manuale: Camellini conferma esperienza coerente con la sua prassi

**Rischio**: medio. Tocca componenti centrali. Richiede test multi-utente.

### Fase 3 � Export Word per-norma con opzioni indipendenti

**Obiettivo**: export Word genera n file (uno per norma) o 1 file integrato; opzioni `embedPhotos` indipendenti per norma.

**File coinvolti**:
- Modificato: `app/src/components/ExportPanel.jsx` (dropdown norma + ZIP "tutte")
- Modificato: `app/src/utils/wordExport.js` (funzione `exportAuditToWord(audit, normKey, opts)`)
- Modificato: `app/src/utils/wordExportHelpers.js` (marker per-norma)
- Predisposizione: nuovi template Word ISO 14001 / 45001 (caricati separatamente quando disponibili)

**DoD**:
- Audit ISO 9001+14001 non-integrato: dropdown "ISO 9001 / ISO 14001 / Tutte (ZIP) / Integrato"
- Opzione "Incorpora foto" per ciascuna norma indipendente
- Riusa `RILIEVI_MARKER` con dati `byStandard[key]`
- Test L1 estesi (`wordExport.placeholders.test.js` con scenario multi-standard)
- Sblocca implementazione Word ISO 14001 (oggi backlog ??)

**Rischio**: basso. Localizzato all'export, non tocca compilazione audit.

### Fase 4 � Custom checklist come "norma virtuale" parallela

**Obiettivo**: una checklist custom appare come tab pari grado a ISO nelle sezioni esiti / chiusura / export.

**File coinvolti**:
- Modificato: `app/src/data/standardsRegistry.js` (loader `CUSTOM_<id>` runtime)
- Modificato: `app/src/components/CustomChecklistAuditView.jsx` (consumo modello `byStandard`)
- Modificato: `app/src/components/sections/AuditOutcomeSection.jsx` (tab custom pari grado)
- Predisposizione: template Word per audit ibridi (ISO + custom)

**DoD**:
- Audit ibrido ISO 9001 + Custom: 2 tab in sezione 11, conteggi separati ISO/Custom
- Audit solo Custom: comportamento invariato rispetto al pre-ADR
- Export per-norma include custom come "norma" esportabile
- Test L1 verdi, smoke L3 su audit ibrido

**Rischio**: medio. Custom era trattato come "appendice"; portarla a pari grado tocca diverse sezioni.

### Fase 5 � Audit ? document_registry tie-in

**Obiettivo**: audit chiuso registrato automaticamente in `document_registry` con scadenza prossima sorveglianza.

**File coinvolti**:
- Backend: `audit.controller.completeAudit` ? INSERT in `document_registry`
- Backend: `audit.controller.updateAudit` ? UPDATE `document_registry.status` se cambia
- Frontend: `audit.metadata.documentRegistryId` esposto in UI (link "Vai al documento nel registro")
- Migrazione DB: aggiunta colonna `audits.document_registry_id INT NULL FK` (idempotente, retrocompatibile)

**DoD**:
- Audit ISO 9001 chiuso il 2026-06-01 ? riga in `document_registry` con `expiry_date = 2027-06-01`, `status='vigente'`
- Audit completato pre-ADR-009 ? backfill manuale opzionale (script migrazione)
- Allegati audit visibili anche dal `document_registry` (link bidirezionale)
- Smoke L3 fine ciclo: chiudi audit, verifica comparsa nel registro, verifica scadenza

**Rischio**: medio. Tocca backend (poco) + integrazione cross-modulo. Da fare quando il `document_registry` � confermato come modulo cardine.

---

## Test di scalabilit� (criterio di accettazione)

Il design � considerato corretto se vale la regola:

> **Aggiungere un nuovo standard ISO** (es. ISO 27001:2022 � Sicurezza informazioni) richiede SOLO:
>
> 1. `INSERT INTO standards (standard_code, standard_name, version, is_active) VALUES ('ISO_27001_2022', 'ISO/IEC 27001:2022', '2022', 1)`
> 2. Seed domande in `checklist_questions`
> 3. Una riga in `STANDARDS_REGISTRY`:
>    ```js
>    ISO_27001: { standardId: <id>, code: 'ISO_27001_2022', label: '...',
>                 kind: 'iso_hls', templateExport: 'iso27001-report.docx' }
>    ```
> 4. Opzionale: template Word `iso27001-report.docx` in `app/public/templates/`
>
> E **niente altre modifiche** ai componenti UI / backend / sync / export.

Lo stesso criterio vale per:
- Aggiungere un nuovo `document_type` (es. `'inspection_report_VT'`) ? 1 shell UI nuova + componenti esistenti
- Aggiungere una custom checklist nuova ? automatico, zero codice (CUSTOM_<id> runtime)

**Failure criteria**: se aggiungere un nuovo standard richiede di modificare `wordExport.js`, `AuditOutcomeSection.jsx`, `metricsCalculator.js`, `AuditClosePanel.jsx`, allora il design ha fallito ? revisione obbligatoria.

---

## AI-readiness checklist (criteri per Sprint AI futuri)

Ogni nuovo modulo introdotto dopo l'ADR-009 deve rispettare questa checklist per essere "AI-ready":

- [ ] **Schema-first**: i dati di output sono strutturati per chiave (per norma, per clausola, per requisito), non blob di testo libero
- [ ] **Componenti modulari**: la UI � composta da componenti riusabili che esporranno hook `aiAssist` opzionale
- [ ] **`document_type` esplicito**: ogni modulo dichiara il proprio tipo nella tassonomia
- [ ] **`documentRegistryId` predisposto**: campo opzionale che permetter� l'integrazione con il registro
- [ ] **Licenza modulare**: feature flag `ai_*` per gating UI (comportamento "B" � nascosto se off)
- [ ] **Indicizzabilit�**: il modello esponi i campi indicizzabili per RAG (titoli, conclusioni, requisiti, evidenze) in posizione deterministica

Validazione checklist nei PR review: ogni nuovo modulo viene marcato AI-ready dal Lead architect prima del merge in main.

---

## Riferimenti

- [PROJECT_ROADMAP.md](../PROJECT_ROADMAP.md) � sezione "Visione Strategica" + "VISION VINCOLANTE 08/04/2026" + Sprint A?F
- [GUIDA_CONSOLIDATA.md](../GUIDA_CONSOLIDATA.md) � sessione 08/05/2026 (fix Exception 4 multi-standard)
- [ADR-008](ADR-008-event-sourcing-sync.md) � modello sync event-based (compatibile con ADR-009)
- [MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md](../MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md) � primo test di estendibilit� (Sprint 11 user di questo ADR)
- [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) � `audits`, `audit_standards`, `custom_checklists`, `document_registry`
- Standard caricati in produzione (verificati 08/05/2026): ISO 9001:2015 (id=1, 41 domande), ISO 14001:2015 (id=2, 53 domande), ISO 45001:2018 (id=3, 53 domande), ISO 3834-2:2021 (id=6, 22 domande), RDP Mason (id=7, 0 domande)
