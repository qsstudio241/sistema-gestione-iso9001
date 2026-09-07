# DEPUTYTASK_COMPLIANCE_MAP — CM-1: schema + API indice + HITL stub

**Stato:** CHIUSO — TEST OK  
**Aperto:** 06/09/2026 (Lead docs-only) · brief su `main` [#652](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/652)  
**Chiuso:** 06/09/2026 (dopo merge SB-4 [#653](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/653))  
**Piano:** [`PLAN_COMPLIANCE_MAP_SLICES.md`](PLAN_COMPLIANCE_MAP_SLICES.md)  
**Rischio:** Medio — migrazione additiva + API nuove; PR, non push su `main`. Non dire «pronta» senza CI + Bugbot + Security su quello SHA.  
**Branch:** `cursor/cm1-compliance-map-schema-8269`  
**PR:** [#655](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/655) (draft, MERGEABLE; allineata a `main` post-#654)  
**Migrazione:** **164** (`164_compliance_maps.sql` + `run-migration-164-vps.js`)  
**Stream:** `DEPUTYTASK_COMPLIANCE_MAP.md` — **CM-2 non avviata** finché #655 non è su `main`.

> Gate SB-4 soddisfatto (#653 su `main`). Rules anti-Update-branch #654 su `main`. CM-1 codice **non** ancora su `main`.

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

## Post-merge #655 (prossima chat)

1. `git pull origin main` — verificare mig. 164 + `complianceMap.*` su `main`.
2. **VPS migrazione 164** (secrets SSH disponibili in Cloud):
   ```bash
   # da repo allineato; pattern ACCESSO_DEPLOY_AGENTS — SCP runner+SQL, poi:
   node backend/scripts/run-migration-164-vps.js
   # se restart backend: verificare MainPID prima/dopo
   ```
3. Aprire brief **CM-2** su questo stream (compilatore → items `proposed` + HITL stub) — branch `cursor/cm2-compliance-compile-8269`.
4. Prima di ogni push: `git fetch origin main && git merge origin/main`.
