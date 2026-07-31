# DEPUTYTASK2 — Registro obblighi legali: rendering FE (riferimento legislativo + risposta SI/NO/NA)

**Stato:** CHIUSO — TEST OK (integrato in PR #317; statusOptions + reference_text UI)
**Priorità:** P0 — necessario perché DEPUTYTASK3 sia utilizzabile in audit reale
**Branch base:** `main`
**Creato da:** Lead 28/07/2026
**Spec:** [ADR-019](../adr/ADR-019-registro-obblighi-legali-ambiente-sicurezza.md) — leggere §2 (D2), §3 (D3) prima di iniziare

> **Allineamento Git (autonomo)**: prima di leggere questo brief eseguire `git fetch origin main` e `git pull origin main`. **Non** chiedere al committente di farlo.

---

## Contesto (leggere prima)

**Può partire in parallelo a DEPUTYTASK1** (il contratto è congelato in questo brief e nell'ADR: due nuove proprietà opzionali `reference_text`/`linked_legislation` su ogni sezione restituita da `GET` checklist). Se DEPUTYTASK1 non è ancora mergiato, sviluppare e testare con un fixture/mock locale che simula la risposta API con questi due campi popolati su una sezione.

**Non stiamo creando un nuovo componente.** Riuso obbligatorio: `QuestionCard.jsx` (blocco unico, regola *Riuso UI*), `notes-textarea`, classi `status-btn`.

## Cosa NON toccare

- `ChecklistModule.jsx` (checklist standard ISO — `QuestionCard` è condiviso, ma questo slice aggiunge solo una prop **opzionale con default retrocompatibile**, non deve cambiare nulla per chi non la passa).
- `backend/` (nessuna modifica BE in questo slice — se serve un campo diverso da quello previsto, aggiornare prima l'ADR/DEPUTYTASK1, non improvvisare un contratto diverso lato FE).

---

## Slice A — `QuestionCard.jsx`: prop opzionale `statusOptions`

**File:** `app/src/components/QuestionCard.jsx`

**Cosa fare:**

1. Estrarre l'array `STATUS_BUTTONS` (righe ~25-32) come **default** di una nuova prop `statusOptions` (default = `STATUS_BUTTONS` stesso, quindi **zero cambio di comportamento** per tutti i chiamanti esistenti che non passano la prop).
2. Nel render (riga ~81), sostituire `STATUS_BUTTONS.map(...)` con `statusOptions.map(...)`.
3. Aggiornare il commento JSDoc in testa al file con la nuova prop.

**Esempio sottoinsieme per registro legale** (da passare da `CustomChecklistAuditView.jsx`, Slice B):
```js
const LEGAL_STATUS_OPTIONS = [
  { code: "C",  className: "compliant",     label: "Sì" },
  { code: "NC", className: "non-compliant", label: "No" },
  { code: "NA", className: "not-applicable", label: "Non applicabile" },
];
```
Nota: si riusano i **codici** `C`/`NC`/`NA` già esistenti (compatibili con lo storage `audit_custom_checklist_responses` / stati salvati) — cambia solo la **label visibile** (Sì/No invece di Conforme/Non Conforme), coerente con i due documenti di riferimento (SI/NO/NA).

**DoD:** Vitest — `QuestionCard` senza `statusOptions` renderizza gli stessi 6 pulsanti di oggi (test di non-regressione); con `statusOptions` custom renderizza solo quelli passati.

**Test L1 mirato:**
```bash
cd app && NODE_ENV=test npx vitest run src/tests/questionCard* 2>&1 | tail -30
```
(se non esiste un file di test dedicato a `QuestionCard`, crearne uno minimo: è un componente condiviso da audit standard + custom, merita un test diretto anche solo per questo slice).

---

## Slice B — `CustomChecklistAuditView.jsx`: mostrare `reference_text` di sezione + item con `response_type: legal_check`

**File:** `app/src/components/CustomChecklistAuditView.jsx`

**Cosa fare:**

1. Nel render delle sezioni (riga ~358-362, `<h4 className="custom-checklist-section-title">{sec.code} - {sec.title}</h4>`): se `sec.reference_text` è presente, renderizzare subito sotto un blocco leggibile (riuso pattern esistente — no nuovo componente decorativo, es. `<div className="custom-checklist-section-reference">{sec.reference_text}</div>` con CSS minimale coerente allo stile esistente di `CustomChecklistsPage.jsx`/`ChecklistModule.css`). **Collassabile** se il testo è lungo (pattern "sezioni numerate collassabili" già in uso altrove — regola *UI guida flusso*): `<details>`/`<summary>` nativi sono accettabili e a basso rischio (nessuna dipendenza nuova).
2. Nel `sec.items.map((item) => ...)` (riga ~364): quando `item.response_type === "legal_check"`, passare a `<QuestionCard>` la prop `statusOptions={LEGAL_STATUS_OPTIONS}` (definita in Slice A). Per tutti gli altri `response_type` (es. `"verbale"`), **non passare la prop** → comportamento identico a oggi.
3. **Non modificare** la logica di salvataggio (`handleStatusChange`, `saveResponses`, `updateBlock`) — è già generica su `item.id`, non serve alcuna modifica per il nuovo `response_type`.

**DoD:** Vitest su `CustomChecklistAuditView` (file esistente probabilmente `salModule.test.jsx`-style o dedicato — verificare `app/src/tests/` per un test già presente su questo componente prima di crearne uno nuovo) — copre: (a) sezione senza `reference_text` renderizza come oggi; (b) sezione con `reference_text` mostra il blocco; (c) item `legal_check` mostra 3 pulsanti invece di 6; (d) item `verbale` non cambia.

**Test L1 mirato:**
```bash
cd app && NODE_ENV=test npx vitest run src/tests/customChecklist* 2>&1 | tail -40
```

---

## Slice C — CSS minima

**File:** `app/src/components/ChecklistModule.css` (o CSS module già usato da `CustomChecklistAuditView` — verificare import in testa al file prima di crearne uno nuovo)

**Cosa fare:** classe `.custom-checklist-section-reference` — sfondo leggermente distinto (es. `background:#f8fafc`, `border-left:3px solid #94a3b8`, `padding:12px`, `font-size:13px`, `white-space:pre-wrap`) per distinguere visivamente il testo normativo (informativo, non interattivo) dalle domande sottostanti (interattive). Nessuna nuova palette colore da inventare — riusare variabili/valori già presenti nel file.

---

## Verifica di chiusura (gate)

```bash
cd app && NODE_ENV=test npm run test:run   # gate pieno, non solo mirato, prima di TEST OK
cd app && npm run build
```

Se possibile, smoke manuale rapido (computerUse) su una checklist custom esistente (es. `LEG_AMBIENTE_152` seedata) per controllare che **nulla sia cambiato visivamente** (nessuna sezione ha ancora `reference_text` finché DEPUTYTASK1/3 non sono mergiati) — è il test di non-regressione più diretto.

Chiudere con **TEST OK** o **FIX NON APPLICABILI** con motivo.

---

## Comando deputy

```
Leggi docs/agent-tasks/DEPUTYTASK2.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```
