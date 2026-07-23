# DEPUTYTASK2 — Action Plan P1: collegamento Reclami + statistiche per categoria

**Stato:** CHIUSO — TEST OK, mergiato PR #278 (22/07/2026). Backend deployato su VPS e verificato con smoke test (17/17 ✅).  
**Priorità:** P1 backlog (PR #114 in produzione)  
**Branch base:** `main`  
**Creato da:** Lead 21/07/2026

---

## Contesto

Il modulo Piano Azioni (tabella `action_plan_items`, pagina NC) ha già 7 categorie origine (`source_category`). Due gap P1 da chiudere:

1. **Collegamento Reclami**: quando `source_category='complaint'`, mostrare un picker per selezionare il reclamo collegato e visualizzare il numero reclamo nel dettaglio.
2. **Statistiche per categoria**: i contatori della stats bar mostrano solo totale NC/OSS — aggiungere un breakdown per `source_category` (es. quante azioni da audit, da riesame, da rischi...).

La FK `source_complaint_id` esiste già nel DB (migration 055). È solo UI da collegare.

---

## Slice 1 — Picker reclamo in form NC (quando source_category='complaint')

### Dove intervenire

File principale: `app/src/components/NonConformitiesManager.jsx` (o il form NC equivalente — verificare con `rg "source_category" app/src/`).

### Cosa fare

1. Quando l'utente seleziona `source_category = 'complaint'` nel form, mostrare un campo aggiuntivo "Reclamo collegato":
```jsx
{formData.source_category === 'complaint' && (
  <div className="form-group">
    <label>Reclamo collegato</label>
    <select
      value={formData.source_complaint_id || ''}
      onChange={e => setFormData(p => ({ ...p, source_complaint_id: e.target.value || null }))}
      className="form-control"
    >
      <option value="">— Seleziona reclamo (opzionale) —</option>
      {complaints.map(c => (
        <option key={c.id} value={c.id}>
          {c.complaint_number} — {c.description?.substring(0, 60) || ''}
        </option>
      ))}
    </select>
    <small className="form-hint">Collega questa azione al reclamo di origine.</small>
  </div>
)}
```

2. Caricare la lista reclami da API quando `source_category` cambia a `'complaint'`:
```js
useEffect(() => {
  if (formData.source_category !== 'complaint') { setComplaints([]); return; }
  apiService.get('/complaints?limit=50')
    .then(res => setComplaints(res?.data || []))
    .catch(() => setComplaints([]));
}, [formData.source_category]);
```
(Verificare il path API reclami nel codebase con `rg "complaints" backend/src/routes/`.)

3. Nella **vista dettaglio** NC con `source_category='complaint'` e `source_complaint_id` valorizzato, mostrare link:
```jsx
{item.source_category === 'complaint' && item.source_complaint_id && (
  <div className="nc-source-link">
    <span>Reclamo collegato:</span>
    <button
      className="nc-source-link-btn"
      onClick={() => navigate(`/complaints/${item.source_complaint_id}`)}
      type="button"
    >
      {item.source_complaint_number || `#${item.source_complaint_id}`}
    </button>
  </div>
)}
```

4. Verificare che il backend (`nonConformities.controller.js` o `actionPlan.controller.js`) salvi `source_complaint_id` nella INSERT/UPDATE. Se manca, aggiungere al body parsing.

**DoD Slice 1:**
- Form mostra picker reclami solo quando `source_category='complaint'`
- `source_complaint_id` salvato nel DB e mostrato nel dettaglio
- `npm run test:run` verde

---

## Slice 2 — Statistiche per categoria nella stats bar

### Dove intervenire

Cercare con `rg "getNonConformitiesStatistics\|nc-statistics\|stats.*bar" app/src/` per trovare dove si renderizzano i contatori.

### Cosa fare

1. **Backend**: Aggiungere breakdown per `source_category` all'endpoint statistiche esistente (es. `GET /non-conformities/statistics` o `/action-plan/statistics`):
```sql
SELECT
  source_category,
  COUNT(*) AS total,
  SUM(CASE WHEN status IN ('open', 'in_progress') THEN 1 ELSE 0 END) AS open_count,
  SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_count
FROM action_plan_items
WHERE organization_id = @orgId
  AND (company_id = @companyId OR @companyId IS NULL)
GROUP BY source_category
```
Aggiungere `by_category` all'oggetto risposta (additive, non breaking).

2. **Frontend**: Nella stats bar, aggiungere una sezione espandibile/collassabile "Per origine":
```jsx
<div className="stats-breakdown">
  <button
    className="stats-breakdown-toggle"
    onClick={() => setShowBreakdown(p => !p)}
    type="button"
  >
    {showBreakdown ? '▲' : '▼'} Per origine
  </button>
  {showBreakdown && (
    <div className="stats-breakdown-list">
      {byCategory.map(({ source_category, open_count, total }) => (
        <div key={source_category} className="stats-breakdown-item">
          <span>{SOURCE_CATEGORY_LABELS[source_category] || source_category}</span>
          <span>{open_count} aperte / {total} totali</span>
        </div>
      ))}
    </div>
  )}
</div>
```

3. `SOURCE_CATEGORY_LABELS` deve già esistere nel codebase — verificare con `rg "SOURCE_CATEGORY_LABELS\|source_category.*label" app/src/`. Se non esiste, creare:
```js
export const SOURCE_CATEGORY_LABELS = {
  audit:             'Da audit',
  complaint:         'Da reclamo',
  risk:              'Da rischio/opportunità',
  management_review: 'Da riesame direzione',
  improvement:       'Miglioramento continuo',
  operational:       'Operativa',
  external:          'Esterna',
};
```

**DoD Slice 2:**
- Stats bar mostra breakdown per categoria (collassato di default)
- Endpoint statistiche ritorna `by_category` (backward compatible)
- `npm run test:run` verde

---

## Sequenza di lavoro

```bash
git pull origin main
git checkout -b cursor/action-plan-p1-3bea
```

Slice 1 → commit → Slice 2 → commit → push → PR

**Commit message standard:**
```
feat: Action Plan P1 Slice1 — picker reclamo in form NC (source_complaint_id)
feat: Action Plan P1 Slice2 — statistiche per categoria nella stats bar
```

---

## DoD globale

- `npm run test:run` verde dopo ogni slice
- `npm run build` verde prima del push
- Nessuna migrazione DB necessaria (FK `source_complaint_id` già presente da mig. 055)
- Se il controller backend non salva `source_complaint_id`: aggiornare e **deployare il controller sul VPS** + restart
- PR draft aperta; chiudere con TEST OK o FIX NON APPLICABILI
