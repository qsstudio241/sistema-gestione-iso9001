# DEPUTYTASK_COPERTURA — COV-4: ponte commessa (`getCoverage` + Riesame) sul registry `welder_9606`

**Stato:** CHIUSO — TEST OK (06/10/2026, PR draft `cursor/cov-4-ponte-commessa-7169`)  
**Aperto:** 06/10/2026  
**Piano:** [`PLAN_COPERTURA_SCALABILE_SLICES.md`](PLAN_COPERTURA_SCALABILE_SLICES.md) § COV-4  
**Dipende da:** COV-1 CHIUSO (PR #702) · COV-2 CHIUSO (PR #704) · COV-3 CHIUSO (PR #706) — tutte su `main`  
**Rischio:** **Medio** se la parità è dimostrata dal test differenziale (BE refactor interno, contratto HTTP invariato, nessuna migrazione, nessun auth/sync/schema). **Diventa Alto** (stop + conferma committente) se per ottenere la parità serve cambiare l'esito del semaforo su dati reali — vedi § Condizione di stop.  
**Stream:** `DEPUTYTASK_COPERTURA.md` (epic copertura; COV-5 riusa questo file solo dopo che COV-4 è CHIUSO e la riga titolo/file è aggiornata)  
**Branch suggerito:** `cursor/cov-4-welder-bridge-<suffisso>`

**Scontrino COV-3 (CHIUSO, PR #706):** adapter `cnd_9712` pieno (`maturity: full`: metodo, livello, settore, schema, tecnica, idoneità visiva via `visionStateForPerson`); toccati `cnd9712.adapter.js` (+ test nuovo), `ndtInspectorGate.service.js` (solo export), piano, roadmap. HITL settori industriali 9712 e codici metodo `AT/LT/ST/TT` ancora aperti (non toccano COV-4). Pattern da copiare: aggregazione fail → `no_match`, dato mancante → `partial`, adapter con funzione pura `match…Capability` testabile senza DB.

---

## Obiettivo (una slice = un risultato verificabile)

`GET /qualifications/coverage?project_id=` (Progetti → «Copertura») e `GET /cases/:caseId/extracted-coverage?project_id=` (Riesame; alimenta anche lo snapshot `capability-gap-report`) oggi **duplicano** la logica WPS ↔ saldatori (~100 righe quasi identiche: SELECT qualifiche, filtro operativo, `computeQualificationCoverage` per WPS, semaforo `verde/giallo/rosso`). COV-4 le fa passare dallo **stesso ponte** che delega al dominio `welder_9606` del registry (`matchWelderCapability`), lasciando **identico il contratto di risposta** e i chiamanti FE. Risultato verificabile: test differenziale vecchio-algoritmo vs ponte su una matrice di fixture = payload `coverage[]` / `summary` / `qualifiers[].coverage_detail` invariati.

## Decisione di unificazione (risolve «Se/come unificare GET `/qualifications/coverage` col nuovo motore»)

**Scelta: delega interna con contratto invariato (opzione B), NON sostituzione di endpoint e NON nuova forma di risposta.**

Evidenze dal codice reale:

- `getCoverage` (`qualifications.controller.js`, ~r. 410-545) e `computeCaseProjectCoverage` (`caseExtractedCoverage.service.js`, r. 79-245) hanno la stessa pipeline; l'unica differenza voluta è `mergeWpsWithExtractedProfile(...)` (requisiti estratti dai documenti sovrascrivono/integrano la WPS) e `advisory`/`extracted_profile` in più nel Riesame.
- Consumatori FE: `ProjectsPage.jsx` (modale copertura: `has_wps`, `summary.covered/uncovered/total`, `coverage[].esito`, `qualifiers[].semaforo`) e `ContractReviewPage.jsx` (r. 289-290: `getCaseExtractedCoverage` se c'è caso, altrimenti `getQualificationsCoverage`). `caseCapabilityGapReport.service.js` consuma `coverage.summary` e `coverage[].{wps_id,wps_code,welding_process,esito,qualified_count}`. **Nessun FE legge `coverage_detail`**, ma lo si mantiene per contratto. → cambiare la forma = rompere 2 pagine + snapshot persistiti (`capability-gap-report` JSON): **no**.
- Il registry fotografa il requisito **per criteri** (`verifyCoverage({domain, criteria})` → `matches[]`), la commessa lo fotografa **per WPS** (un requisito = una riga WPS, esito aggregato). I due livelli sono diversi: l'unificazione sensata è **a livello di funzione di match** (`matchWelderCapability`), non di endpoint.
- Il motore **non è ancora equivalente** al vecchio algoritmo (verificato leggendo `welder9606.adapter.js` vs `qualificationCoverage.js`). Delega cieca = regressione silenziosa su una verifica ISO 3834:

| # | Dimensione | Legacy (`computeQualificationCoverage`) | Registry `welder_9606` oggi | Azione COV-4 |
|---|-----------|------------------------------------------|-----------------------------|--------------|
| 1 | **Gruppo materiale** | `checkMaterialGroup(qual.material_group, wps.base_material_group)` | **assente** (nessun campo requisito) | Aggiungere criterio **opzionale** `material_group` all'adapter (additivo, `checkMaterialGroup` esistente); assente = nessun vincolo → COV-1 invariato |
| 2 | Qualifica **senza** `welding_process` | `checkProcess` → `false` → `excluded` | `unverifiable` → `partial` | Il ponte mantiene il comportamento legacy (`no_match`): zero delta; la scelta «dato mancante = partial» è una decisione separata (vedi «Non ancora specificato») |
| 3 | Fonte processo | solo `qual.welding_process` | `welding_processes_validity` ∥ fallback `welding_process` (mig. 168) | Il ponte **non** seleziona `welding_processes_validity`: la fonte resta `welding_process` (zero delta). Passare alla colonna di validità = cambia i semafori (rosso→verde su certificati 9606 con validità estesa) → **decisione committente**, fuori COV-4 |
| 4 | Forma `coverage_detail` | `{process, thickness, material_group, position, overall: ok\|partial\|excluded}` | `{operational, process, thickness, positions, …}` + `status match\|partial\|no_match` | Il ponte **ricostruisce** la forma legacy (`positions`→`position`, `match→ok`, `no_match→excluded`, `skipped`→`ok` sulle dimensioni non vincolanti) |
| 5 | Filtro tipo qualifica | `getCoverage`: `%9606% OR %14732%`; Riesame: **solo** `%9606%` | `%9606% OR %14732%` | Loader unico = quello di `getCoverage` (vedi drift sotto) |
| 6 | `thickness_max_unlimited` | `getCoverage` lo seleziona; **Riesame no** (bug) → range aperto dichiarato diventa `unverifiable` | selezionato | Loader unico lo seleziona |
| 7 | Semaforo qualificatore | `getCoverage`: `semaforo()` (soglie `DAYS_URGENT/WARNING`, `grigio` se sospesa); Riesame: `semaforoExpiry()` (soglia 90 gg) | n/a | **Non unificare** (cambierebbe i colori in UI): ciascun chiamante mantiene il suo; il ponte restituisce solo i match |

**Drift 5-6 (Riesame ≠ Progetti sulla stessa commessa):** oggi lo stesso progetto può dare semafori diversi nelle due schermate. COV-4 allinea il Riesame al loader di `getCoverage` (fonte unica). È un cambio di esito **dichiarato** (Riesame diventa più completo: include ISO 14732, riconosce il range spessore aperto): va scritto nel body PR e coperto da un test dedicato. Se il committente preferisce lasciare il Riesame sul filtro solo `%9606%`, il loader accetta un parametro `qualificationTypes` e il default del Riesame resta quello attuale (decisione in § HITL, non bloccante: si parte con l'allineamento).

**Alternative scartate:** (A) sostituire `GET /qualifications/coverage` con `POST /verify` per WPS → breaking per 2 pagine e snapshot; (C) lasciare tutto com'è → due copie di logica che divergono (r. 5-6 sono già divergenze reali) e COV-5 senza base comune.

### Condizione di stop (rischio Alto)

Se il test differenziale mostra **qualunque** differenza di `esito` (verde/giallo/rosso), `qualified_count` o `coverage_detail` che non sia nella lista «delta dichiarati» (solo righe 5-6 per il Riesame), **non cablare** i due chiamanti: consegnare la parte additiva (adapter `material_group` + ponte + test differenziale che documenta il delta) e scrivere handoff al committente. Compliance 3834 con impatto sui semafori non si cambia in autonomia ([`sgq-git-autonomy.mdc`](../../.cursor/rules/sgq-git-autonomy.mdc) § Alto).

## Gate norme (dichiarato)

Slice **non** norm-touching nel senso del gate: nessun requisito, soglia, checklist o clausola nuova; nessun campo UI/API legato a una norma nuovo (il criterio `material_group` riusa `checkMaterialGroup` già in produzione, ISO 9606-1 gruppi di materiale, già implementato). Dichiarazione:

- **Coperte:** ISO 9606-1 / 3834-2 §8.2 nella forma già implementata in `qualificationCoverage.js` (processo, spessore, gruppo materiale, posizioni).
- **Mancanti:** nessun PDF necessario; HITL aperti (settori industriali 9712, codici metodo 9712:2021) **non** toccati.
- **Si parte su:** parità con l'algoritmo esistente. Nessuna regola normativa nuova o modificata.

## Checklist dato ↔ norma ↔ UI ↔ API

| Dato | Clausola / fonte | UI | API / persistenza |
|------|------------------|----|-------------------|
| `material_group` (criterio opzionale adapter `welder_9606`) | ISO 9606-1 gruppi materiale (logica `checkMaterialGroup` già esistente); `qualifications.material_group` (esistente) | `CoverageVerifyPanel` lo mostra da solo (campo dinamico da `requirementFields`, nessun JSX nuovo; Vitest `coverageVerifyPanel` da rieseguire) | `POST /qualifications/coverage/verify` (campo criteria opzionale, retrocompatibile) |
| WPS → criteri (`welding_process`, `thickness_range_min/max`, `base_material_group`, `welding_positions`) | invariato (colonne `welding_procedures`) | modale Progetti + tabella Riesame (invariati) | `GET /qualifications/coverage`, `GET /cases/:id/extracted-coverage` (risposta **invariata**) |
| `coverage_detail` / `esito` / `summary` | invariato | invariato | invariato (golden test) |

Nessuna nuova colonna. Nessun campo AI-estraibile nuovo.

## Cosa fare

1. **Adapter** `welder9606.adapter.js`: aggiungere `material_group` a `REQUIREMENT_FIELDS` (text, opzionale) e alla `matchWelderCapability` via `checkMaterialGroup` (import da `qualificationCoverage`, già nel file). Criterio assente → nessun vincolo (`ok`/`skipped` come le altre dimensioni opzionali). Aggiungere `material_group` al `summarizeQual`. **Nessun** altro cambio di comportamento: i test COV-1 in `coverageEngine.service.test.js` restano verdi senza ritocchi.
2. **Ponte** nuovo `backend/src/services/capabilityCoverage/wpsWelderCoverage.js` (puro, senza DB), esportato da `index.js` se serve ai servizi:
   - `wpsToWelderCriteria(wps)` → `{welding_process, thickness_min_mm: thickness_range_min, thickness_max_mm: thickness_range_max, material_group: base_material_group, positions: welding_positions}`;
   - `computeWpsWelderCoverage(wps, qualRows, { todayIso })` → `{ qualifiers: [{ q, detail }], esito }` dove `detail` ha la **forma legacy** (riga 4 tabella) e i `no_match` sono scartati come oggi (`overall === 'excluded'`); applica il comportamento legacy della riga 2 (qualifica senza `welding_process` → esclusa) **nel ponte**, non nell'adapter; `esito` via `computeWpsCoverageEsito` (riuso, non riscrivere).
3. **Loader unico** delle qualifiche saldatori della commessa (stessa SELECT di `getCoverage`: `%9606% OR %14732%`, `thickness_max_unlimited`, `company_id` commessa, `status NOT IN ('revocata','sospesa')`, filtro `isQualificationOperationallyActive`) in `wpsWelderCoverage.js` o helper accanto (iniettando `pool`/`query`), usato da entrambi i chiamanti. Niente `welding_processes_validity` nella SELECT (riga 3).
4. **Cablaggio chiamanti** (solo dopo test differenziale verde):
   - `qualifications.controller.js` → `getCoverage`: sostituire il blocco «Carica qualifiche… + `rows = wpsRows.map…`» con loader + `computeWpsWelderCoverage`; **identico** il resto (404, `has_wps:false`, `summary`, `semaforo()` locale per qualificatore).
   - `caseExtractedCoverage.service.js` → `computeCaseProjectCoverage`: idem, mantenendo `mergeWpsWithExtractedProfile`, `enriched_from_documents`, `advisory`, `semaforoExpiry` locale.
   - **Non** cambiare firma o campi di risposta; `caseCapabilityGapReport.service.js` resta intatto.
5. **Test L1 Jest** (DB mockato come `caseExtractedCoverage.loadRequirements.test.js` / `wpqrProcedure.adapter.test.js`):
   - `wpsWelderCoverage.test.js` (nuovo): **differenziale** — su una matrice di fixture (processo ok/ko/assente, spessore ok/fuori/aperto con e senza `thickness_max_unlimited`/dato mancante, gruppo materiale ok/ko/mancante, posizioni ok/ko/mancanti, qualifica scaduta/conferma scaduta, WPS con campi nulli non vincolanti) confrontare `computeQualificationCoverage`+`computeWpsCoverageEsito` (oracolo, **non rimosso**) con il ponte: stesso `esito`, stesso `qualified_count`, `coverage_detail` deep-equal;
   - adapter: `material_group` ok / mismatch (`no_match`) / qualifica senza gruppo (`partial`) / criterio assente (nessun effetto: i casi COV-1 invariati);
   - payload `getCoverage` e `computeCaseProjectCoverage` con DB mockato: stesse chiavi e stessi valori di prima (snapshot/golden costruito **prima** del refactor e committato con il test);
   - Riesame: test dedicato dei delta dichiarati (riga 5-6): qualifica `14732` e range spessore aperto ora considerati.
6. **Backlog/Doc:** piano (DoD COV-4 spuntato, riga «Brief attivo»), questo brief (esito), una riga in `PROJECT_ROADMAP.md` § Stato attuale solo se non ci sono altri `DEPUTYTASK*` APERTI. `deploy-manifest.json`: **aggiungere** `src/services/capabilityCoverage/wpsWelderCoverage.js` (nuovo `.js` runtime; i test restano fuori).
7. **Rielaborazioni (Registro):** **esenzione dichiarata** — nessun campo AI-estraibile aggiunto (`material_group` è già colonna `qualifications` e campo dello schema ingest `documentTypeSchemas.js`; il criterio qui è un requisito di verifica, non un campo estratto). Nessuna voce in `REPROCESSABLE_FIELD_REGISTRY`.

## HITL / decisioni aperte (non bloccanti per COV-4)

- **Riesame: allineare a Progetti (default, si parte così)** includendo ISO 14732 e `thickness_max_unlimited`, oppure mantenere il filtro `%9606%` solo per il Riesame? Dichiarare nel body PR; se il committente non risponde si applica l'allineamento (più completo e coerente con Progetti; il range spessore aperto conta solo se dichiarato dal certificato).
- **Fonte processo = `welding_processes_validity`** (ISO 9606-1: processo di validità ≠ processo di prova) per il semaforo commessa: cambia l'esito (decisione committente, dato che impatta la verifica 3834). Slice successiva dopo risposta; non in COV-4.
- **Qualifica senza processo = `partial` invece di esclusa**: allineamento alla filosofia «dato mancante = da verificare» del resto del motore; cambia l'esito → stessa decisione.

## File previsti (codice)

- `backend/src/services/capabilityCoverage/adapters/welder9606.adapter.js` (solo criterio `material_group`)
- `backend/src/services/capabilityCoverage/wpsWelderCoverage.js` (**nuovo**, ponte + loader) e `…/wpsWelderCoverage.test.js` (**nuovo**)
- `backend/src/services/capabilityCoverage/index.js` (solo export del ponte, se necessario)
- `backend/src/controllers/qualifications.controller.js` (**solo** corpo di `getCoverage`)
- `backend/src/services/caseExtractedCoverage.service.js` (**solo** `computeCaseProjectCoverage`: blocco qualifiche + righe copertura)
- Test: `backend/src/services/capabilityCoverage/coverageEngine.service.test.js` (solo se serve aggiungere casi `material_group`; i casi COV-1 non si toccano), nuovo test payload `getCoverage`/`computeCaseProjectCoverage` (nome a scelta del deputy, accanto a `caseExtractedCoverage.loadRequirements.test.js`)
- `backend/scripts/deploy-manifest.json` (una riga per il nuovo `.js`)
- Solo lettura/riuso: `backend/src/utils/qualificationCoverage.js` (oracolo + `checkMaterialGroup`/`computeWpsCoverageEsito`), `backend/src/services/weldingCoordinatorAuth.service.js` (`isQualificationOperationallyActive`), `backend/src/utils/extractedRequirementsProfile.js`
- FE: **nessuna modifica prevista**; Vitest `coverageVerifyPanel` da rieseguire (campo dinamico nuovo)
- Doc: `docs/agent-tasks/PLAN_COPERTURA_SCALABILE_SLICES.md`, questo brief, `docs/PROJECT_ROADMAP.md` (una riga)

## Cosa NON toccare

- **Endpoint e contratto HTTP**: path, metodi, chiavi di `GET /qualifications/coverage` e `GET /cases/:id/extracted-coverage`; `apiService.js`; `ProjectsPage.jsx`, `ContractReviewPage.jsx` (COV-5 per la UI multi-dominio)
- `qualificationCoverage.js` (logica e test esistenti restano: servono da oracolo)
- `caseCoverageAdvisory.service.js` (advisory WPQR multi-giunto / visione: estensione ai domini `wpqr_procedure`/`cnd_9712` = slice successiva), `caseCapabilityGapReport.service.js`, snapshot `capability-gap-report`
- Semafori per qualificatore (`semaforo`, `semaforoExpiry`): non unificare
- Adapter `wpqrProcedure`, `cnd9712`; `coverageEngine.service.js`, `coverageTypes.js`, `coverageRegistry.js`, `registerDefaultAdapters.js` (nessun cambio di contratto)
- `qualifications.routes.js`, auth.middleware, JWT, `syncService`; ingest `cert_ndt`, `reprocessableFields.js`, `QualificationForm.jsx`
- **Migrazioni SQL: nessuna** (né colonne nuove, né applicazione di migrazioni sul VPS)
- Fuori scope: **COV-5** (UI fattibilità multi-dominio in Projects/Riesame)

## Disgiunzione da altri brief

Su `origin/main` **nessun** `DEPUTYTASK*` è APERTO eccetto questo (verificato 06/10/2026: `DEPUTYTASK_AI_CHECKLIST.md` è «IN REVIEW», file diversi — AI checklist; tutti gli altri CHIUSO). PR aperte: nessuna (`gh pr list --state open` vuoto, 06/10/2026), salvo la PR docs di questo brief (solo `docs/agent-tasks/`). Nessuna sovrapposizione con `capabilityCoverage/`, `qualifications.controller.js` o `caseExtractedCoverage.service.js`.

## DoD

- [x] `welder_9606` accetta `material_group` opzionale; i test COV-1 passano senza ritocchi
- [x] Ponte `wpsWelderCoverage.js` + loader unico qualifiche saldatori
- [x] Test differenziale ponte ↔ `computeQualificationCoverage` verde su tutta la matrice (stesso `esito`, `qualified_count`, `coverage_detail`)
- [x] `getCoverage` e `computeCaseProjectCoverage` delegano al ponte; payload di risposta invariato (golden test)
- [x] Delta Riesame (ISO 14732 + `thickness_max_unlimited`) dichiarato e coperto da test; nel body PR
- [x] `GET /qualifications/coverage/domains` e `POST …/verify` non regrediti
- [x] Jest mirato verde: `cd backend && npx jest src/services/capabilityCoverage src/services/caseExtractedCoverage src/services/caseCapabilityGapReport src/utils/qualificationCoverage`
- [x] `cd app && NODE_ENV=test npm run test:run -- coverageVerifyPanel` verde (campo dinamico) + `npm run build`
- [x] `node backend/scripts/check-harness-boot.js`, `node backend/scripts/check-utf8-encoding.js`, check deploy-manifest OK
- [x] Esenzione Rielaborazioni dichiarata nel body PR (nessun campo AI nuovo); nessuna migrazione
- [x] Branch allineato a `origin/main` prima di push/PR; `bugbot run` **una sola volta** a slice chiusa (codice BE: Bugbot + Security Review letti prima di «pronta»)

## Esito (06/10/2026) — TEST OK

**Parità dimostrata, nessuna condizione di stop.** Il test differenziale (`wpsWelderCoverage.test.js`: 320 WPS × 360 qualifiche, ogni coppia + pool aggregati, ~115k confronti) non mostra **alcuna** differenza di `esito`, `qualified_count` o `coverage_detail` rispetto a `computeQualificationCoverage` + `computeWpsCoverageEsito`. Delta di semaforo osservati: **zero** sul perimetro Progetti (`getCoverage`); l'unico cambio di esito è il delta dichiarato del Riesame (righe 5-6: ISO 14732 e `thickness_max_unlimited` ora nel loader).

Scelte implementative da conoscere (nessuna cambia l'esito):

- **Processo nel ponte = `checkProcess` legacy**, non il matcher token-based dell'adapter (`checkProcessValidity`). Verificato: l'adapter è più permissivo (es. qualifica `135 111` vs WPS `135, 111`: adapter `ok`, legacy `excluded`). Delegarlo avrebbe cambiato i semafori → il ponte non passa `welding_process` all'adapter e applica `checkProcess` (qualifica senza processo = esclusa). Il test lo documenta.
- `material_group` aggiunto all'adapter come criterio opzionale; gruppo/spessore/posizioni/operatività delegati a `matchWelderCapability`, forma `coverage_detail` legacy ricostruita nel ponte.
- Loader unico `loadWelderQualificationsForProject` (SELECT di `getCoverage`: 9606 + 14732, `thickness_max_unlimited`, senza `welding_processes_validity`), usato da `getCoverage` e da `computeCaseProjectCoverage`. `query(sql, params)` iniettata (il controller adatta il `pool`).
- Golden payload (`qualifications.controller.getCoverage.test.js`, `caseExtractedCoverage.coverage.test.js`) committati **prima** del cablaggio e rimasti verdi dopo.
- Il test sui delta Riesame verifica la SELECT (14732 + `thickness_max_unlimited`) e gli esiti `verde` su range aperto / operatore 14732.

**File toccati:** `welder9606.adapter.js` (+ casi in `coverageEngine.service.test.js`), `wpsWelderCoverage.js` + `.test.js` (nuovi), `qualifications.controller.js` (solo `getCoverage` + import), `caseExtractedCoverage.service.js` (solo `computeCaseProjectCoverage`), `qualifications.controller.getCoverage.test.js` e `caseExtractedCoverage.coverage.test.js` (nuovi), `deploy-manifest.json`, piano, roadmap, questo brief. FE, `apiService`, `qualificationCoverage.js`, `caseCoverageAdvisory`, `caseCapabilityGapReport`, migrazioni: **non toccati**. Rielaborazioni: esenzione dichiarata (nessun campo AI nuovo).

**Test:** Jest mirato (`capabilityCoverage`, `caseExtractedCoverage`, `caseCapabilityGapReport`, `caseCoverageAdvisory`, `qualificationCoverage`, `controllers/qualifications`) 12 suite / 200 test verdi; `coverageVerifyPanel` 4/4 + `npm run build` OK; `check-harness-boot` + `check-utf8-encoding` OK. Suite Jest completa: stesse 9 suite rosse di `origin/main` (preesistenti, config DB/`process.exit`), nessuna nuova.

**HITL ancora aperti (invariati, non toccati):** fonte processo = `welding_processes_validity`; qualifica senza processo = `partial`; semafori per qualificatore Progetti ≠ Riesame. Prossima: COV-5 (riuso dello stream solo dopo aggiornamento titolo/file list).

## Comando di avvio

`Leggi docs/agent-tasks/DEPUTYTASK_COPERTURA.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Handoff

_(vuoto — compilare dal template [`HANDOFF_TEMPLATE.md`](HANDOFF_TEMPLATE.md) solo se la slice non si chiude)_
