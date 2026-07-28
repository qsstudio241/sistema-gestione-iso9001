# DEPUTYTASK1 — Registro obblighi legali: schema BE (sezioni con riferimento legislativo)

**Stato:** APERTO
**Priorità:** P0 — fondazione bloccante per DEPUTYTASK2/3
**Branch base:** `main`
**Creato da:** Lead 28/07/2026
**Spec:** [ADR-019](../adr/ADR-019-registro-obblighi-legali-ambiente-sicurezza.md) — leggere §2 (D2), §5, §6 prima di iniziare

> **Allineamento Git (autonomo)**: prima di leggere questo brief eseguire `git fetch origin main` e `git pull origin main`. **Non** chiedere al committente di farlo. Verificare che questo file su `origin/main` abbia `Stato: APERTO`.

---

## Contesto (leggere prima)

Stiamo estendendo il modulo "checklist custom" (`custom_checklists` → `custom_checklist_sections` → `custom_checklist_items`, migrazione 025) per supportare un **registro obblighi legali** capitolo-per-capitolo: **1 capitolo = 1 sezione**, con un blocco narrativo di riferimenti legislativi sulla sezione, e le sotto-domande a/b/c come item già esistenti.

**Non** stiamo creando nuove tabelle. **Non** stiamo toccando `checklist_questions`/`audit_responses` (motore standard ISO — fuori perimetro).

## Cosa NON toccare

- `checklist_questions`, `audit_responses`, `app/src/pages/ChecklistModule.jsx` (checklist standard ISO).
- `custom_checklist_items` — nessuna nuova colonna qui, solo `custom_checklist_sections`.
- `salAiSuggest.service.js` — riservato a DEPUTYTASK4 (che estrarrà `parseLinkedLegislation` in un util condiviso; se questo slice ha già finito e passato i suoi test, DEPUTYTASK4 può importare l'util senza toccare altro).
- `DEPUTYTASK.md` (company_profile ADR-018, stream indipendente).

---

## Slice 1 — Migration DB

**File previsti:**

- `database/migrations/138_custom_checklist_sections_legal_reference.sql` (idempotente — verificare prima `ls database/migrations/ | sort -t_ -k1 -n | tail -5`: se qualcuno ha già usato 138, prendere il numero libero successivo)
- `backend/scripts/run-migration-138-vps.js` (pattern standard: `require('/var/www/sgq-backend/src/config/database')`)

> **Nota storica (29/07/2026)**: assegnata inizialmente come migrazione 135, poi rinumerata **138** in fase di merge con `main` — collisione con `135_nc_effectiveness_verification.sql` mergiato su `main` nel frattempo. Vedi [ADR-019 §7ter](../adr/ADR-019-registro-obblighi-legali-ambiente-sicurezza.md#7ter-merge-con-main-29072026--conflitti-e-classificazione).

**Cosa fare:**

```sql
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'custom_checklist_sections' AND COLUMN_NAME = 'reference_text'
)
BEGIN
  ALTER TABLE dbo.custom_checklist_sections ADD reference_text NVARCHAR(MAX) NULL;
END

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'custom_checklist_sections' AND COLUMN_NAME = 'linked_legislation'
)
BEGIN
  ALTER TABLE dbo.custom_checklist_sections ADD linked_legislation NVARCHAR(MAX) NULL;
END
```

- `reference_text`: testo narrativo leggibile (elenco leggi/decreti del capitolo, come nei documenti di riferimento).
- `linked_legislation`: stringa parsabile, **stesso formato già usato da SAL** in `norm_requirements.linked_legislation` (es. `"D.Lgs. 81/2008 art.28; art.29"`) — non validare formato lato DB, solo NVARCHAR libero.

**DoD:** migration applicabile due volte senza errore (idempotente); nessun impatto su righe esistenti (entrambe le colonne `NULL` di default → tutte le sezioni esistenti restano visivamente identiche).

---

## Slice 2 — Estendere `customChecklist.service.js` (lettura/scrittura)

**File:** `backend/src/services/customChecklist.service.js` (esistente, NON creare un nuovo service)

**Cosa fare (4 funzioni da toccare, tutte già esistenti):**

1. `listSections(customChecklistId, reqUser)` — aggiungere `reference_text, linked_legislation` alla `SELECT` (riga ~154). Questo basta a farli comparire anche in `getChecklistWithStructure` (fa già `{ ...s, items: [] }` — nessun'altra modifica necessaria lì).
2. `createSection(customChecklistId, reqUser, data)` — accettare `data.reference_text` e `data.linked_legislation` (opzionali, default `null`), aggiungerli a `INSERT`/`OUTPUT`.
3. `updateSection(sectionId, customChecklistId, reqUser, data)` — stesso pattern già usato per `code`/`title` (leggi valore esistente se `data.campo === undefined`), aggiungere ai due campi nuovi, `SET` e `SELECT` finale.
4. `findSeededLegislativoAmbientale` / `seedLegislativoAmbientaleChecklist` — **non modificare la logica**, ma verificare che passino a `createSection` un eventuale `section.referenceText`/`section.linkedLegislation` se presenti nel template (oggi `LEGISLATIVO_AMBIENTALE_TEMPLATE` non li ha ancora — passarli solo se `!== undefined`, così resta compatibile prima che DEPUTYTASK3 li aggiunga).

**DoD:** Jest su `customChecklist.service.test.js` (se non esiste, crearlo mirato: create/update sezione con `reference_text`, verifica che `listSections`/`getChecklistWithStructure` lo restituiscano; verifica che una sezione senza questi campi continui a funzionare come oggi — regressione).

**Test L1 mirato (non suite intera):**
```bash
cd backend && npx jest customChecklist --silent
```

---

## Slice 3 — Controller / route (esposizione minima)

**File:** `backend/src/controllers/customChecklist.controller.js` + route esistenti

**Cosa fare:** verificare che i controller `createSection`/`updateSection` passino semplicemente `req.body` al service (pattern già esistente per `code`/`title`/`display_order`) — probabilmente **zero modifiche necessarie** se il controller già fa `pick`/spread generico. Se il controller filtra esplicitamente i campi ammessi (whitelist), aggiungere `reference_text`, `linked_legislation` alla whitelist.

**DoD:** test manuale con `curl`/Postman (o Jest esistente sulle route) — POST sezione con `reference_text` restituisce il campo in risposta.

---

## Verifica di chiusura (gate)

```bash
cd backend && npx jest customChecklist --silent   # mirato
cd backend && npx jest --silent                    # gate pieno prima di dichiarare TEST OK
```

Nessuna modifica FE prevista in questo slice — **non** eseguire `npm run build` su `app/` (non toccato).

Chiudere con **TEST OK** (riportare conteggio Jest, es. "X/X pass, nessuna regressione su suite preesistente") o **FIX NON APPLICABILI** con motivo.

---

## Comando deputy

```
Leggi docs/agent-tasks/DEPUTYTASK1.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```
