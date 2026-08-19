# DEPUTYTASK — Material Compliance ingest (MC-I1)

**Stato:** APERTO  
**Aperto:** 19/08/2026 (Lead wayfinder — Chart the map, track ingest)  
**Piano:** [`PLAN_MATERIAL_COMPLIANCE_SLICES.md`](PLAN_MATERIAL_COMPLIANCE_SLICES.md) § MC-I1  
**Spec:** [`MATERIAL_COMPLIANCE_UI.md`](../specs/MATERIAL_COMPLIANCE_UI.md) · API già accetta `base|filler`  
**Rischio:** Basso — solo UI upload + test pagina; API e schema invariati; Cloud **non** mergia  
**Ambiente:** FE Netlify dopo merge. Record ADA produzione 3–5 / azienda 179 = prova già fatta, non riscoprire.  
**Stream:** stesso file epic ingest (MC-I0 CHIUSO su main). Non riusare per un altro modulo.

---

## Fonti Markdown

```text
Fonti Markdown:
- Coperte: EN 10204 (tipo documento), DATA_MODEL material_role base|filler, UI MC elenco unico
- Si parte su: scelta ruolo in upload; skip OCR, skip split PDF, skip soglie apporto, skip few-shot
```

## Slice unica di questa sessione: MC-I1 — Ruolo Base / Apporto in upload

**Obiettivo**: in Materiali, prima di **Carica certificato**, si sceglie **Base** o **Apporto**. Un 3.1 filo non resta sempre Base in griglia.

Oggi `MaterialCertificatesPage` chiama `createMaterialCertificate({ materialRole: "base" })` sempre. L’API accetta già `base|filler` (`apiService` appende `material_role`).

### DoD

1. Header: scelta visibile Base / Apporto (default **Base**), distinta dai filtri KPI della griglia
2. Upload con Apporto → `createMaterialCertificate` riceve `materialRole: "filler"`
3. Clic sul filtro KPI «Apporto» **non** cambia il ruolo dell’upload
4. Senza azienda in Ambito: **Carica certificato** resta visibile e `disabled` (azioni gated)
5. Test L1 in `materialCertificatesPage.test.jsx`; `NODE_ENV=test npm run test:run` sul file + `npm run build`
6. Nessun commit di segreti; Bugbot a slice chiusa

### File previsti (disgiunti)

- `app/src/pages/MaterialCertificatesPage.jsx`
- `app/src/pages/MaterialCertificatesPage.css` (minimo, se serve)
- `app/src/tests/materialCertificatesPage.test.jsx`
- `docs/agent-tasks/DEPUTYTASK_MC_INGEST.md` (questo brief)
- `docs/agent-tasks/PLAN_MATERIAL_COMPLIANCE_SLICES.md` (stesso epic)
- `docs/PROJECT_ROADMAP.md` § Stato attuale + `docs/GUIDA_CONSOLIDATA.md` (chat sola: nessun altro brief APERTO)

### Cosa NON toccare

- [`DEPUTYTASK.md`](DEPUTYTASK.md) (SAL S1a **CHIUSO**, scontrino: non sovrascrivere)
- `documentTextExtractor.service.js` / `ocrExtractor.js` (MC-B)
- PLAN 3834 / ISO-4 / Welding Book
- Slice successive: MC-B, MC-I2…I4, MC-7 (`recordFeedback`), MC-6
- Backend (`materialCertificates.controller.js`) — l’API accetta già il ruolo
- Soglie apporto / Rule Engine / migrazioni SQL

### Test

```bash
cd app && NODE_ENV=test npx vitest run src/tests/materialCertificatesPage.test.jsx
cd app && npm run build
```

Dopo merge Netlify: in Materiali, Ambito azienda, scegli Apporto → Carica PDF → colonna Ruolo = Apporto.

### Comando per il deputy

`Leggi docs/agent-tasks/DEPUTYTASK_MC_INGEST.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`
