# DEPUTYTASK — ADR-009 Fase 2: flag `isIntegratedSystem` + comportamento SGI

**Stato:** APERTO  
**Priorità:** P0 roadmap — "Prossimo Step" da settimane  
**Branch base:** `main` (aggiornato al 21/07/2026)  
**Creato da:** Lead 21/07/2026

---

## Contesto

L'analisi del codice conferma: la **metà della Fase 2 è già implementata**. Le barre di completamento per-norma in `AuditClosePanel` e le tab conclusioni per-norma in `AuditOutcomeSection` esistono già e funzionano. Manca SOLO il **flag `isIntegratedSystem`** che governa quando usare la vista unificata (SGI) vs quella separata per-norma.

Documentazione di riferimento:
- ADR: `docs/adr/ADR-009-multi-standard-architettura-per-norma.md` § 4 (flag SGI)
- Helper già pronto: `isAllHls(selectedStandards)` in `app/src/data/standardsRegistry.js`

---

## Cosa NON toccare

- `standardsRegistry.js` — completo, non modificare
- `metricsCalculator.js` — completo
- `MetricsByStandardChip.jsx` — completo
- Backend / DB — zero modifiche richieste
- `AuditClosePanel.jsx` (già implementato per-norma) — piccola modifica solo per rispettare il flag

---

## Slice 1 — `AuditAccordionLayout.jsx`: gestione prop `isIntegratedSystem`

**File:** `app/src/components/AuditAccordionLayout.jsx`

**Cosa fare:**

1. Leggere il flag dall'audit corrente (in cima al componente, vicino agli altri metadata):
   ```js
   const isIntegratedSystem = currentAudit.metadata?.isIntegratedSystem ?? null;
   ```
   `null` = non ancora impostato → ogni componente usa il proprio default retrocompatibile.

2. Aggiungere handler `handleIsIntegratedSystemUpdate`:
   ```js
   const handleIsIntegratedSystemUpdate = (value) => {
     onUpdate("isIntegratedSystem", value);
   };
   ```

3. Passare `isIntegratedSystem` e il nuovo handler a `GeneralDataSection`:
   ```jsx
   <GeneralDataSection
     ...
     isIntegratedSystem={isIntegratedSystem}
     onIsIntegratedSystemChange={handleIsIntegratedSystemUpdate}
   />
   ```

4. Passare `isIntegratedSystem` a entrambe le istanze di `AuditOutcomeSection` (sezione 11 e sezione 12):
   ```jsx
   <AuditOutcomeSection
     ...
     isIntegratedSystem={isIntegratedSystem}
   />
   ```

**Test:** build Vite senza errori, test L1 verdi.

---

## Slice 2 — `GeneralDataSection.jsx`: checkbox SGI

**File:** `app/src/components/GeneralDataSection.jsx`

**Cosa fare:**

1. Aggiungere 2 nuovi props alla firma:
   ```js
   function GeneralDataSection({
     ...,
     isIntegratedSystem = null,
     onIsIntegratedSystemChange,
   })
   ```

2. Aggiungere import:
   ```js
   import { isAllHls } from "../data/standardsRegistry";
   ```

3. Determinare se il toggle va mostrato (solo per 2+ norme tutte HLS):
   ```js
   const showSgiToggle = selectedStandards.length >= 2 && isAllHls(selectedStandards);
   ```

4. Inserire il toggle **dopo** il selettore delle norme, prima del campo "Oggetto audit":
   ```jsx
   {showSgiToggle && (
     <div className="form-group sgi-toggle-group">
       <label className="sgi-toggle-label">
         <input
           type="checkbox"
           checked={isIntegratedSystem ?? true}
           onChange={e => onIsIntegratedSystemChange?.(e.target.checked)}
           disabled={readOnly}
         />
         <span>Sistema di Gestione Integrato (SGI)</span>
       </label>
       <small className="form-hint">
         Attivo: conclusioni e metriche unificate (tutti gli standard insieme).
         Disattivo: conclusioni e report separati per norma.
       </small>
     </div>
   )}
   ```
   Il default `isIntegratedSystem ?? true` mostra la checkbox spuntata per nuovi audit multi-HLS.

5. Aggiungere in `GeneralDataSection.css`:
   ```css
   .sgi-toggle-group { margin: 0.75rem 0 1rem; }
   .sgi-toggle-label { display: flex; align-items: flex-start; gap: 0.5rem; cursor: pointer; font-weight: 500; }
   .sgi-toggle-label input[type="checkbox"] { margin-top: 2px; flex-shrink: 0; }
   ```

**Nota retrocompatibilità**: il toggle appare solo per audit con 2+ norme HLS (`isAllHls`). Audit mono-standard (Camellini su solo 9001) e audit con norme non-HLS (Mason ISO 3834) non vedono il toggle.

**Test:** `npm run test:run` verde.

---

## Slice 3 — `AuditOutcomeSection.jsx`: rispetta il flag

**File:** `app/src/components/AuditOutcomeSection.jsx`

**Cosa fare:**

1. Aggiungere prop `isIntegratedSystem = null` alla firma.

2. Calcolare il comportamento effettivo:
   ```js
   // null = non impostato: default false per multi (comportamento pre-ADR esistente)
   const effectiveIntegrated = isMultiStandard
     ? (isIntegratedSystem ?? false)
     : true;
   ```

3. **Sezione 11 — Rilievi (metriche)**:
   - Se `effectiveIntegrated === true` e `isMultiStandard`: mostrare il blocco aggregato totale (stesso codice del percorso `!isMultiStandard`).
   - Se `effectiveIntegrated === false` e `isMultiStandard`: mostrare per-norma (comportamento attuale — invariato).
   
   Sostituire la condizione `{!isMultiStandard && ...}` con `{(!isMultiStandard || effectiveIntegrated) && ...}`.
   Sostituire la condizione `{isMultiStandard && ...}` con `{isMultiStandard && !effectiveIntegrated && ...}`.

4. **Sezione 12 — Conclusioni**:
   - Se `effectiveIntegrated === true` (o `!isMultiStandard`): mostrare la singola `AutoTextarea` con id `"conclusions"` e valore `conclusions` (comportamento attuale mono-standard).
   - Se `effectiveIntegrated === false` e `isMultiStandard`: mostrare le tab per-norma `conclusionsByKey` (comportamento attuale multi-standard).
   
   Modificare le condizioni esistenti:
   ```jsx
   {/* Standard singolo O sistema integrato: una textarea */}
   {(!isMultiStandard || effectiveIntegrated) && (
     <AutoTextarea ... />
   )}
   {/* Multi-standard NON integrato: una textarea per norma */}
   {isMultiStandard && !effectiveIntegrated && standardEntries.map(...)}
   ```

**Invarianza per audit esistenti**: gli audit multi-standard precedenti hanno `isIntegratedSystem=null` → `effectiveIntegrated=false` → mostrano le tab per-norma come oggi. Zero breaking change.

**Test:** `npm run test:run` verde. Verificare che i test esistenti in `AuditOutcomeSection` (se presenti) passino.

---

## Slice 4 — `AuditClosePanel.jsx`: rispetta il flag

**File:** `app/src/components/AuditClosePanel.jsx`

**Cosa fare:**

1. Leggere il flag dall'audit in cima alla funzione (vicino a `selectedStandards`):
   ```js
   const isIntegratedSystem = currentAudit?.metadata?.isIntegratedSystem ?? null;
   const effectiveIntegrated = isMultiStandard
     ? (isIntegratedSystem ?? false)
     : true;
   ```

2. **Barre di completamento** (linee ~478): attualmente mostra barre per-norma quando `isMultiStandard`. Modificare per mostrare barra unica quando `effectiveIntegrated`:
   ```jsx
   {hasIsoChecklistForGuide && (
     effectiveIntegrated
       ? [{shortLabel: "Checklist", pct: checklistPct}]
       : normCompletions.filter(n => n.hasDomande)
   ).map(({ shortLabel, pct }, i) => (
     // ... render barra (invariato)
   ))}
   ```

3. **`fieldDescriptors` — conclusioni** (linee ~170-183): attualmente mostra una voce per norma quando `isMultiStandard`. Modificare:
   ```js
   ...(isMultiStandard && !effectiveIntegrated
     ? standardEntries.map(({ key, shortLabel }) => ({
         id: `conclusions-${key}`,
         text: `Conclusioni ${shortLabel} (Sezione 12)`,
         isMissing: !oc.byStandard?.[key]?.conclusions?.trim(),
         ...
       }))
     : [{
         id: "conclusions", text: "Conclusioni (Sezione 12)", 
         isMissing: !oc.conclusions?.trim(),
         ...
       }]
   ),
   ```

4. **`fieldDescriptors` — completamento checklist** (linee ~185-207): analogamente, mostrare barre per-norma solo se `!effectiveIntegrated`:
   ```js
   ...(isMultiStandard && !effectiveIntegrated
     ? normCompletions.filter(n => n.hasDomande).map(...)
     : hasIsoChecklistForGuide ? [{ id: "checklistPct", ... }] : []
   ),
   ```

**Test:** `npm run test:run` verde.

---

## Sequenza di lavoro

```bash
git pull origin main
git checkout -b cursor/adr009-fase2-sgi-flag-3bea
```

Eseguire le 4 slice in ordine (ognuna committabile separatamente):
1. `git commit -m "feat: ADR-009 Fase2 slice1 — AuditAccordionLayout propaga isIntegratedSystem"`
2. `git commit -m "feat: ADR-009 Fase2 slice2 — GeneralDataSection checkbox SGI"`
3. `git commit -m "feat: ADR-009 Fase2 slice3 — AuditOutcomeSection rispetta isIntegratedSystem"`
4. `git commit -m "feat: ADR-009 Fase2 slice4 — AuditClosePanel rispetta isIntegratedSystem"`

```bash
git push -u origin cursor/adr009-fase2-sgi-flag-3bea
```

Aprire PR su `main`, titolo: `feat: ADR-009 Fase 2 — flag isIntegratedSystem (SGI) + comportamento conclusioni/chiusura per-norma`

---

## Definizione di completamento (DoD)

- `npm run test:run` — 802+ test verdi (nessun test nuovo obbligatorio per queste slice; se ne aggiungi, devono passare)
- `npm run build` — build Vite senza errori
- Audit **mono-standard** esistente: nessun cambiamento visibile in UI (toggle non mostrato)
- Audit **multi-HLS** esistente (senza flag): comportamento identico a prima (tab per-norma, `effectiveIntegrated=false`)
- Audit **multi-HLS** nuovo con toggle attivo: una sola casella conclusioni + barra unica nel ClosePanel
- Audit **con norma non-HLS** (es. ISO 3834 / RDP): toggle non mostrato, comportamento invariato
- PR draft aperta; chiudere con TEST OK o FIX NON APPLICABILI con motivazione
