# DEPUTYTASK — GAP P1 Modulo Generazione Report

**Stato:** CHIUSO — TEST OK (802 test verdi, build Vite OK) — PR #270 mergiata su main 21/07/2026  
**Priorità:** P1 (media — qualità output, UX, pulizia codice)  
**Branch di riferimento:** `cursor/fix-report-reaudit-p0-3bea` (P0 già mergiata — lavorare da `main` dopo merge)  
**Creato da:** Lead 21/07/2026

---

## Contesto

L'analisi dei moduli "Generazione Report" e "Re-Audit" ha identificato **4 gap P1** da risolvere dopo i fix P0 già applicati. I P0 (GAP 1/10/11) sono stati committati sul branch sopra e sono in attesa di merge.

Il deputy deve lavorare su questi 4 slice in sequenza, ognuno con un commit separato.

---

## Slice 1 — GAP 3: Rimuovere console.log di debug da ExportPanel (basso rischio)

**File:** `app/src/components/ExportPanel.jsx`

**Problema:** Presenti ~7 `console.log` con emoji (📋 📎) che appaiono in produzione nella console del browser. Viola le regole di qualità codice del progetto.

**Cosa fare:**
1. Rimuovere (non sostituire) tutti i `console.log(...)` con prefisso `[EXPORT]` in `ExportPanel.jsx`.
   - Lasciare i `console.warn` (sono avvisi di fallback legittimi).
   - Lasciare i `console.error` (errori da mostrare in dev).
2. Verificare che nessun `console.log` rimanga nel file tranne eventualmente dentro un blocco `if (process.env.NODE_ENV === 'development')` già esistente (isDev).

**Test:** `npm run test:run` — tutti i test devono restare verdi. Nessuna modifica di logica.

---

## Slice 2 — GAP 5: Persistere la scelta "Incorpora foto" in localStorage

**File:** `app/src/components/ExportPanel.jsx`

**Problema:** Lo stato `embedPhotos` (checkbox "Incorpora foto nel documento") è in `useState` locale e si resetta ad ogni navigazione. Un utente che lavora sempre senza foto deve rifarlo ogni volta.

**Cosa fare:**
1. Sostituire lo `useState(null)` con un hook personalizzato che persiste in `localStorage`:
   - Chiave localStorage: `'sgq:export_embed_photos'`  
   - Valore: `'true'` | `'false'` | `null` (non impostato = auto)
   - Al primo montaggio legge da localStorage; al cambio scrive.
2. Usare questo schema:
   ```js
   const [embedPhotos, setEmbedPhotosRaw] = useState(() => {
     const stored = localStorage.getItem('sgq:export_embed_photos');
     if (stored === 'true') return true;
     if (stored === 'false') return false;
     return null; // auto
   });
   const setEmbedPhotos = (val) => {
     setEmbedPhotosRaw(val);
     if (val === null) localStorage.removeItem('sgq:export_embed_photos');
     else localStorage.setItem('sgq:export_embed_photos', String(val));
   };
   ```
3. Il comportamento del pulsante "ripristina auto" rimane invariato (chiama `setEmbedPhotos(null)`).

**Test:** `npm run test:run` — tutti verdi.

---

## Slice 3 — GAP 4: Validazione campi critici pre-export con avviso non bloccante

**File:** `app/src/components/ExportPanel.jsx`

**Problema:** L'export Word viene generato senza verificare se i campi obbligatori del template sono valorizzati. Campi come `auditObject`, `scope`, `conclusioni` finiscono con `-` o `N/D` nel documento senza che l'utente lo sappia.

**Cosa fare:**
1. Aggiungere una funzione `getIncompleteFieldWarnings(audit)` che controlla i campi critici:
   ```js
   function getIncompleteFieldWarnings(audit) {
     const warnings = [];
     const meta = audit?.metadata || {};
     const gd = meta?.generalData || {};
     const obj = meta?.auditObjective || {};
     const outcome = meta?.auditOutcome || {};
     if (!gd.auditObject?.trim()) warnings.push('Oggetto dell\'audit (sezione "Dati generali")');
     if (!gd.scope?.trim())        warnings.push('Scopo / Ambito (sezione "Dati generali")');
     if (!obj.description?.trim()) warnings.push('Obiettivo dell\'audit (sezione "Obiettivo")');
     if (!outcome.conclusions?.trim() && !Object.values(outcome.byStandard || {}).some(s => s?.conclusions?.trim()))
       warnings.push('Conclusioni (sezione "Esito")');
     return warnings;
   }
   ```
2. In `handleExportWord` (prima di chiamare `prepareAuditForExport`), se `warnings.length > 0`:
   - Mostrare un warning non bloccante con `showMessage(...)` di tipo `"warning"`:
     ```
     ⚠️ Campi incompleti nel report: [lista]. Il documento verrà generato con valori "N/D".
   - Aggiungere `"warning"` come tipo di notifica nel CSS di `ExportPanel.css` (colore giallo/arancione):
     ```css
     .export-notification.warning { background: #FEF3C7; color: #92400E; border: 1px solid #F59E0B; }
     ```
   - NON bloccare l'export: è solo un avviso informativo.
3. Fare lo stesso in `handleExportToFileSystem`.

**Test:** `npm run test:run` — tutti verdi.

---

## Slice 4 — GAP 2: Deprecare / nascondere ReportBuilder (componente orfano)

**File:** `app/src/components/ReportBuilder.jsx` e ovunque sia usato

**Problema:** `ReportBuilder.jsx` permette di aggiungere "capitoli" all'audit, ma questi non vengono mai inclusi nell'export Word (`buildTemplateData` non legge `reportChapters`). Il componente è un vicolo cieco.

**Cosa fare:**
1. Verificare dove `ReportBuilder` è importato/usato con `rg "ReportBuilder" app/src/`.
2. Se è montato in una tab/pagina:
   - Aggiungere un banner informativo in cima al componente:
     ```jsx
     <div className="report-builder-notice" style={{background:'#FEF3C7',color:'#92400E',padding:'0.75rem 1rem',borderRadius:'0.375rem',marginBottom:'1rem',border:'1px solid #F59E0B'}}>
       ⚠️ Questa sezione è in sviluppo. I capitoli inseriti qui non sono ancora inclusi nel Report Word.
     </div>
     ```
   - Non rimuovere il componente (potrebbe essere usato in futuro).
3. Aggiungere un commento in testa al file:
   ```js
   // STATO: componente in sviluppo — i reportChapters non sono ancora letti da wordExport.js.
   // Quando si integra: aggiungere i capitoli a buildTemplateData() in wordExport.js.
   ```

**Test:** `npm run test:run` — tutti verdi.

---

## Sequenza di lavoro

1. `git pull origin main` (attendere merge P0 o lavorare su `cursor/fix-report-reaudit-p0-3bea`)
2. `git checkout -b cursor/fix-report-p1-3bea`
3. Eseguire Slice 1 → commit atomico `fix: GAP3 — rimuovi console.log debug da ExportPanel`
4. Eseguire Slice 2 → commit atomico `fix: GAP5 — embedPhotos persiste in localStorage`
5. Eseguire Slice 3 → commit atomico `fix: GAP4 — avviso non bloccante campi incompleti pre-export`
6. Eseguire Slice 4 → commit atomico `fix: GAP2 — banner sviluppo su ReportBuilder orfano`
7. Aprire PR su `main`, titolo: `fix: GAP P1 report — console.log, embedPhotos, pre-export warnings, ReportBuilder`
8. Chiudere con: `TEST OK` (802 test verdi) o `FIX NON APPLICABILI` con motivazione

---

## Definizione di completamento (DoD)

- `npm run test:run` — 802 test verdi (nessun test nuovo richiesto per queste slice)
- `npm run build` — build Vite senza errori
- Nessun `console.log` con `[EXPORT]` rimasto in `ExportPanel.jsx`
- `localStorage.getItem('sgq:export_embed_photos')` persiste tra navigazioni
- Export Word mostra warning giallo se `auditObject` o `scope` vuoti
- `ReportBuilder.jsx` mostra banner "in sviluppo"
