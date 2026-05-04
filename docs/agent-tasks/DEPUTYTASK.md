# DEPUTYTASK — Chiusura Modulo Audit: Gate Read-Only + Policy API

> **Data**: 04/05/2026  
> **Autore**: Lead Agent  
> **Riferimento**: `docs/agent-tasks/AUDIT_MODULE_LEAD_BRIEF.md` (slice S-A1, S-A2, S-A3)  
> **Tipo**: Feature + Fix + Hardening  
> **Priorità**: P0 (compliance ISO §7.5 — immutabilità record)  
> **Branch**: `feat/audit-read-only-gate-92ab` da `main`  
> **Chiusura attesa**: TEST OK per ogni fase

---

## Contesto

L'investigazione del codice (04/05/2026) ha rivelato che un audit in stato `completed` o `approved` è ancora pienamente modificabile sia da UI che da API. Questo viola ISO 9001:2015 §7.5 (immutabilità delle registrazioni di qualità) e rende inaffidabili tutti i moduli a valle (NC, SAL, documentale, RAG).

---

## Decisioni di prodotto (policy — non modificare senza approvazione lead)

| Stato audit | Risposte checklist | Metadati audit (PUT /audits/:id) | Note |
|------------|-------------------|----------------------------------|------|
| `draft` / `in_progress` | ✅ Modificabili | ✅ Modificabili | Normale |
| `completed` | ❌ Bloccate | ⚠️ Consentiti solo campi `notes`, `audit_extra_data` | Checklist bloccata, l'auditor può correggere conclusioni prima dell'approvazione |
| `approved` | ❌ Bloccate | ❌ Bloccato tutto | Definitivamente immutabile |
| `archived` | ❌ Bloccate | ❌ Bloccato tutto | Identico ad `approved` |

**Codice errore standard per write su audit chiuso**: `403 AUDIT_READ_ONLY`  
**Messaggio**: `"Audit in stato '${status}' — sola lettura. Contatta il responsabile per modifiche."`

---

## FASE 1 — Backend: policy API (S-A2)

### 1A — `backend/src/controllers/response.controller.js`

In **entrambe** le funzioni `saveResponse` e `bulkSaveResponses`, subito dopo la verifica ownership audit, aggiungere il check di status:

```javascript
// In saveResponse — dopo il lookup auditIdNumeric (riga ~187):
const auditStatusCheck = await query(`
    SELECT status FROM audits
    WHERE audit_id = @audit_id AND organization_id = @organization_id
`, { audit_id: auditIdNumeric, organization_id });
const auditStatus = auditStatusCheck.recordset[0]?.status;
if (['completed', 'approved', 'archived'].includes(auditStatus)) {
    return res.status(403).json({
        error: `Audit in stato '${auditStatus}' — sola lettura. Contatta il responsabile per modifiche.`,
        code: 'AUDIT_READ_ONLY'
    });
}
```

Per `bulkSaveResponses` il check è identico — aggiungere subito dopo la determinazione di `auditIdNumeric` (prima del `for (const resp of responses)`).

**ATTENZIONE**: in `bulkSaveResponses` il lookup `audit_id` è già fatto (righe ~360-387); recuperare `status` in quella stessa query aggiungendo `status` alla SELECT, non con una seconda query separata:
```javascript
// Modifica la query di lookup UUID:
SELECT audit_id, status FROM audits
WHERE audit_uuid = @audit_uuid AND organization_id = @organization_id AND is_deleted = 0
// e la query di verifica numerico:
SELECT audit_id, status FROM audits
WHERE audit_id = @audit_id AND organization_id = @organization_id AND is_deleted = 0
```
Salvare lo status in `const auditCurrentStatus = ...recordset[0].status` e fare il check subito dopo.

### 1B — `backend/src/controllers/audit.controller.js` → `updateAudit`

Dopo il check `existingAudit.recordset.length === 0` (riga ~439), prima del conflict detection, aggiungere:

```javascript
// Recupera status corrente (già incluso nel SELECT — aggiungere status alla SELECT esistente):
// Modifica la query a riga ~432:
SELECT audit_id, status, updated_at, audit_extra_data FROM audits ...

// Poi:
const currentStatus = existingAudit.recordset[0].status;
if (['approved', 'archived'].includes(currentStatus)) {
    return res.status(403).json({
        error: `Audit in stato '${currentStatus}' — sola lettura.`,
        code: 'AUDIT_READ_ONLY'
    });
}
// NB: 'completed' → consentiti solo campi limitati. Per semplicità in questa slice
// bloccare TUTTO per completed/approved/archived — è la scelta più sicura.
// Il campo notes/conclusions può essere modificato solo prima di completare.
```

**Nota**: bloccare anche `completed` rende la policy uniforme e più semplice. Se il requisito futuro fosse "allow corrections on completed", si apre come eccezione separata.

### 1C — `app/src/services/syncService.js`

Aggiungere `'AUDIT_READ_ONLY'` alla lista dei codici 403 che causano stall permanente (riga ~291):

```javascript
// PRIMA:
(st === 403 && (
    code === 'STANDARDS_NOT_ALLOWED' ||
    code === 'MODULE_NOT_LICENSED' ||
    code === 'AUDIT_DEPRECATED' ||

// DOPO:
(st === 403 && (
    code === 'STANDARDS_NOT_ALLOWED' ||
    code === 'MODULE_NOT_LICENSED' ||
    code === 'AUDIT_DEPRECATED' ||
    code === 'AUDIT_READ_ONLY' ||
```

Questo impedisce che item in coda su audit ormai chiusi rientrino in retry infinito dopo il deploy.

---

## FASE 2 — Frontend: gate read-only UI (S-A1)

### 2A — `app/src/components/AuditAccordionLayout.jsx`

**Step 1**: Calcolare il predicato `isReadOnly` una sola volta, vicino all'inizio del componente (dopo i `useStorage`/`useAuth`):

```javascript
// Aggiungi subito dopo la riga const { user } = useAuth();
const LOCKED_STATUSES = ['completed', 'approved', 'archived'];
const isReadOnly = LOCKED_STATUSES.includes(currentAudit?.metadata?.status);
```

**Step 2**: Mostrare un banner informativo sotto l'header quando `isReadOnly`:

```jsx
{/* Banner read-only — mostrare subito sotto audit-header, prima dei banner server-data */}
{isReadOnly && (
  <div className="audit-readonly-banner">
    🔒 Audit in sola lettura — stato: <strong>{currentAudit.metadata.status?.toUpperCase()}</strong>.
    Nessuna modifica consentita.
  </div>
)}
```

**Step 3**: Passare `readOnly={isReadOnly}` a tutti i componenti di editing:

```jsx
// GeneralDataSection (riga ~471):
<GeneralDataSection
  ...props esistenti...
  readOnly={isReadOnly}
/>

// AuditObjectiveSection (riga ~500):
<AuditObjectiveSection
  auditObjective={currentAudit.metadata.auditObjective}
  onUpdate={handleAuditObjectiveUpdate}
  readOnly={isReadOnly}
/>

// ChecklistModule (riga ~616):
<ChecklistModule defaultNorm={key} readOnly={isReadOnly} />

// CustomChecklistAuditView (riga ~591):
<CustomChecklistAuditView audit={currentAudit} readOnly={isReadOnly} />

// NonConformitiesManager (riga ~653):
<NonConformitiesManager readOnly={isReadOnly} />

// AuditOutcomeSection — entrambe le istanze (sez. 11 e 12):
<AuditOutcomeSection
  auditOutcome={currentAudit.metadata.auditOutcome}
  onUpdate={handleAuditOutcomeUpdate}
  showConclusions={false}
  readOnly={isReadOnly}
/>
```

**Step 4**: Nel blocco `<div className="tipologia-audit-block">` (selezione fornitore, riga ~386), disabilitare i controlli quando `isReadOnly`:
```jsx
<input type="radio" ... disabled={isReadOnly} />
<select ... disabled={isReadOnly || companiesLoading} >
<input type="text" ... disabled={isReadOnly} />
```

### 2B — Applicare `readOnly` nei componenti figli

Per ogni componente elencato sotto, il deputy deve:
1. **Leggere** il file prima di modificarlo (golden rule)
2. Aggiungere `readOnly = false` come prop con default (retrocompatibile)
3. Disabilitare gli input/textarea/pulsanti quando `readOnly` è true

**Elenco componenti + pattern da applicare:**

| Componente | Cosa disabilitare |
|-----------|-------------------|
| `GeneralDataSection.jsx` | Tutti gli `<input>`, `<textarea>`, `<select>`, checkbox standard |
| `AuditObjectiveSection.jsx` | La textarea `description` |
| `ChecklistModule.jsx` | I pulsanti stato (`status-btn`), le textarea note/evidenze |
| `CustomChecklistAuditView.jsx` | I pulsanti esito, le textarea note, i blocchi evidenza |
| `NonConformitiesManager.jsx` | Form aggiunta NC, pulsanti modifica/elimina |
| `AuditOutcomeSection.jsx` | Textarea conclusioni, campi partecipanti |

**Pattern CSS**: aggiungere classe `readonly-mode` al wrapper più esterno di ogni componente quando `readOnly` è true, per styling unificato (es. cursore `not-allowed`, opacity ridotta):
```jsx
<div className={`componente-wrapper ${readOnly ? 'readonly-mode' : ''}`}>
```

**Pattern pulsanti**: `disabled={readOnly}` su ogni pulsante che scrive dati.

**Pattern textarea/input**: `disabled={readOnly}` o `readOnly={readOnly}` (usare `disabled` per evitare invio form accidentale).

### 2C — CSS: aggiungere stile `readonly-mode`

In `AuditAccordionLayout.css` (o nel file CSS più appropriato), aggiungere:

```css
/* Stile audit read-only */
.audit-readonly-banner {
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 6px;
  padding: 10px 16px;
  margin: 8px 0;
  font-size: 0.9rem;
  color: #92400e;
}

.readonly-mode {
  opacity: 0.75;
  pointer-events: none;
  user-select: none;
}

.readonly-mode button,
.readonly-mode input,
.readonly-mode textarea,
.readonly-mode select {
  cursor: not-allowed;
}
```

---

## FASE 3 — Fix AuditClosePanel: completamento custom (S-A3)

**File**: `app/src/components/AuditClosePanel.jsx`

**Problema**: audit con solo checklist custom (`currentAudit.checklist` vuoto → `hasIsoChecklist = false`) bypassa la soglia di completamento. Il pannello chiusura non mostra alcuna percentuale e non ha blockers.

**Fix** (nel `useMemo` di validazione, dopo il blocco `hasIsoChecklist`):

```javascript
// Aggiungere dopo il blocco if (hasIsoChecklist) { ... }:
const hasCustomChecklist = !!(currentAudit?.customChecklist || currentAudit?.metadata?.customChecklistId);
if (hasCustomChecklist && !hasIsoChecklist) {
  // Audit solo-custom: verifica che ci siano almeno alcune risposte
  const customStatuses = currentAudit?.customStatuses || {};
  const customTotal = Object.keys(customStatuses).length;
  const customAnswered = Object.values(customStatuses).filter(s => s && s !== 'NOT_ANSWERED').length;
  if (customTotal === 0) {
    blockers.push("Nessuna risposta registrata nella checklist personalizzata");
  } else {
    const customPct = Math.round((customAnswered / customTotal) * 100);
    if (customPct < COMPLETION_THRESHOLD) {
      blockers.push(
        `Checklist personalizzata completata al ${customPct}% (minimo richiesto: ${COMPLETION_THRESHOLD}%)`
      );
    }
  }
}
```

---

## Riepilogo attività

| # | Fase | File | Priorità | Note |
|---|------|------|----------|------|
| 1A | Guard responses API | `response.controller.js` | **P0** | saveResponse + bulkSaveResponses |
| 1B | Guard updateAudit API | `audit.controller.js` | **P0** | Solo `approved`/`archived` (vedi policy) |
| 1C | SyncService AUDIT_READ_ONLY | `syncService.js` | **P0** | Aggiungere a lista stall permanenti |
| 2A | predicato isReadOnly + banner | `AuditAccordionLayout.jsx` | **P0** | Propagare a tutti i figli |
| 2B | readOnly prop nei figli | 6 componenti (vedi lista) | **P0** | Leggere file prima di modificare |
| 2C | CSS readonly-mode | `AuditAccordionLayout.css` | P1 | Styling unificato |
| 3 | Completamento custom in ClosePanel | `AuditClosePanel.jsx` | P1 | Blocco chiusura audit solo-custom |

---

## Deploy

- **Backend**: dopo il commit, deploy via SSH VPS (`deploy-to-vps.sh` o scp manuale dei controller modificati + restart). **Nessuna migrazione DB necessaria** per questa slice.
- **Frontend**: Netlify auto-deploy da `main`.
- **Ordine**: deployare backend **prima** del frontend. Se il frontend read-only viene deployato prima del backend guard, l'utente vede i campi disabilitati ma l'API accetta ancora scritture (temporaneamente accettabile). Il contrario (backend guard senza frontend read-only) può causare errori 403 visibili — da evitare.

---

## Test attesi (verifica pre-merge obbligatoria)

```bash
cd app
NODE_ENV=test npm run test:run
npm run build
```

**Test L1 da aggiungere o verificare**:
- `syncService.js`: test che `AUDIT_READ_ONLY` causa stall permanente (pattern già esistente per `MODULE_NOT_LICENSED`)
- Se esistono test per `response.controller`: aggiungere scenario audit `completed` → expect 403

**Smoke manuale** (da documentare in PR):
1. Aprire audit in stato `in_progress` → modificare risposta → salva OK
2. Chiudere l'audit (ClosePanel) → stato diventa `completed`
3. Tentare modifica checklist → UI disabilitata + banner read-only
4. Tentare POST `/responses` via DevTools → risposta 403 `AUDIT_READ_ONLY`
5. Reload pagina → stato read-only persiste
6. Audit solo-custom vuoto → ClosePanel mostra blocker "Nessuna risposta registrata"

---

## Vincoli obbligatori

- **Diff minimo**: toccare solo i file elencati. Nessun refactor estetico.
- **Retrocompatibilità**: tutti i componenti che ricevono `readOnly` devono avere `readOnly = false` come default → zero breaking change su altri usi.
- **Multi-tenant**: le query di check status usano già `organization_id` — non rimuoverlo.
- **Nessun segreto** nel diff.
- **CI verde**: `ci-app-pr.yml` deve passare.

---

## Chiusura

Rispondere **TEST OK** con PR aperta + link, oppure per ogni fase non eseguita: **FIX NON APPLICABILE — [motivo]**.

Aggiornare `docs/PROJECT_ROADMAP.md` aggiungendo sotto la tabella sequenza priorità:
- `S-A1 Gate read-only UI` ✅
- `S-A2 Policy API AUDIT_READ_ONLY` ✅  
- `S-A3 ClosePanel custom completion` ✅
