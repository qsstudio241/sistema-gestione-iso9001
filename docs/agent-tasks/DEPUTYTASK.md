# DEPUTYTASK — Mason feature: seconda parte + foto Word
> Sessione: 23 aprile 2026 | Lead: agente principale | Deputy: questo agente

---

## Contesto
Leggi `PROJECT_CONTEXT.md` (root), poi `docs/PROJECT_ROADMAP.md` sezione Mason (Scenario 4), poi `docs/GUIDA_CONSOLIDATA.md`.
Sei il deputy: implementi task circoscritti e ben definiti senza prendere decisioni architetturali.
Chiudi con commit+push e scrivi `TASK CHIUSO` o `FIX NON APPLICABILE` con motivazione.

---

## Task A — Fornitore seconda parte: dropdown da anagrafica

### Problema
In `app/src/components/AuditSelector.jsx`, quando l'utente seleziona `auditPartyType === "second_party"`,
appare un campo testo libero per `fornitoreName`. Mason chiede di poter selezionare il fornitore
dall'elenco delle aziende in anagrafica (stesso pattern del dropdown "Azienda committente" già presente).

### Soluzione da implementare

**File**: `app/src/components/AuditSelector.jsx`

Sostituisci il blocco alle righe 616-630 (il campo testo `fornitoreName` sotto il radio seconda parte):

```jsx
{formData.auditPartyType === "second_party" && (
  <div className="form-group">
    <label htmlFor="fornitoreName">Fornitore auditato</label>
    <input type="text" id="fornitoreName" name="fornitoreName" ... />
    <small>Azienda fornitore oggetto dell'audit (seconda parte).</small>
  </div>
)}
```

Con questo pattern (identico al dropdown `companyId` già presente nel form, righe 537-584):

```jsx
{formData.auditPartyType === "second_party" && (
  <div className="form-group">
    <label htmlFor="fornitoreSelect">Fornitore auditato</label>
    {companies.length > 0 ? (
      <>
        <select
          id="fornitoreSelect"
          value={
            formData.fornitoreCompanyId
              ? String(formData.fornitoreCompanyId)
              : (formData.fornitoreName && !formData.fornitoreCompanyId ? MANUAL_COMPANY_VALUE : "")
          }
          onChange={(e) => {
            const val = e.target.value;
            if (val === MANUAL_COMPANY_VALUE) {
              setFormData(p => ({ ...p, fornitoreCompanyId: null }));
            } else if (val === "") {
              setFormData(p => ({ ...p, fornitoreCompanyId: null, fornitoreName: "" }));
            } else {
              const found = companies.find(c => String(c.id) === val);
              setFormData(p => ({
                ...p,
                fornitoreCompanyId: found ? found.id : null,
                fornitoreName: found ? found.name : p.fornitoreName,
              }));
            }
          }}
          className="form-control"
          disabled={companiesLoading}
        >
          <option value="">— Seleziona fornitore —</option>
          <option value={MANUAL_COMPANY_VALUE}>— Inserimento manuale —</option>
          {companies.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{c.vat_number ? ` (P.IVA ${c.vat_number})` : ""}
            </option>
          ))}
        </select>
        {/* Campo testo manuale: visibile solo se "Inserimento manuale" selezionato */}
        {(!formData.fornitoreCompanyId && formData.fornitoreName !== undefined) &&
          (formData.fornitoreName || !companies.find(c => String(c.id) === String(formData.fornitoreCompanyId))) && (
          <input
            type="text"
            id="fornitoreName"
            name="fornitoreName"
            value={formData.fornitoreName || ""}
            onChange={handleChange}
            className="form-control"
            placeholder="es. Fornitore XYZ Srl"
            style={{ marginTop: "0.5rem" }}
          />
        )}
        <small className="form-hint">Scegli dall&apos;anagrafica o inserisci manualmente.</small>
      </>
    ) : (
      <>
        <input
          type="text"
          id="fornitoreName"
          name="fornitoreName"
          value={formData.fornitoreName || ""}
          onChange={handleChange}
          className="form-control"
          placeholder="es. Fornitore XYZ Srl"
        />
        <small className="form-hint">Azienda fornitore oggetto dell&apos;audit (seconda parte).</small>
      </>
    )}
  </div>
)}
```

### Cosa aggiungere al formData initialState (cerca `formData` e `useState` nel form)
Aggiungi `fornitoreCompanyId: null` all'oggetto formData iniziale.

### Cosa passare a createAudit
Nella chiamata `onCreate(...)` (cerca `handleCreate` o `onSubmit` nel form),
aggiungi `fornitoreCompanyId: formData.fornitoreCompanyId` al payload metadata.

### Cosa salvare in auditDataModel
Nel file `app/src/data/auditDataModel.js`, nella funzione `createNewAudit`, aggiungi:
```javascript
fornitoreCompanyId: metadata.fornitoreCompanyId ?? null,
```
accanto a `fornitoreName`.

### Compatibilità Word export
`fornitoreName` (stringa) è già usato nel template. Nessuna modifica a `wordExport.js`.
Quando l'utente seleziona dal dropdown, `fornitoreName` viene popolato con `company.name`.
Il campo manuale testuale rimane per retrocompatibilità.

### Test L1
Aggiungi un test in `app/src/tests/` (o aggiungi a `auditDataModel.createNewAudit.test.js`):
```javascript
test('createNewAudit con fornitoreCompanyId → preservato in metadata', () => {
  const audit = createNewAudit({
    auditPartyType: 'second_party',
    fornitoreName: 'Acme Srl',
    fornitoreCompanyId: 42,
    clientName: 'Committente SpA',
    auditNumber: '2026-TEST',
  });
  expect(audit.metadata.fornitoreCompanyId).toBe(42);
  expect(audit.metadata.fornitoreName).toBe('Acme Srl');
});
```

---

## Task B — Foto embedded Word: verifica bug OOXML e stato checkbox UI

### Problema
La roadmap segnala "Foto embedded in Word (pic:cNvPr id duplicati → doc corrotto) 🔲 Backlog tecnico".
Il codice sembra avere già la fix (`imgId = 100 + imageRegistry.length` incrementale).
Bisogna verificare se il bug è risolto o se persiste in edge case.

### Indagine da fare

1. **Leggi** `app/src/utils/wordExportHelpers.js` — funzione `xmlImageOoxml` e tutti i punti
   dove viene chiamata (cerca `xmlImageOoxml`). Traccia tutti i punti dove viene assegnato `imgId`.
   Verifica che `imgId` sia univoco per TUTTI gli embedding nel documento:
   - Allegati checklist ISO (buildChecklist section)
   - Allegati checklist custom (buildCustomChecklist section)  
   - Logo azienda (`injectCompanyLogoInZip`) — usa un rId separato? Quale id `pic:cNvPr`?
   - Logo organizzazione (`injectOrganizationLogoInZip`) — idem

2. **Verifica**: il `imageRegistry` è lo stesso array condiviso tra tutte le sezioni?
   Oppure ogni sezione crea il proprio array? Se separati → possibili id duplicati.

3. **Leggi** `app/src/utils/wordExport.js` — funzione `embedImagesInZip` e `injectOoxmlMarkers`.
   Verifica che gli `rId` nel `document.xml.rels` siano coerenti con i `rId` nel `document.xml`.

4. **Se trovi il bug**: correggi garantendo id univoci a livello di documento (es. contatore globale
   partendo da `200` per i logo, `300+imgIdx` per gli allegati, o passa il registry ai logo).

5. **Se il bug è già risolto**: aggiorna la roadmap rimuovendo la nota "🔲 Backlog tecnico"
   su "Foto embedded in Word" e mettendo ✅ con data.

6. **Verifica UI**: il checkbox "Incorpora foto" è visibile in `ExportPanel.jsx`?
   - Leggi righe 560-600 circa
   - Il toggle deve essere visibile per audit con allegati immagine
   - Se è nascosto o manca, rendilo sempre visibile (non solo per RDP_MSN) con nota "auto per ISO 3834"

### Test L1 da scrivere/aggiornare
Aggiungi in `app/src/tests/wordExport.placeholders.test.js` un test che verifica
che tutti gli `imgId` nel documento OOXML generato siano univoci:
```javascript
test('foto embedded: imgId univoci nel documento OOXML', async () => {
  // usa generateWordBlob con photoMode: 'preview' e audit con >1 allegato immagine
  // verifica che nel XML risultante non ci siano id duplicati su pic:cNvPr
});
```
Se il test è difficile da scrivere (richiede ZIP parse), documenta come "da fare in L3 manuale".

---

## Regole operative deputy

- Diff minimo: non toccare file non elencati
- Test L1 dopo ogni modifica (`npm run test:run` da `app/`)
- Commit separato per Task A e Task B
- Push su `main` al termine
- Scrivi `TASK CHIUSO` nel commit message o come messaggio finale
- Se un task richiede decisioni architetturali → segnala nel commit message senza implementare
