# DEPUTYTASK — NESSUN TASK ATTIVO (07/05/2026)

> S-A4 completata (PR mergiata). Nessun task attualmente delegato al deputy.
> Prossima sessione: leggere `docs/agent-tasks/RIPRESA_SESSIONE_2026-05-07-B.md`.

---

<!-- archivio S-A4 -->
# [ARCHIVIATO] S-A4: Pending Issues — ordinamento + deep-link domanda + zero-state

> **Data**: 04/05/2026  
> **Autore**: Lead Agent  
> **Riferimento**: `docs/agent-tasks/AUDIT_MODULE_LEAD_BRIEF.md` §9 (slice S-A4)  
> **Tipo**: UX improvement — solo frontend  
> **Branch**: `feat/pending-deeplink-sa4-92ab` da `main`  
> **Nessuna migrazione DB. Nessun deploy backend.**  
> **Chiusura attesa**: TEST OK

---

## Contesto

`PendingIssuesCascade.jsx` mostra i rilievi pendenti dal re-audit precedente ma ha 3 gap UX:
1. **Ordinamento**: il DB restituisce NC/NV/OSS in ordine alfabetico → `NV` precede `OSS` visivamente
2. **Zero-state silenzioso**: se non ci sono rilievi il componente ritorna `null` senza feedback
3. **Nessun link domanda**: l'auditor non può saltare alla clausola corrispondente nella checklist

---

## FASE 1 — `PendingIssuesCascade.jsx`

### 1A — Ordinamento NC → OSS → NV

Aggiungere subito dopo la dichiarazione degli `useState`, prima del `return`:

```javascript
// Ordinamento esplicito: NC prima, poi OSS, poi NV
const STATUS_ORDER = { NC: 0, OSS: 1, NV: 2 };
const sortedIssues = [...issues].sort(
  (a, b) => (STATUS_ORDER[a.original_status] ?? 9) - (STATUS_ORDER[b.original_status] ?? 9)
);
```

Nel JSX, sostituire ogni `issues.map(...)` con `sortedIssues.map(...)`.  
I contatori `ncCount`, `ossCount`, `nvCount`, `resolvedCount`, `persistsCount` restano su `issues` (contano il totale, non l'ordinato — corretto).

### 1B — Zero-state esplicito

Sostituire il `return null` (riga ~173):

```javascript
// PRIMA:
if (!loading && issues.length === 0 && !error) return null;

// DOPO:
if (!loading && issues.length === 0 && !error) {
  // Mostra messaggio positivo solo se l'audit ha un clientName (= re-audit reale, non audit nuovo)
  if (!clientName) return null;
  return (
    <div className="pending-cascade pending-cascade--empty">
      <p className="pending-empty-msg">✅ Nessun rilievo pendente dall'audit precedente.</p>
    </div>
  );
}
```

### 1C — Prop `onGoToQuestion` + pulsante "Vai alla domanda"

**Step 1**: Aggiungere la prop alla firma del componente:

```javascript
// PRIMA:
function PendingIssuesCascade() {

// DOPO:
function PendingIssuesCascade({ onGoToQuestion }) {
```

**Step 2**: Nella card di ogni rilievo (subito dopo `<div className="issue-header">`), aggiungere il pulsante solo se la prop è presente e `section_code` è disponibile:

```jsx
{/* Pulsante deep-link domanda */}
{onGoToQuestion && issue.section_code && (
  <button
    className="issue-goto-btn"
    type="button"
    onClick={() => onGoToQuestion(issue.section_code, issue.question_id)}
    title={`Vai alla clausola ${issue.section_code} nella checklist`}
  >
    🔍 Vai alla domanda
  </button>
)}
```

Posizionarlo dentro `<div className="issue-title-section">`, dopo `<h4 className="issue-title">`.

### 1D — CSS in `PendingIssuesCascade.css`

Aggiungere in fondo al file:

```css
/* Zero-state */
.pending-cascade--empty {
  padding: 12px 16px;
}
.pending-empty-msg {
  color: #16a34a;
  font-size: 0.9rem;
  margin: 0;
}

/* Deep-link pulsante */
.issue-goto-btn {
  background: none;
  border: 1px solid #6366f1;
  border-radius: 4px;
  color: #6366f1;
  cursor: pointer;
  font-size: 0.78rem;
  padding: 2px 8px;
  margin-top: 4px;
  transition: background 0.15s;
}
.issue-goto-btn:hover {
  background: #eef2ff;
}
```

---

## FASE 2 — `AuditAccordionLayout.jsx`

### 2A — Callback `handleGoToQuestion`

Aggiungere dopo le dichiarazioni `handleGeneralDataUpdate`, `handleAuditObjectiveUpdate`, ecc.:

```javascript
/**
 * Deep-link: apre la sezione checklist e la sottosezione dello standard
 * che contiene section_code, poi scrolla alla domanda tramite id DOM.
 */
const handleGoToQuestion = useCallback((sectionCode, questionId) => {
  if (!sectionCode) return;
  const lower = sectionCode.toLowerCase();

  // Trova lo standard in STANDARDS_CONFIG che corrisponde al section_code
  const stdEntry = STANDARDS_CONFIG.find(({ key }) => {
    if (key === 'ISO_9001'   && lower.includes('9001')) return true;
    if (key === 'ISO_14001'  && lower.includes('14001')) return true;
    if (key === 'ISO_45001'  && lower.includes('45001')) return true;
    if (key === 'ISO_3834_2' && (lower.includes('3834') || lower.includes('rdp'))) return true;
    return false;
  });

  // Apri sezione "Checklist" + sottosezione standard (o custom se non trovato)
  setOpenSections(prev => ({ ...prev, checklist: true }));
  if (stdEntry) {
    setOpenSubSections(prev => ({ ...prev, [stdEntry.subsId]: true }));
  }

  // Scroll alla domanda dopo che React ha re-renderizzato l'accordion aperto
  if (questionId) {
    setTimeout(() => {
      const el = document.getElementById(`question-${questionId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
  }
}, []); // STANDARDS_CONFIG, setOpenSections, setOpenSubSections sono stabili
```

### 2B — Passare la callback a `PendingIssuesCascade`

Trovare il punto dove viene renderizzato `<PendingIssuesCascade />` (riga ~525) e aggiungere la prop:

```jsx
// PRIMA:
<PendingIssuesCascade />

// DOPO:
<PendingIssuesCascade onGoToQuestion={handleGoToQuestion} />
```

---

## FASE 3 — `QuestionCard.jsx`

Aggiungere `id` sul wrapper div per permettere lo scroll:

```jsx
// PRIMA (riga ~57):
<div className={cardClass}>

// DOPO:
<div
  className={cardClass}
  id={question.questionId ? `question-${question.questionId}` : undefined}
>
```

`question.questionId` è il campo numerico idratato dal server (già usato da `AttachmentPreview`).  
Se `questionId` non è disponibile (domanda non ancora idratata o custom), l'`id` resta assente — lo scroll silenziosamente non trova il target, senza errori.

---

## Riepilogo file toccati

| File | Modifica |
|------|----------|
| `app/src/components/PendingIssuesCascade.jsx` | Ordinamento, zero-state, prop `onGoToQuestion`, pulsante "Vai alla domanda" |
| `app/src/components/PendingIssuesCascade.css` | Stili zero-state + pulsante |
| `app/src/components/AuditAccordionLayout.jsx` | `handleGoToQuestion` callback + passa prop |
| `app/src/components/QuestionCard.jsx` | `id={question-${questionId}}` sul wrapper |

**Nessun file backend. Nessuna migrazione.**

---

## Vincoli

- `PendingIssuesCascade` deve restare retrocompatibile: se `onGoToQuestion` non viene passata, il pulsante non compare (già gestito con `onGoToQuestion &&`).
- `handleGoToQuestion` usa `useCallback` con deps vuote (funzioni setter React sono stabili).
- Lo scroll avviene dopo 350ms per dare tempo a React di aprire l'accordion — non usare ref o layout effect per semplicità.
- Diff minimo: non toccare altri file, non refactoring estetici.

---

## Test attesi

```bash
cd app
NODE_ENV=test npx vitest run
npm run build
```

**Smoke manuale** (documentare in PR):
1. Aprire un re-audit con rilievi pendenti → verificare ordine: NC prima, poi OSS, poi NV
2. Aprire un audit senza rilievi pendenti → verificare comparsa messaggio "✅ Nessun rilievo pendente"
3. Click "🔍 Vai alla domanda" su un rilievo NC → verificare apertura accordion checklist + scroll alla domanda
4. Aprire un audit nuovo (non re-audit) → verificare che nessun messaggio compaia (clientName presente ma nessun audit precedente → `null`)

---

## Chiusura

Rispondere **TEST OK** con PR aperta + link, oppure **FIX NON APPLICABILE — [motivo]** per ogni fase non eseguita.

Aggiornare `docs/PROJECT_ROADMAP.md` aggiungendo `S-A4 Pending deep-link` ✅ nella tabella priorità.
