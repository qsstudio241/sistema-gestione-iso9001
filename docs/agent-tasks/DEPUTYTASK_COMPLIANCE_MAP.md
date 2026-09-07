# DEPUTYTASK_COMPLIANCE_MAP — CM-2: compilatore caso → items proposed (HITL)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 07/09/2026 (post-merge CM-1 #655)  
**Chiuso:** 07/09/2026  
**Piano:** [`PLAN_COMPLIANCE_MAP_SLICES.md`](PLAN_COMPLIANCE_MAP_SLICES.md)  
**Rischio:** Medio — service/API additive + AI propose; PR, non push su `main`. Non dire «pronta» senza CI + Bugbot + Security su quello SHA.  
**Branch:** `cursor/cm2-compliance-compile-8269`  
**PR:** create bloccata da `gh` 403 (token Cloud senza createPullRequest). Compare: https://github.com/qsstudio241/sistema-gestione-iso9001/compare/main...cursor/cm2-compliance-compile-8269?expand=1  
**Migrazione:** nessuna (usa 164 già su VPS)  
**Stream:** `DEPUTYTASK_COMPLIANCE_MAP.md`

---

## Esito CM-2

- `POST /companies/:companyId/compliance-maps/compile` — mappa draft da `commercial_case_id`
- Gemini via `aiProviderAdapter` → items `hitl_status=proposed` (`proposed_by=gemini`); fallback seed `compiler` se AI assente
- **Niente** auto-confirm (HITL obbligatorio)
- Scope `organization_id` + `company_id` su caso ed estratti
- Evento `compile_proposed`
- L1: 24 test complianceMap verdi
- `deploy-manifest.json` + VPS mig 164 già applicata (PROD+TEST) + deploy CM-1

## DoD

- [x] POST compile → mappa draft + items `proposed`
- [x] Gemini via `aiProviderAdapter`; niente auto-accept
- [x] Isolamento org/company
- [x] Evento `compile_proposed`
- [x] Test L1 service + controller
- [x] deploy-manifest
- [x] Brief CHIUSO — TEST OK

## Non toccato

`AmbitoFactsBar` / `ambitoFacts` / `aiChat` / NC / Qualifiche / Deadlines / `gapAnalysis` rewrite / NormBroker cascata / UI piena (CM-4).

## Post-merge CM-2

1. Deploy backend (nuovo `complianceMapCompile.service.js`)
2. Aprire CM-3 (link norma/legge NormBroker) o CM-4 UI
