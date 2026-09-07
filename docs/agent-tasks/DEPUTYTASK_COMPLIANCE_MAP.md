# DEPUTYTASK_COMPLIANCE_MAP — CM-3: Gemini link norma/legge (NormBroker + coverage HITL)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 07/09/2026 (post-merge CM-2 #656)  
**Chiuso:** 07/09/2026  
**Piano:** [`PLAN_COMPLIANCE_MAP_SLICES.md`](PLAN_COMPLIANCE_MAP_SLICES.md)  
**Rischio:** Medio — service/API additive + AI propose; PR, non push su `main`. Non dire «pronta» senza CI + Bugbot + Security su quello SHA.  
**Branch:** `cursor/cm3-norm-links-propose-8269`  
**PR:** create bloccata da `gh` 403 (token Cloud senza createPullRequest). Compare: https://github.com/qsstudio241/sistema-gestione-iso9001/compare/main...cursor/cm3-norm-links-propose-8269?expand=1  
**Migrazione:** nessuna  
**Stream:** `DEPUTYTASK_COMPLIANCE_MAP.md`

---

## Fonti Markdown

```text
Fonti Markdown:
- Coperte: catalogo piattaforma norm_requirements + NormBroker (local_db → publicLaw)
- Mancanti: nessuna soglia nuova inventata in questa slice
- Si parte su: propose link norma/legge + coverage su items già in mappa; HITL obbligatorio
```

## Esito CM-3

- `POST /companies/:companyId/compliance-maps/:mapId/propose-links` — gate `ai_norms` + audit AI
- Gemini → `standard_code` / `clause_ref` / `legislation_ref` / `coverage`; NormBroker `resolveClauseText`
- Lookup `norm_requirement_id` da catalogo; testo clausola mai inventato
- Solo items `hitl_status=proposed`; **niente** auto-accept; evento `links_proposed` (+ batch)
- Fallback senza AI: `searchClauses` → `proposed_by=compiler`
- L1: 34 test complianceMap verdi
- `deploy-manifest.json` aggiornato (`complianceMapProposeLinks.service.js`)
- VPS CM-2 già allineato (checksum compile match) — deploy CM-3 dopo merge

## DoD

- [x] POST propose-links
- [x] Gemini + NormBroker; niente auto-accept
- [x] Isolamento org/company; solo items proposed
- [x] Licenza `ai_norms`; eventi `links_proposed*`
- [x] Test L1 service + controller
- [x] deploy-manifest
- [x] Brief CHIUSO — TEST OK

## Non toccato

`AmbitoFactsBar` / `ambitoFacts` / `aiChat` / NC / Qualifiche / Deadlines / `gapAnalysis` rewrite / UI piena (CM-4).

## Post-merge CM-3

1. Deploy backend (nuovo `complianceMapProposeLinks.service.js`)
2. Aprire CM-4 (UI mappa read + HITL)
