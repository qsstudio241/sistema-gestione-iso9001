# Task deputy — Checklist personalizzata con pulsanti di esito (Opzione B)

> Creato: 21 aprile 2026  
> Priorità: alta (richiesta cliente Camellini)  
> Ambito: custom checklist — flag `has_outcome_buttons`, UI pulsanti C/OSS/NC/NV/NA/OM, Word export condizionale con riepilogo.

---

## 1) Contesto e richiesta cliente

Le checklist personalizzate oggi mostrano solo campi evidenza (testo + allegato) senza pulsanti di valutazione. Camellini chiede che sia possibile **scegliere** — al momento della creazione della checklist — se ogni domanda deve avere i pulsanti di esito **C / OSS / NC / NV / NA / OM** (come nelle checklist ISO standard) oppure no.

**Opzione scelta: B** — un unico template Word per tutte le custom checklist; il codice di export genera condizionalmente la sezione riepilogo NC/OSS/OM solo se il flag è attivo.

---

## 2) Analisi schema esistente

La tabella `custom_checklists` (migration 025) ha già:
- `id`, `organization_id`, `name`, `description`, `is_active`
- `default_report_template_id`, `custom_report_template_id`
- **NON** ha `has_outcome_buttons`

La tabella `audit_custom_checklist_responses` ha:
- `id`, `audit_id`, `custom_item_id`, `evidence_blocks NVARCHAR(MAX)`, `updated_at`
- **NON** ha un campo `status` separato

`custom_checklist_items.response_type` esiste già (`DEFAULT 'verbale'`), utile per futura granularità per-item.

---

## 3) Architettura della soluzione (Opzione B)

### 3.1 Strato DB — migration 043

```sql
-- Aggiunge flag alla checklist (globale per tutta la checklist)
ALTER TABLE dbo.custom_checklists
  ADD has_outcome_buttons BIT NOT NULL DEFAULT 0;

-- Aggiunge status alla risposta (NULL = no valutazione; 'C'|'OSS'|'NC'|'NV'|'NA'|'OM' altrimenti)
ALTER TABLE dbo.audit_custom_checklist_responses
  ADD status NVARCHAR(10) NULL;
```

**Rationale**: separare `status` da `evidence_blocks` (JSON) semplifica query, indici e report.

### 3.2 Backend

**File**: `backend/src/controllers/customChecklists.controller.js`  
- Includere `has_outcome_buttons` nelle SELECT e negli UPDATE della checklist.

**File**: `backend/src/routes/customChecklists.routes.js` o controller risposte  
- Endpoint GET/PUT `audit_custom_checklist_responses`: includere/accettare campo `status`.

### 3.3 Frontend — UI

**File**: `app/src/components/CustomChecklistAuditView.jsx`  
Logica condizionale per item:
```jsx
{checklist?.has_outcome_buttons && (
  <div className="outcome-buttons">
    {['C', 'OSS', 'NC', 'OM', 'NV', 'NA'].map(code => (
      <button
        key={code}
        className={`outcome-btn outcome-btn--${code.toLowerCase()} ${responses[itemId]?.status === code ? 'active' : ''}`}
        onClick={() => handleStatusChange(itemId, code)}
      >
        {code}
      </button>
    ))}
  </div>
)}
```

**File**: `app/src/components/CustomChecklistsPage.jsx` (creazione/modifica checklist)  
- Aggiungere toggle "Abilita valutazione (C/OSS/NC...)" nella form di creazione/modifica.

**File**: `app/src/components/CustomChecklistAuditView.css`  
- Stile per `.outcome-buttons`, `.outcome-btn`, classi per colore per codice (verde C, giallo OSS, rosso NC...).

### 3.4 Frontend — Word export (Opzione B: template unico condizionale)

**File**: `app/src/utils/wordExport.js`  
- In `buildTemplateData`: aggiungere i conteggi (`cCount`, `ncCount`, ecc.) anche per custom checklist con `has_outcome_buttons = true`, calcolati dai `status` delle risposte.
- Il `summaryText` e il blocco `RILIEVI_MARKER` vengono generati solo se `has_outcome_buttons = true`.

**File**: `app/src/utils/wordExportHelpers.js`  
- In `buildCustomChecklistSectionOoxml`: per ogni item, se `has_outcome_buttons = true` mostrare il badge status (es. `[NC]`) prima del titolo domanda, come nelle checklist standard.
- In `buildCustomRileviSummaryOoxml`: se `has_outcome_buttons = false`, restituire stringa vuota (nessun riepilogo nel report).

**Nessuna modifica al template Word** `VerbaleVisita-generic.docx` — la sezione riepilogo viene iniettata in `RILIEVI_MARKER` solo se serve.

---

## 4) Vincoli non negoziabili

1. **Backward compatible**: checklist esistenti (Camellini, Mason) hanno `has_outcome_buttons = 0` → zero modifiche al comportamento attuale.
2. **Diff minimo**: i 5 file indicati + migration.
3. **No segreti** in commit.
4. **La migrazione 043** va creata ma NON eseguita in produzione dal deputy.
5. Test L1 + build devono passare prima del commit.

---

## 5) Perimetro tecnico

| File | Modifica |
|---|---|
| `database/migrations/043_custom_checklist_outcome_buttons.sql` | ALTER TABLE `custom_checklists` + `audit_custom_checklist_responses` |
| `backend/src/controllers/customChecklists.controller.js` | Includere `has_outcome_buttons` in SELECT/UPDATE |
| Controller risposte custom (stesso file o route dedicata) | Includere `status` in GET/PUT risposte |
| `app/src/components/CustomChecklistAuditView.jsx` | Pulsanti esito condizionali + salvataggio `status` |
| `app/src/components/CustomChecklistAuditView.css` | Stile pulsanti outcome |
| `app/src/components/CustomChecklistsPage.jsx` | Toggle `has_outcome_buttons` in form creazione |
| `app/src/utils/wordExport.js` | Conteggi condizionali da `status` custom responses |
| `app/src/utils/wordExportHelpers.js` | Badge status in item, riepilogo vuoto se `false` |

---

## 6) Criteri di accettazione

- [ ] Una nuova checklist personalizzata può essere creata con `has_outcome_buttons = true`.
- [ ] Le checklist esistenti non mostrano pulsanti (flag default `0`).
- [ ] Con flag attivo: ogni domanda mostra i 6 pulsanti C/OSS/NC/OM/NV/NA; il pulsante attivo è evidenziato.
- [ ] Il `status` scelto viene salvato e ripristinato alla riapertura dell'audit.
- [ ] Il report Word con flag attivo mostra il badge status accanto a ogni domanda e la sezione riepilogo NC/OSS/OM.
- [ ] Il report Word con flag non attivo è identico a quello attuale (solo testo/evidenze, nessun riepilogo).
- [ ] Nessuna regressione su audit e checklist esistenti.

---

## 7) Smoke test obbligatorio

### L1 automatico
```bash
cd app
npm run test:run
npm run build
```

### L3 manuale
1. Creare una nuova checklist con `has_outcome_buttons = true`.
2. Aprire un audit con quella checklist → verificare la presenza dei pulsanti.
3. Selezionare "NC" su una domanda → chiudere l'audit → riaprire → verificare che "NC" sia ancora selezionato.
4. Generare Word → verificare badge `[NC]` e sezione riepilogo.
5. Aprire una checklist esistente (Mason o Camellini) → verificare assenza pulsanti.

---

## 8) Regola di chiusura

Ciclo **`review → fix → smoke`** fino a esito positivo.  
Output finale obbligatorio: `TEST OK` oppure `FIX NON APPLICABILI: <elenco>`.

---

## 9) Prompt pronto per Agents Window

```text
Leggi docs/agent-tasks/TASK_CUSTOM_CHECKLIST_OUTCOME_BUTTONS.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```
