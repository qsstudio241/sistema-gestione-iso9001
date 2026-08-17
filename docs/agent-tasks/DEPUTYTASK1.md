# DEPUTYTASK1 — ISO-3: chiavi certificato EN 10204 nel prompt capitolato

**Stato:** CHIUSO  
**Aperto:** 16/08/2026 (dopo merge MC-0 [PR #447](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/447))  
**Chiuso:** 16/08/2026  
**Piano:** [`PLAN_3834_SLICES.md`](PLAN_3834_SLICES.md)  
**Rischio:** Medio — PR + gate Bugbot; **non** push su `main`  
**Spec chiavi:** [`MATERIAL-COMPLIANCE-NORME-SINTESI.md`](../reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md)

---

## Slice

Prompt + `field_key` su estrazione capitolato. **Niente nuova tabella** (mig. 116 già c’è). Base **e** apporto (`material_role`, `filler_designation`).

### File

- `backend/src/data/capitolatoMaterialKeys.js` (+ test)
- `backend/src/services/caseTextAnalysis.service.js` (+ test)
- `backend/src/services/aiContextBuilder.service.js` (+ test)
- `backend/src/controllers/contractReview.controller.js` (merge norme dal testo + persist `field_key`)
- `backend/scripts/deploy-manifest.json`

### Cosa NON toccare

- `docs/agent-tasks/DEPUTYTASK.md` (SAL S1a)
- Migrazioni DB / `import-norms-from-markdown.js`
- UI `ContractReviewPage` (i JSON restano gli stessi campi, più `field_key` opzionale)

---

## Esito

- Elenco chiavi canoniche nel prompt (tipo 2.1–3.2, ruolo base/filler, designazione acciaio e filo).
- `identified_standards`: se il testo cita EN 10204 / 10168 / ISO 10474 / 404 / 6929 / EN 10025-2 / ISO 14341, le norme si aggiungono anche se l’AI le omette.
- Alias `MTC` / `filo` → chiavi canoniche in `parseRequirements`.
- Persistenza: `field_key` se presente, altrimenti `ref` (REQ-01) come prima.

`DEPUTYTASK.md` (SAL S1a) non toccato. Prossima 3834: **ISO-4** (Word RDP, serve il file Mason). Prossima MC: **MC-1** migration.
