# DEPUTYTASK_COMPLIANCE_MAP — CM-5: export + citazioni Assistente

**Stato:** CHIUSO — TEST OK  
**Aperto:** 07/09/2026 (post-merge CM-4 #658)  
**Chiuso:** 07/09/2026  
**Piano:** [`PLAN_COMPLIANCE_MAP_SLICES.md`](PLAN_COMPLIANCE_MAP_SLICES.md)  
**Rischio:** Medio — BE chat injection + export API + FE; PR, non push su `main`. Non dire «pronta» senza CI + Bugbot + Security su quello SHA.  
**Branch:** `cursor/cm5-export-chat-citations-8269`  
**PR:** (compare se create 403)  
**Migrazione:** nessuna  
**Stream:** `DEPUTYTASK_COMPLIANCE_MAP.md`

---

## Contesto

CM-1…CM-4 in `main` (#655–#658). UI HITL OK; VPS health 200 (CM-4 solo FE).  
Slice CM-5: blocco prompt da mappa `approved` (HITL `accepted|edited`) + citazioni Assistente + export JSON/MD.

## Fonti Markdown

```text
Fonti Markdown:
- Coperte: nessuna soglia nuova
- Mancanti: —
- Si parte su: prompt/citazioni/export HITL-safe
```

## Esito CM-5

- Service `complianceMapChat.service.js`: load approved + format prompt + citations + export
- `aiChat`: inject blocco mappa (solo companyId) + merge citazioni `compliance_map_item`
- GET `…/compliance-maps/:mapId/export?format=json|markdown` — solo accepted|edited
- UI: pulsante **Esporta JSON** (disabled + title se prerequisiti mancanti); deep link `?select=&highlight=`
- FE path citazioni → `/compliance-maps?select=&highlight=`
- deploy-manifest: nuovo service

## DoD

- [x] System prompt: mappa approved + solo HITL confermati (non NC live / non proposed)
- [x] Citazioni `compliance_map_item` con node_id / clausola
- [x] Export multi-tenant JSON|MD solo confermati
- [x] UI Esporta visibile, gated
- [x] Test BE (26) + FE (13) + build OK
- [x] Brief CHIUSO — TEST OK; piano CM-5 ✅; epic chiusa in roadmap

## Non toccato

auth / sync / migrazioni / AmbitoFactsBar rewrite / NC / Qualifiche / Deadlines / gapAnalysis rewrite.

## Post-merge CM-4

1. #658 in main — `ComplianceMapsPage` + route `/compliance-maps`
2. Health VPS 200 — nessun deploy BE per CM-4
3. **Post-merge CM-5:** deploy VPS BE obbligatorio (`complianceMapChat.service.js` + aiChat + export route)
