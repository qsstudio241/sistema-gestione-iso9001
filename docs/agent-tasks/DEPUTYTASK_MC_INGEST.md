# DEPUTYTASK — Material Compliance ingest (MC-I1)

**Stato:** CHIUSO — TEST OK (19/08/2026, [PR #473](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/473))  
**Aperto:** 19/08/2026 (Lead wayfinder — Chart the map, track ingest)  
**Chiuso:** 19/08/2026 — L1 5/5 `materialCertificatesPage.test.jsx` + `npm run build`  
**Piano:** [`PLAN_MATERIAL_COMPLIANCE_SLICES.md`](PLAN_MATERIAL_COMPLIANCE_SLICES.md) § MC-I1  
**Spec:** [`MATERIAL_COMPLIANCE_UI.md`](../specs/MATERIAL_COMPLIANCE_UI.md) · API già accetta `base|filler`  
**Rischio:** Basso — solo UI upload + test pagina; API e schema invariati; Cloud **non** mergia  
**Ambiente:** FE Netlify dopo merge. Record ADA produzione 3–5 / azienda 179 = prova già fatta, non riscoprire.  
**Stream:** stesso file epic ingest (MC-I0 CHIUSO). Non riusare per un altro modulo.

---

## Fonti Markdown

```text
Fonti Markdown:
- Coperte: EN 10204 (tipo documento), DATA_MODEL material_role base|filler, UI MC elenco unico
- Si parte su: scelta ruolo in upload; skip OCR, skip split PDF, skip soglie apporto, skip few-shot
```

## Slice unica di questa sessione: MC-I1 — Ruolo Base / Apporto in upload

**Obiettivo**: in Materiali, prima di **Carica certificato**, si sceglie **Base** o **Apporto**. Un 3.1 filo non resta sempre Base in griglia.

### Fatto

- Header: radiogroup **Ruolo** Base / Apporto (default Base), classi già in `QualificationsPage.css`
- Upload Apporto → `createMaterialCertificate({ materialRole: "filler" })`
- Filtro KPI «Apporto» non cambia il ruolo dell’upload (test L1)
- Senza azienda: **Carica certificato** visibile e `disabled`

### File toccati

- `app/src/pages/MaterialCertificatesPage.jsx`
- `app/src/tests/materialCertificatesPage.test.jsx`
- `docs/agent-tasks/DEPUTYTASK_MC_INGEST.md`
- `docs/agent-tasks/PLAN_MATERIAL_COMPLIANCE_SLICES.md`
- `docs/PROJECT_ROADMAP.md` § Stato attuale
- `docs/GUIDA_CONSOLIDATA.md` (1 riga lezione)

### Cosa NON è stato toccato

- [`DEPUTYTASK.md`](DEPUTYTASK.md) (scontrino SAL S1a)
- `documentTextExtractor.service.js` / `ocrExtractor.js`
- PLAN 3834 / ISO-4 / Welding Book
- Backend MC, Rule Engine, MC-B / I2–I4 / MC-7 / MC-6

### Test

```bash
cd app && NODE_ENV=test npx vitest run src/tests/materialCertificatesPage.test.jsx
# 5/5
cd app && npm run build
```

Dopo merge Netlify: in Materiali, Ambito azienda, scegli Apporto → Carica PDF → colonna Ruolo = Apporto.

### Prossima slice

**MC-B** — OCR scan, riuso `documentTextExtractor` (S1a già in `main`, [#471](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/471)). Nuovo brief APERTO su questo stream prima del deputy.
