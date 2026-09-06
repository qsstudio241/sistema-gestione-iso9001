# DEPUTYTASK_COMPLIANCE_MAP — CM-1: schema + API indice + HITL stub

**Stato:** CHIUSO — TEST OK  
**Aperto:** 06/09/2026 (Lead docs-only) · brief su `main` [#652](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/652)  
**Chiuso:** 06/09/2026 (dopo merge SB-4 [#653](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/653))  
**Piano:** [`PLAN_COMPLIANCE_MAP_SLICES.md`](PLAN_COMPLIANCE_MAP_SLICES.md)  
**Rischio:** Medio — migrazione additiva + API nuove; PR, non push su `main`. Non dire «pronta» senza CI + Bugbot + Security su quello SHA.  
**Branch:** `cursor/cm1-compliance-map-schema-8269`  
**PR:** draft — `gh` create 403; compare https://github.com/qsstudio241/sistema-gestione-iso9001/compare/main...cursor/cm1-compliance-map-schema-8269?expand=1  
**Migrazione:** **164** (`164_compliance_maps.sql` + `run-migration-164-vps.js`)  
**Stream:** `DEPUTYTASK_COMPLIANCE_MAP.md` — prossima slice **CM-2** (compilatore da caso) o **CM-3** (Gemini link).

> Gate SB-4 soddisfatto (#653 su `main`).

---

## Esito CM-1

- Tabelle `compliance_maps` / `compliance_map_items` / `compliance_map_events` (idempotenti)
- API: GET lista, GET dettaglio, POST mappa, POST item, PATCH HITL — scope `organization_id` + `company_id`
- Event log su create/HITL; niente Gemini compile; niente UI
- Test L1 service + controller (isolamento multi-tenant)
- `deploy-manifest.json` + wire `server.js`
- Hub: roadmap § Stato + lezione GUIDA; bussola aggiornata (swap path)

## DoD

- [x] Migrazione idempotente + runner VPS  
- [x] GET/POST/PATCH L1 Jest  
- [x] Isolamento org/company  
- [x] Eventi HITL  
- [x] deploy-manifest  
- [x] Brief CHIUSO — TEST OK  

## Non toccato

`AmbitoFactsBar` / `ambitoFacts` / `aiChat` / NC / Qualifiche / Deadlines / `gapAnalysis` rewrite / NormBroker cascata.
