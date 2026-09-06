# DEPUTYTASK_COMPLIANCE_MAP — CM-1: schema + API indice + HITL stub

**Stato:** APERTO — gate SB-4 (sessione 06/09: **FIX NON APPLICABILI** codice)  
**Aperto:** 06/09/2026 (Lead docs-only) · brief su `main` via [#652](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/652)  
**Piano:** [`PLAN_COMPLIANCE_MAP_SLICES.md`](PLAN_COMPLIANCE_MAP_SLICES.md)  
**Rischio:** Medio — migrazione additiva + API nuove; PR, non push su `main`. Non dire «pronta» senza CI + Bugbot + Security su quello SHA.  
**Branch codice (prossima sessione):** `cursor/cm1-compliance-map-schema-8269` da `main` **dopo merge SB-4**  
**Stream:** `DEPUTYTASK_COMPLIANCE_MAP.md` — epic Compliance Map; non riusare per altro modulo.  
**Gate SB-4:** [#653](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/653) ready for review (allineata a `main` post-#652). **NON toccare** `AmbitoFactsBar`, `aiChat`, `ambitoFacts.service`, pagine NC / Qualifiche / Deadlines.

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK_COMPLIANCE_MAP.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`  
> Eseguire **solo se** su `origin/main` questo file ha **Stato: APERTO** e titolo CM-1.  
> **Gate dipendenza:** se SB-4 non è ancora su `main` → **FIX NON APPLICABILI** (non iniziare codice CM).

### Esito sessione «mergiato» (06/09/2026)

- Mergiato su `main`: **#652** (questo brief + piano). **Non** mergiato: SB-4 (**#653**).
- Codice CM-1 **non** avviato (gate). Hub sync: roadmap § Stato + 1 riga GUIDA (questa PR docs).
- Prossima mossa dopo click merge su #653: branch `cursor/cm1-compliance-map-schema-8269` → DoD sotto.
- **Bussola** `PROJECT_CONTEXT.md`: oggi a tetto 80 path — aggiungere riga Compliance Map **in CM-1** quando esistono `complianceMap.service.js` / routes (non ora).

---

## Perché

Tradurre il metodo LLM-Wiki (pagine collegate requisito↔fonte↔gap) in **tabelle multi-tenant**, non in vault Obsidian. Valore: analisi requisiti ISO §8.2 con citazioni NormaBroker + evidenze registro + HITL (§7.5), riusabile da orchestratore e UI.

## Cosa esiste già (verificato)

- `normBroker.service.js` — `getClauseText` / cascata local_db  
- `norm_requirements` — catalogo piattaforma (senza tenant)  
- SAL: `requirement_implementation_status` + `gapAnalysis.service.js` (pattern stato×evidenza, dominio SGQ)  
- Contract Review: `commercial_cases`, `contractReview.*`, `caseDocumentAnalysis.service.js`, `extractedRequirementsProfile.js`  
- Libreria: `NormLibraryPage.jsx`, `library_source_requests`  
- Second Brain: fatti Ambito SQL — **non** mescolare nella mappa

Dettaglio tabella: piano § «Esiste già».

## Slice unica di questa sessione codice: CM-1

### Obiettivo (minimo affidabile)

Schema SQL + API REST indice/dettaglio + stub HITL su item. **Niente** UI piena, **niente** chiamata Gemini compile, **niente** seed da NC live.

### File previsti (codice — solo dopo SB-4)

- `database/migrations/NNN_compliance_maps.sql` + `backend/scripts/run-migration-NNN-vps.js` (`NNN` = prossimo libero su `origin/main` al momento; oggi coda ≥ 164)  
- `backend/src/services/complianceMap.service.js` (+ test)  
- `backend/src/controllers/complianceMap.controller.js` (+ test)  
- `backend/src/routes/complianceMap.routes.js`  
- wire in router app esistente + riga in `backend/scripts/deploy-manifest.json`  
- **opz. minimo:** nessuna pagina React in CM-1 (UI = CM-4)

### File da NON toccare

- `app/src/components/AmbitoFactsBar*` / `ambitoFacts*` / `aiChat*`  
- `app/src/pages/NCPage.jsx`, `QualificationsPage.jsx`, `DeadlinesPage.jsx`  
- `gapAnalysis.service.js` (SAL) — solo lettura pattern, no rewrite  
- `norm_requirements` seed / NormBroker cascata (no breaking)  
- `docs/GUIDA_CONSOLIDATA.md` / roadmap § Stato se c’è ancora parallelo — bozza lezione sotto; sync dopo merge

### API minime (bozza contratto)

| Metodo | Path | Note |
|--------|------|------|
| GET | `/api/v1/companies/:companyId/compliance-maps` | lista mappe; scope `organization_id` da JWT + `company_id` |
| GET | `/api/v1/companies/:companyId/compliance-maps/:mapId` | header + items |
| POST | `/api/v1/companies/:companyId/compliance-maps` | crea `draft` (manual/empty); body title + opz. `commercial_case_id` |
| PATCH | `/api/v1/companies/:companyId/compliance-maps/:mapId/items/:itemId/hitl` | body `{ hitl_status, coverage?, gap_note?, norm_requirement_id? }` → event log |
| POST | `/api/v1/companies/:companyId/compliance-maps/:mapId/items` | item manuale (stub compilatore) |

Tutte le query: `WHERE organization_id = @org AND company_id = @company`. Vietato cross-tenant. Licenza: riuso modulo già usato da Contract Review / `ai_norms` solo se si espone suggest — in CM-1 basta auth+RBAC esistente (stesso gate delle API company-scoped).

### Modello dati

Vedi piano § «Modello dati minimo». Tre tabelle: `compliance_maps`, `compliance_map_items`, `compliance_map_events`.

### DoD CM-1

- [ ] Migrazione idempotente applicabile su VPS (pattern `run-migration-*-vps.js`)  
- [ ] GET lista + GET dettaglio + POST mappa + PATCH HITL + POST item → L1 Jest verdi  
- [ ] Test isolamento: org A non vede mappe org B; company 1 ≠ company 2 stessa org  
- [ ] Ogni mutazione HITL scrive riga in `compliance_map_events`  
- [ ] `deploy-manifest.json` aggiornato  
- [ ] Brief → **CHIUSO — TEST OK** + PR; Cloud non mergia  
- [ ] Nessuna modifica ai file SB-4 elencati sopra  

### Gate test / multi-tenant / audit

| Gate | Criterio |
|------|----------|
| L1 BE | service + controller test (happy + 403/404 cross-scope) |
| Multi-tenant | assert SQL params org+company su ogni path |
| Audit | event `map_created` / `item_created` / `hitl_*` con `actor_user_id` |
| Deploy | manifest + health post-deploy se si deploya BE |

## Cosa NON fare

- Obsidian / LLM Wiki file-based / Engram GPU  
- Importare snapshot NC/qualifiche/scadenze come nodi mappa  
- Duplicare `requirement_implementation_status` (SAL) o sostituire stati `commercial_cases`  
- Compilazione Gemini automatica in CM-1  
- Dichiarare PR «pronta» dopo sola CI  

## Bozza lezione GUIDA (5 righe — sync hub dopo merge se parallelo)

```text
Compliance Map ≠ SAL gap ≠ Second Brain.
- Mappa = grafo requisito commessa/capitolato scoped org+company, versionato, HITL.
- SAL = maturità SGQ su clausole ISO per azienda.
- Second Brain = fatti operativi live (conteggi) fuori dal prompt lungo.
- Catalogo norme resta piattaforma (norm_requirements); i link stanno negli items della mappa.
```

## Handoff (se sessione codice interrotta)

Copiare blocco da [`HANDOFF_TEMPLATE.md`](HANDOFF_TEMPLATE.md); Stato resta APERTO.
