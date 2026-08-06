# DEPUTYTASK4 — Estensione agente validità normativa al registro obblighi legali

**Stato:** CHIUSO — TEST OK (28/07/2026, deputy Stream 4)
**Priorità:** P1 — non bloccante per il rilascio del template sicurezza (DEPUTYTASK3), ma richiesto esplicitamente dal committente in questa iniziativa
**Branch base:** `main`
**Creato da:** Lead 28/07/2026
**Spec:** [ADR-019](../adr/ADR-019-registro-obblighi-legali-ambiente-sicurezza.md) — leggere §1 (correzione importante), §2 (D5), §6 (rischi) prima di iniziare

> **Allineamento Git (autonomo)**: prima di leggere questo brief eseguire `git fetch origin main` e `git pull origin main`. **Non** chiedere al committente di farlo.

---

## Contesto (leggere prima — importante)

**Un agente di verifica periodica della validità normativa esiste già in produzione**: `backend/src/services/normValidityChecker.service.js` + `backend/src/services/alertScheduler.js` (`runNormValidityJob`, cron `0 3 * * 1` = lunedì 03:00), con connettori già funzionanti per Normattiva (`normConnectors/normativaConnector.js`) ed EUR-Lex (`normConnectors/eurLexConnector.js`) tramite `normCatalogLookup.service.js`. Email "norme superate" già implementata (`buildNormValidityEmailHtml` in `alertScheduler.js`). **PR #65, 25/05/2026, in produzione.**

**Questo slice NON crea un secondo agente.** Estende quello esistente per coprire anche `custom_checklist_sections.linked_legislation` (colonna nuova da DEPUTYTASK1 — **dipendenza: attendere che sia mergiato**), non solo `document_registry` (doc_type='norma').

**Perimetro dichiarato (Tier 1, vedi ADR-019 §2 D5)**: verifichiamo se l'**atto** citato (es. "D.Lgs. 81/2008") è ancora vigente o è stato abrogato/sostituito — **non** se il testo del singolo articolo è cambiato (quello è Tier 2, backlog, fuori da questo slice — non tentare di implementarlo qui).

## Cosa NON toccare

- `app/` (nessuna modifica FE in questo slice — l'eventuale banner in-app è previsto ma minimale, vedi Slice C).
- `database/migrations/135_*` (creata da DEPUTYTASK1 — questo slice **usa** le colonne, non le crea).
- La logica di business di `salAiSuggest.service.js` — solo l'estrazione meccanica del parser (Slice A).

---

## Slice A — Estrarre `parseLinkedLegislation` in util condiviso

**File:**
- Nuovo: `backend/src/utils/linkedLegislationParser.js`
- Modificato: `backend/src/services/salAiSuggest.service.js` (rimuovere la funzione locale, importarla dall'util)

**Cosa fare:**

1. Spostare `parseLinkedLegislation`, `decreeLabelToStandardCode`, `normalizeDecreeLabel` (oggi in `salAiSuggest.service.js`, righe ~140-207) in `backend/src/utils/linkedLegislationParser.js`, `module.exports` invariato nei nomi.
2. In `salAiSuggest.service.js`: `const { parseLinkedLegislation } = require('../utils/linkedLegislationParser');` — **nessun'altra modifica** alla logica del service.
3. **Refactor meccanico**: non modificare il comportamento della funzione (stesso regex, stesso formato atteso `"D.Lgs. 81/2008 art.28; art.29"`).

**DoD — gate obbligatorio prima di proseguire alla Slice B:**
```bash
cd backend && npx jest salAiSuggest --silent
cd app && NODE_ENV=test npx vitest run src/tests/salAiSuggest.test.jsx
```
Se una sola di queste due suite fallisce, **fermarsi e non toccare altro** — la Fase 5-B di SAL (già in produzione) non deve regredire.

---

## Slice B — Estendere `normValidityChecker.service.js`

**File:** `backend/src/services/normValidityChecker.service.js`

**Cosa fare:**

1. Nuova funzione `runScheduledLegalRegisterCheck(organizationId)` (pattern gemello di `runScheduledValidityCheck`, non sostituirla):
   - Query: sezioni di `custom_checklist_sections` con `linked_legislation IS NOT NULL`, filtrate per `organization_id` tramite `custom_checklist_id` → `custom_checklists.organization_id`.
   - Per ciascuna sezione: `parseLinkedLegislation(sezione.linked_legislation)` (util Slice A) → per ogni decreto univoco citato, `normCatalogLookup.lookupNormStatus(standardCode_o_label, 'normattiva')` (riusare `resolveTarget`/`isPublicLawLookup`, già gestiscono `normattivaConnector.isItalianPublicLaw` — **verificare che la label `"D.Lgs. 81/2008"` sia riconosciuta dal connettore esistente**; se il formato richiesto differisse, adattare la label prima della chiamata, non il connettore).
   - Se `status` è `withdrawn`/`superseded`: aggiungere a un array `updated` (stessa forma usata da `runScheduledValidityCheck`: `{ sectionId, standardCode, reason, supersededBy, catalogUrl }`).
   - **Non modificare** `type_specific_data` di `document_registry` (quello resta per le norme "documento"; qui il target è la sezione checklist — decidere se serve una colonna leggera `legal_validity_status`/`legal_last_check` su `custom_checklist_sections`, **valutare con il Lead prima di aggiungere colonne non previste nell'ADR** — di default, per questo slice, limitarsi a loggare + email, senza persistere lo stato se non strettamente necessario).
2. In `alertScheduler.js`: aggiungere la chiamata a `runScheduledLegalRegisterCheck` **dentro** `runNormValidityJob` (stesso job settimanale, stesso orario — non un nuovo `schedule.scheduleJob`), con una sezione email aggiuntiva (o digest separato se il volume è alto — decidere in base al test reale).

**DoD:**
```bash
cd backend && npx jest normValidityChecker --silent
```
Mock delle chiamate di rete (`normCatalogLookup.lookupNormStatus`) nei test — **non** fare chiamate HTTP reali a Normattiva/EUR-Lex nei test automatici (pattern già seguito da `normValidityChecker.service.test.js` se esiste, altrimenti crearlo).

**Verifica manuale (senza aspettare lunedì)** — pattern Fase 4c di `sgq-bug-fix-methodology.mdc`: script diagnostico che chiama direttamente `runScheduledLegalRegisterCheck(organizationId)` per un'org di test con almeno una sezione con `linked_legislation` popolato, e verifica il log/risultato.

---

## Slice C (opzionale, solo se Slice A+B chiuse con margine) — Banner in-app

**File:** `app/src/components/CustomChecklistAuditView.jsx` (stesso file toccato da DEPUTYTASK2 — **verificare che DEPUTYTASK2 sia mergiato prima di iniziare questo slice, per evitare conflitti**)

**Cosa fare:** se l'API di lettura sezione restituisce un flag "possibile obsolescenza" (da definire in Slice B), mostrare un piccolo banner non invasivo sopra la sezione interessata (pattern `AiDisclaimer.jsx` — footer non invasivo, non un blocco modale). **Facoltativo**: se manca tempo, lasciare backlog e chiudere Slice A+B come deliverable di questo DEPUTYTASK.

---

## Verifica di chiusura (gate)

```bash
cd backend && npx jest --silent   # gate pieno backend
```

### Checklist di chiusura iniziativa (obbligatoria — richiesta esplicita del committente 28/07/2026)

Prima di dichiarare **TEST OK** finale, verificare esplicitamente lo stato di **ADR-019 §7bis "Registro note aperte"** (N1-N5) e riportarlo nel messaggio di chiusura:

- N1 (capitolo mancante nello scaffold) — già risolto dal Lead prima del lancio di questo stream; verificare solo che `leg_sic_29` sia ancora presente e coerente in `checklistTemplates.js`.
- N2 (citazioni mal attribuite capitolo 16) — già risolto dal Lead; nessuna azione richiesta in questo stream salvo notare eventuali NUOVE mal-attribuzioni scoperte durante l'estensione dell'agente di validità (se il parser incontra decreti/articoli anomali durante il test manuale di Slice B, segnalarlo come N6 in ADR-019, non ignorarlo).
- N3 (granularità sicurezza assente) — limite documentale accettato, nessuna azione in questo stream.
- N4 (opzione NV) — già risolto dal Lead; nessuna azione richiesta.
- N5 (revisione umana finale) — resta aperto per natura (vincolo permanente D6); questo stream **non lo chiude** — segnalarlo esplicitamente nel messaggio finale come "in attesa di revisione umana del committente", non come task del deputy.

Chiudere con **TEST OK** (specificare se Slice C è stata fatta o lasciata backlog, e lo stato N1-N5 sopra) o **FIX NON APPLICABILI**.

---

## Comando deputy

```
Leggi docs/agent-tasks/DEPUTYTASK4.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```
