# DEPUTYTASK — S-A6: Pulizia modulo audit (opzione D — senza registro NC locale)

> **Data**: 06/05/2026  
> **Autore**: Lead Agent  
> **Riferimento**: `docs/agent-tasks/AUDIT_MODULE_LEAD_BRIEF.md` §10 (opzione **D**) + tabella slice §5  
> **Tipo**: Frontend (+ test/mock); **nessun deploy backend obbligatorio** per questo slice  
> **Fuori scope**: implementazione **«Importa NC da audit»** nel modulo `/nc` (task successivo dopo chiusura S-A6)  
> **Chiusura attesa**: **TEST OK** oppure **FIX NON APPLICABILI — [motivo]**

---

## Obiettivo prodotto

- Nel **modulo audit** non deve esistere una sezione dedicata al **registro NC** (`NonConformitiesManager`): le non conformità “da gestione” vivono solo nel **modulo NC** (`/nc`).
- In audit restano: **esito NC sui punti checklist** (già presente), **metriche** allineate al server (`non_conformities_count` da risposte), **pendenze**, export Word/JSON come oggi.
- **Rischio accettato**: eventuali dati inseriti solo in `currentAudit.nonConformities` (IndexedDB, mai sincronizzati) **non saranno più accessibili** dall’UI dopo questo PR (stesso rischio già documentato per opzione A). Mitigazione consigliata: export JSON audit prima del merge in produzione, se serve recupero manuale.

---

## FASE 0 — Inventario (grep prima di modificare)

Eseguire ricerca su `nonConformities` / `NonConformitiesManager` e annotare ogni occorrenza. File già noti al lead (lista non esaustiva se grep trova altro):

| Area | File |
|------|------|
| UI accordion | `app/src/components/AuditAccordionLayout.jsx` |
| Componente da rimuovere | `app/src/components/NonConformitiesManager.jsx`, `NonConformitiesManager.css` |
| Metriche dashboard | `app/src/components/MetricsDashboard.jsx` |
| Hook metriche | `app/src/hooks/useAuditMetrics.js` |
| Utilità audit | `app/src/utils/auditUtils.js` (`calculateNCStats`, `validateAudit`, `canArchiveAudit`, `exportAuditSummary`, `getAggregateStats`, …) |
| Export summary | `app/src/utils/exportManager.js` (`exportAuditSummary`) |
| Modello dati / factory | `app/src/data/auditDataModel.js` (tipo `NonConformity`, `createEmpty…`, validazione `nonConformities must be array`) |
| Converter | `app/src/utils/auditConverter.js` (oggi `nonConformities: []` — valutare se lasciare array vuoto fisso o documentare) |
| Mock / test | `app/src/data/mockAudits.js`, `testMockData.js`, `testAuditUtils.js`, `testStorageLayer.js` |
| Altri test | ogni `*.test.*` / `*.spec.*` che importa NC registro |

**Regola**: ogni file toccato deve compilare; nessun import orfano a `NonConformitiesManager`.

---

## FASE 1 — Rimuovere UI registro NC dall’audit

### 1A — `AuditAccordionLayout.jsx`

- Rimuovere `import NonConformitiesManager`.
- Rimuovere il blocco JSX della sezione **Registro NC** (accordion item + contenuto che renderizza `<NonConformitiesManager … />`).
- Se esiste voce di menu/ stato `openSubSections` / chiavi legate solo a quella sezione, rimuoverle o ripulire i default iniziali coerentemente (nessuna sezione fantasma).
- **Opzionale (UX)**: sotto **Esito audit** o in testa accordion, una riga testuale + link React Router verso `/nc` del tipo: *«Registro NC e azioni correttive: modulo Non conformità »* (solo se il tab `/nc` è già raggiungibile per l’utente; altrimenti omettere o nascondere con stesso gate del menu NC).

### 1B — Eliminare file componente

- Eliminare `app/src/components/NonConformitiesManager.jsx`.
- Eliminare `app/src/components/NonConformitiesManager.css`.

---

## FASE 2 — Allineare metriche e validazioni al “solo checklist”

### 2A — `MetricsDashboard.jsx`

- La card **«Non Conformità»** deve riflettere **`metrics.nonConformitiesCount`** (o conteggio da checklist con stesso valore), **non** `currentAudit.nonConformities.length`.
- Rimuovere breakdown Major/Minor/Osservazione **se** derivato solo dal registro locale. Sostituzione minima accettabile:
  - mostrare **un solo numero** = NC checklist + sottotesto esplicativo: *«Esiti NC sui punti checklist (gestione nel modulo NC)»*, oppure
  - se si vuole mantenere qualcosa di più ricco: calcolare **solo** da checklist (conteggio `q.status === CHECKLIST_STATUS.NON_COMPLIANT` / `'NC'`) senza usare `audit.nonConformities[]`.

### 2B — `useAuditMetrics.js`

- `ncStats` basato su `audit.nonConformities` va **rimosso o sostituito** con statistiche da checklist (es. conteggio risposte `NC`).
- `syncCheck.ncCountMatch`: oggi confronta `metrics.nonConformitiesCount` con `ncStats.total` del registro — **incoerente** dopo D. Impostare confronto coerente (es. entrambi da checklist / `metrics`) oppure rimuovere quel check se non più significativo.
- Verificare che nessun consumatore si aspetti ancora `ncStats.byCategory` dal registro.

### 2C — `auditUtils.js`

- **`calculateNCStats`**: deprecare o reimplementare come **conteggio esiti NC sulla checklist** (restituire oggetto con `total` = numero domande con status NC, altri campi a 0 o rimossi se nessun chiamante).
- **`validateAudit`**: regole 4, 8, 9 che usano `audit.nonConformities` per “NC aperte” / azioni correttive / evidenze — **adeguare o rimuovere**. Dopo D, “NC aperte” nel senso registro **non esistono** in audit: usare solo metriche checklist o togliere il warning se fuorviante.
- **`canArchiveAudit`**: il blocco “NC ancora aperte” basato su `nonConformities` va rimosso o sostituito con policy definita dal lead (suggerimento: **non** bloccare archiviazione per il vecchio registro; eventuale blocco solo su pendenze DB non risolte, già presente).
- **`exportAuditSummary`** (in `auditUtils.js`): `majorNC` / `minorNC` / `observations` da registro → sostituire con **`nonConformitiesCount`** da `metrics` e/o conteggio checklist; eliminare dipendenza da `audit.nonConformities`.
- **`getAggregateStats`**: `totalNC` deve sommare **metriche checklist** (es. `audit.metrics?.nonConformitiesCount`), non `audit.nonConformities.length`.

### 2D — `exportManager.js` — `exportAuditSummary`

- Sezione `nonConformities`: non usare `audit.nonConformities` (può essere `[]` o assente). Usare `audit.metrics.nonConformitiesCount` e, se serve una lista, **derivarla dalla checklist** (clause + testo domanda + note) oppure esporre solo totali + nota *«dettaglio nel modulo NC»*.

---

## FASE 3 — Modello dati e persistenza

### 3A — `auditDataModel.js`

- Mantenere `nonConformities: []` negli audit creati **per compatibilità schema** finché non si fa refactoring profondo, **oppure** rimuovere il campo se nessun codice lo richiede più (preferenza: **mantenere array vuoto** + JSDoc *deprecated / non usato in UI* per non rompere JSON vecchi in IndexedDB).
- Aggiornare commenti `@property` su `nonConformities` → *legacy, non usato; NC gestite in modulo `/nc`*.
- Validazione: se `nonConformities must be array` resta, accettare sempre `[]` da merge.

### 3B — `auditConverter.js`

- Nessun cambio funzionale obbligatorio se resta `nonConformities: []`; aggiungere commento una riga che rimanda a opzione D.

### 3C — `StorageContext.jsx` (se presente)

- Cercare aggiornamenti a `nonConformities` nella `updateCurrentAudit` / sync: rimuere rami morti o lasciare no-op se il campo resta sempre `[]`.

---

## FASE 4 — Mock, fixture, test automatici

- Aggiornare `mockAudits.js` / `testMockData.js` / `testAuditUtils.js` / `testStorageLayer.js`: rimuovere oggetti NC ricchi nel registro in audit **oppure** lasciarli come `[]` e spostare i casi d’uso verso checklist con status `NC` dove servono test.
- Eseguire `NODE_ENV=test npx vitest run` in `app/` e correggere **tutti** i test rossi.
- Aggiungere almeno **un test mirato** (es. helper o `MetricsDashboard` / `useAuditMetrics`) che verifica: *assenza registro* → conteggio NC = **metriche checklist** o `metrics.nonConformitiesCount`.

---

## FASE 5 — Verifica manuale minima (L3 leggero)

1. Aprire un audit con risposte **NC** su checklist: dashboard / metriche mostrano conteggio coerente, **nessuna** sezione registro NC in accordion.  
2. Read-only post-chiusura: nessun errore console per componente mancante.  
3. Export summary / JSON (se esposto in UI): nessun crash; sezione NC sensata.  
4. Menu `/nc`: raggiungibile come prima (nessuna regressione routing).

---

## FASE 6 — Documentazione post-merge

- Aggiornare riga **S-A6** in `docs/PROJECT_ROADMAP.md` a **Completato** con data.  
- In `docs/GUIDA_CONSOLIDATA.md` (sessione 06/05 o nota breve): S-A6 implementato — registro NC rimosso da audit; ponte import = task successivo.  
- In `AUDIT_MODULE_LEAD_BRIEF.md` changelog §8: chiusura slice S-A6.

---

## Vincoli

- **Un PR** focalizzato; niente implementazione «Importa da audit» in questo PR.  
- **Diff minimo** fuori dal perimetro NC-audit (no refactor estetici non richiesti).  
- Rispettare **ADR-008** per eventuali nuovi endpoint (non richiesti qui).

---

## Comandi test

```bash
cd app
NODE_ENV=test npx vitest run
npm run build
```

---

## Chiusura

Rispondere **TEST OK** (con PR / branch) oppure **FIX NON APPLICABILI — [motivo]**.

**Per il committente (Cursor Agents)**: dopo merge, se serve recupero dati vecchi dal registro locale, usare backup export JSON **prima** del rilascio in produzione.
