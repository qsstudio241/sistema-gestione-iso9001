# DEPUTYTASK_COMPLIANCE_MAP — CM-4: UI mappa read + HITL

**Stato:** CHIUSO — TEST OK  
**Aperto:** 07/09/2026 (post-merge CM-3 #657 + deploy VPS)  
**Chiuso:** 07/09/2026  
**Piano:** [`PLAN_COMPLIANCE_MAP_SLICES.md`](PLAN_COMPLIANCE_MAP_SLICES.md)  
**Rischio:** Medio — UI + apiService; PR, non push su `main`. Non dire «pronta» senza CI + Bugbot + Security su quello SHA.  
**Branch:** `cursor/cm4-compliance-hitl-ui-8269`  
**Migrazione:** nessuna  
**Stream:** `DEPUTYTASK_COMPLIANCE_MAP.md`

---

## Contesto

CM-1…CM-3 in `main` (#655–#657). API list/detail/HITL/compile/propose-links attive sul VPS.  
Questa slice: **UI** lista mappe + items, Accetta/Rifiuta (niente auto-confirm), trigger compile e propose-links con gate Ambito `company_id`.

## Fonti Markdown

```text
Fonti Markdown:
- Coperte: nessuna soglia nuova; UI su API già in repo
- Mancanti: —
- Si parte su: pagina HITL DNA SGQ (schermata 2 + dettaglio)
```

## Esito CM-4

- Pagina `/compliance-maps` (licenza `ai_norms`) + voce sidebar
- Lista mappe + items (`SgqDataGrid`), KPI HITL cliccabili, Ambito `company_id`
- Accetta / Rifiuta solo su `proposed` + mappa mutabile; pulsanti sempre visibili con `disabled` + `title`
- Trigger **Compila da caso** + **Propone link norma** (gate prerequisiti)
- `AiDisclaimer`; apiService metodi compliance-maps
- L1: 8 test FE verdi + build

## DoD

- [x] Lista mappe scoped `company_id` (Ambito); senza Ambito pulsanti visibili `disabled` + `title`
- [x] Dettaglio items + Accetta / Rifiuta solo su `proposed` (niente auto-confirm)
- [x] Trigger compile (caso commerciale) e propose-links se mappa mutabile + prerequisiti
- [x] `AiDisclaimer` dove c’è azione AI
- [x] Test FE L1 + build
- [x] Brief CHIUSO — TEST OK

## Non toccato

`AmbitoFactsBar` / `ambitoFacts` / `aiChat` / NC / Qualifiche / Deadlines / `gapAnalysis` rewrite / auth / sync / migrazioni / CM-5 export chat.

## Post-merge CM-3 (fatto in questa sessione)

1. Deploy VPS CM-3 — MainPID 79480→93969, health 200, checksum propose-links allineato
2. CM-4 UI (questa PR)
