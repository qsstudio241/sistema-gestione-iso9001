# DEPUTYTASK — Material Compliance MC-5 (UI)

**Stato:** CHIUSO — mergiata [#457](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/457); router dettaglio [#461](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/461)  
**Aperto:** 18/08/2026 (dopo merge MC-4 #456)  
**Chiuso:** 18/08/2026  
**Prossima ingest:** [`DEPUTYTASK_MC_INGEST.md`](DEPUTYTASK_MC_INGEST.md) (MC-I0)  
**Piano:** [`PLAN_MATERIAL_COMPLIANCE_SLICES.md`](PLAN_MATERIAL_COMPLIANCE_SLICES.md) § MC-5  
**Spec:** [`MATERIAL_COMPLIANCE_UI.md`](../specs/MATERIAL_COMPLIANCE_UI.md)  
**Rischio:** Medio — UI additiva, nessuna migrazione; PR + gate Bugbot; Cloud **non** mergia  
**Ambiente:** TEST. Non toccate 149/151/152.  
**Non toccare:** [`DEPUTYTASK.md`](DEPUTYTASK.md) (SAL S1a)

---

## Fonti Markdown

```text
Fonti Markdown:
- Coperte: EN 10204 (tipo documento), dizionario campi MC
- Si parte su: elenco Qualifiche-like + dettaglio HITL; skip editor KB
```

## Scope

- Menu Saldatura → **Materiali** (`/saldatura/materiali`)
- Card KPI esito + ruolo (niente tendine duplicate)
- `SgqDataGrid`, upload PDF gated su Ambito azienda
- Dettaglio: PDF / testo / checks / HITL (approva solo con click)
- Gate `LicensedRoute` + `ModuleLocked` (AND `saldatura`+`ai_import`)
- `AiDisclaimer` sotto il testo estratto

Fuori scope: MC-6 chiave licenza dedicata, MC-B OCR, dashboard KPI, Welding Book.
