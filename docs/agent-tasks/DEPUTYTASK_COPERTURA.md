# DEPUTYTASK_COPERTURA — COV-5: «Fattibilità multi-dominio» in Progetti e Riesame (FE sull'API verify, nessun endpoint nuovo)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 06/10/2026 · **Chiuso:** 06/10/2026  
**Piano:** [`PLAN_COPERTURA_SCALABILE_SLICES.md`](PLAN_COPERTURA_SCALABILE_SLICES.md) § COV-5  
**Dipende da:** COV-1 (PR #702) · COV-2 (PR #704) · COV-3 (PR #706) · COV-4 (PR #708) — tutte CHIUSE e su `main`  
**Rischio:** **Medio** — solo FE additivo: nessun cambio a BE, contratto HTTP, semafori, auth/sync/schema, nessuna migrazione. **Diventa Alto** (stop + conferma committente) se per far quadrare il blocco serve toccare il semaforo saldatori (`esito`, `semaforo`) o una risposta di `getCoverage` / `extracted-coverage` — vedi § Condizione di stop.  
**Stream:** `DEPUTYTASK_COPERTURA.md` (epic copertura; ultima slice. **Stream chiuso con COV-5**: non riusarlo per un altro epic)  
**Branch suggerito:** `cursor/cov-5-fattibilita-<suffisso>`

**Scontrino COV-4 (CHIUSO, PR #708):** `getCoverage` (Progetti) e `computeCaseProjectCoverage` (Riesame; alimenta anche lo snapshot `capability-gap-report`) delegano al ponte `wpsWelderCoverage.js` su `welder_9606` con loader unico; contratto di risposta **invariato** (test differenziale ~115k confronti, delta semaforo 0 su Progetti; unico delta dichiarato: il Riesame ora include ISO 14732 e `thickness_max_unlimited`). Processo nel ponte = `checkProcess` legacy (non il matcher token-based dell'adapter) per non spostare i semafori. HITL aperti, **non** toccati qui: fonte processo = `welding_processes_validity`; qualifica senza processo = `partial`; semafori per qualificatore Progetti ≠ Riesame.

---

## Obiettivo (una slice = un risultato verificabile)

Oggi Progetti e Riesame mostrano la copertura **solo** come semaforo saldatori ↔ WPS (dominio 9606). I domini `wpqr_procedure` (COV-2) e `cnd_9712` (COV-3) esistono nel registry ma sono raggiungibili solo dal pannello «Verifica copertura» di **Qualifiche**, con requisito digitato a mano. COV-5 aggiunge, **accanto** al semaforo esistente (additivo, non lo sostituisce), un blocco **«Fattibilità multi-dominio»** che:

1. **Procedure (WPQR):** per ogni WPS della commessa (righe già caricate dal semaforo) deriva i criteri e chiama `POST /qualifications/coverage/verify` (`wpqr_procedure`), mostrando esito `Coperto / Parziale / Non coperto`, WPQR migliore e motivi.
2. **Personale CND (9712):** i requisiti CND **non esistono** su WPS né sui requisiti estratti (verificato: `buildTechnicalProfile` e le SELECT WPS non hanno chiavi NDT) → niente derivazione automatica: si riusa `CoverageVerifyPanel` limitato a `cnd_9712`, requisito manuale (metodo/livello/settore/schema/tecnica), ambito = azienda della commessa.
3. **Saldatori (9606):** riga **di sola lettura** che riassume il semaforo già calcolato (`summary.covered/partial/uncovered`), **non** richiama `verify` per `welder_9606` (vedi decisione sotto).

Risultato verificabile: in `ProjectsPage` (modale «Copertura Commessa») e in `ContractReviewPage` (`CoveragePanel`) compare il blocco, i semafori esistenti sono byte-identici a prima, Vitest verde.

## Decisioni di scope (risolvono «Se/come mostrare la fattibilità multi-dominio»)

| # | Scelta | Motivazione (evidenza dal codice) |
|---|--------|-----------------------------------|
| 1 | **Nessun endpoint nuovo**, nessun cambio BE | Le righe `coverage[]` di `GET /qualifications/coverage` e `GET /cases/:id/extracted-coverage` già espongono i requisiti per WPS (`welding_process`, `material_group`, `thickness_range_min/max`, `welding_positions`; nel Riesame già fusi col profilo estratto). `POST /verify` accetta `company_id` + `criteria`. Un aggregato per commessa lato BE duplicherebbe il ponte COV-4 e aprirebbe un secondo contratto: **no**. Se la latenza risulta inaccettabile (N WPS = N chiamate) → handoff, non endpoint al volo. |
| 2 | `welder_9606` **non** ricalcolato via `verify` nel blocco | Dimensione già coperta dal semaforo. Il matcher del registry usa `welding_processes_validity` e il match a token (più permissivo), il semaforo usa `checkProcess` legacy (COV-4, riga 2-3): mostrarli fianco a fianco darebbe due verità sulla stessa dimensione sulla stessa schermata finché l'HITL «fonte processo» è aperto. Regola «una fonte per dimensione». Il Qualifiche panel continua a offrire 9606 via `verify`. |
| 3 | Criteri WPQR da WPS = `welding_process`, `thickness_mm = thickness_range_min`, `thickness_b_mm = thickness_range_max`, `material_group`; **nessun** `joint_type` | `checkThickness` dell'adapter chiama `checkThicknessCoverage(wpqr, a, b)`: con a=min e b=max verifica **entrambi** gli estremi del range WPS (range duali t1/t2 o `thickness_min/max` WPQR). Il tipo giunto non è nelle SELECT di coverage e non si aggiunge (sarebbe toccare il BE): resta non verificato e la colonna «Criteri verificati» lo rende esplicito. |
| 4 | **Mai** chiamare `verify` con `criteria` vuoti | Con tutti i controlli `skipped` l'adapter risponde `match` («Requisito coperto») su ogni WPQR = falso positivo. Se la WPS non ha né processo né spessore né materiale: riga neutra «Requisiti WPS insufficienti per la verifica», senza chiamata. |
| 5 | Ambito `company_id` = azienda della commessa (`p.company_id`; Riesame: progetto selezionato nel `CoveragePanel`) | Stesso perimetro del loader qualifiche di COV-4 (`projectCompanyId`). `null` → «tutta l'organizzazione» (stessa dicitura del panel). |
| 6 | Riesame: l'advisory «Copertura procedure (WPQR) — solo informativo» **resta** | Non si tocca il Riesame esistente (rischio Alto). Il blocco nuovo è etichettato «Registro capacità» e affiancato; le due viste usano le stesse funzioni di copertura (`wpsGenerator`) ma input diversi (giunto da profilo vs requisito per WPS). Possibile divergenza → è una **decisione per il committente** (§ HITL), non si risolve qui. |
| 7 | Verifica **su click** («Verifica procedure»), non automatica | N chiamate per N WPS: costo/latency sotto controllo dell'utente; pulsante sempre visibile (`disabled` + `title` se nessuna WPS / calcolo in corso). Tetto `MAX_WPS_VERIFY = 20` righe con nota «Verificate le prime 20 WPS su N» (batch da 4 in parallelo, `Promise.allSettled`: una riga in errore non blocca le altre). |

### Condizione di stop (rischio Alto)

Se per implementare il blocco serve: modificare `qualifications.controller.js`, `caseExtractedCoverage.service.js`, `wpsWelderCoverage.js`, un adapter, `apiService` (nuovi endpoint), o cambiare l'`esito`/`semaforo` esistente di Progetti/Riesame → **stop**, consegnare solo la parte FE che non li tocca e scrivere handoff al committente ([`sgq-git-autonomy.mdc`](../../.cursor/rules/sgq-git-autonomy.mdc) § Alto).

## Gate norme (dichiarato)

COV-5 **non aggiunge** soglie, clausole né regole: espone in UI esiti che i tre domini già calcolano (COV-2/3/4). Non è norm-touching nel senso del gate (nessun requisito/checklist/Rule Engine/seed nuovo). Dichiarazione:

- **Coperte:** ISO 15614-1/-2 + ISO 14555 (stud) come implementate in `wpqrProcedure.adapter.js`; ISO 15613 solo **etichetta** di base (nessuna soglia: il motivo «verifica manuale sul verbale» passa in UI così com'è); ISO 9712:2021 (`NORMA_00034`) come in `cnd9712.adapter.js`; 9606-1 / 3834-2 §8.2 via semaforo esistente.
- **Mancanti (HITL aperti, **non risolti qui**, vedi [`NORME_MANCANTI_BACKLOG.md`](../reference/NORME_MANCANTI_BACKLOG.md)):** ISO 9712 Annex A.3 scope settori industriali (`m` `s` `r` `a`: industriale→prodotto resta `partial` con il motivo del motore) · ISO 9712 Table 1 codici metodo (`AT` `LT` `ST` `TT` vs `AE` `TT` `ST` `LT`: il select CND mostra i 6 metodi VT PT MT UT RT ET come da adapter) · soglie ISO 15613.
- **Si parte su:** solo presentazione dei risultati del motore. La UI **non** reinterpreta né ammorbidisce i motivi (`reasons[]` mostrati verbatim).

## Checklist dato ↔ norma ↔ UI ↔ API

| Dato | Clausola / fonte MD | UI | API / persistenza |
|------|---------------------|----|-------------------|
| Criteri WPQR da WPS (`welding_process`, `thickness_mm`/`thickness_b_mm` da range, `material_group`) | invariata: ISO 15614-1/-2, 14555 come da COV-2 (nessun testo nuovo) | colonna «Criteri verificati» + esito per WPS nel blocco (Progetti, Riesame) | `POST /qualifications/coverage/verify` (domain `wpqr_procedure`); sorgente righe: `GET /qualifications/coverage` / `GET /cases/:id/extracted-coverage` (invariati) |
| Esito `match`/`partial`/`no_match` + `reasons[]` | invariata (COV-2) | badge `sq-tag` + motivo verbatim | risposta `verify` (invariata) |
| Requisito CND manuale (`ndt_method`, `ndt_level`, `ndt_sector`, `certification_scheme`, `scope_detail`) | ISO 9712:2021 come da COV-3; HITL A.3 / Table 1 aperti | `CoverageVerifyPanel` (`embedded`, `allowedDomains=['cnd_9712']`) | `POST …/verify` (domain `cnd_9712`); **nessuna** persistenza |
| Riepilogo saldatori (`summary.covered/partial/uncovered`) | invariata (9606-1, 3834-2 §8.2) | riga read-only nel blocco | già in memoria dal semaforo (nessuna chiamata) |

Nessuna nuova colonna. Nessun campo AI-estraibile nuovo. Nessun valore persistito.

## Cosa fare

1. **CSS riusabile (prerequisito reale).** Le classi `sq-cov-*` e i primitivi usati dal panel (`sq-select`, `sq-search`, `sq-btn-new`, `sq-tag`, `sq-error`) vivono in `QualificationsPage.css`, chunk lazy di Qualifiche: in Progetti/Riesame il panel verrebbe **senza stile**. Creare `app/src/components/CoverageVerifyPanel.css` (importato da `CoverageVerifyPanel.jsx`) e **spostarci** le regole `.sq-cov-*` (righe «Verifica copertura (COV-1)» di `QualificationsPage.css`; rimuoverle da lì, non duplicarle). I primitivi generici non si spostano: nel nuovo CSS ridichiararli **scoped** (`.sq-cov-panel .sq-select`, `.sq-cov-panel .sq-tag`, …) con gli stessi valori, solo per i selettori che il panel usa. Debito dichiarato nel body PR (un futuro `sq-primitives.css` condiviso è fuori scope). Nessun colore nuovo: stessi hex già in uso.
2. **`CoverageVerifyPanel.jsx` — estensione minima e retrocompatibile:** props opzionali `allowedDomains` (whitelist chiavi dominio; assente = tutti, comportamento Qualifiche invariato), `defaultDomain`, `embedded` (corpo sempre visibile, senza toggle). Esportare `COVERAGE_STATUS_LABEL` (oggi `STATUS_LABEL` locale) per riusare badge e testi. **Nessun** cambio al markup di default: i 4 test esistenti restano verdi senza ritocchi.
3. **`app/src/utils/coverageCriteriaFromWps.js` (nuovo, puro):** `wpsRowToWpqrCriteria(row)` → `{ criteria, verified: string[] }` secondo la decisione 3 (valori nulli/vuoti/non numerici omessi; se solo uno dei due estremi di spessore c'è, valorizzare `thickness_mm` con quello; se min = max, non inviare `thickness_b_mm`); `hasUsableCriteria(criteria)`; `bestMatch(matches)` (priorità `match` > `partial` > `no_match`, a parità il primo = già ordinato dal motore); costante `MAX_WPS_VERIFY`.
4. **`app/src/components/CoverageFeasibilityBlock.jsx` (nuovo):** props `{ rows, welderSummary, companyId, companyName }`. Struttura (copia dello schema `sq-cov-panel`/`sq-cov-body`, schermata 2 del DNA; **nessun look nuovo**, nessuna card KPI aggiuntiva):
   - toggle «Fattibilità multi-dominio» (stesso `sq-cov-toggle`); al primo expand `getCoverageDomains()`; le sezioni compaiono **solo per i domini presenti e `implemented`** nel registry (se `getCoverageDomains` fallisce: errore `role="alert"` e blocco WPQR/CND non disponibile, il semaforo sopra non è toccato);
   - **Saldatori (ISO 9606):** riga di sola lettura dal `welderSummary` («Semaforo sopra: X coperte · Y parziali · Z non coperte su N WPS — non ricalcolato qui»);
   - **Procedure (WPQR):** pulsante «Verifica procedure» sempre visibile; tabella per WPS: `WPS` · `Processo` · `Criteri verificati` · `Esito` (badge) · `WPQR` (codice migliore + «N valutate») · `Motivo`;
   - **Personale CND (ISO 9712):** `<CoverageVerifyPanel embedded allowedDomains={["cnd_9712"]} defaultDomain="cnd_9712" companyId companyName />` con hint «I requisiti CND non sono nei documenti/WPS: inserirli a mano».
   - **Stati:** *loading* (pulsante «Calcolo…», `aria-busy`, riuso testo/spinner esistenti, nessuno spinner nuovo); *vuoto* (nessuna WPS → «Nessuna WPS associata alla commessa: nessun requisito da verificare», pulsante `disabled` + `title`; nessuna WPQR → `message` del motore verbatim: «Nessuna WPQR registrata per l'ambito selezionato…»); *errore* per riga («Errore verifica» + messaggio) e globale `sq-error role="alert"`; *dati insufficienti* per WPS (decisione 4); *troncamento* oltre `MAX_WPS_VERIFY`.
   - Reset risultati quando cambiano `rows` (es. altra commessa nel Riesame).
5. **`ProjectsPage.jsx`** (solo `CoverageModal` + il punto che fa `setCoverageProject`): passare `company_id: p.company_id` e `company_name` allo stato; montare il blocco **dopo** la tabella copertura esistente, solo se `data.has_wps` o per mostrare lo stato vuoto (decidere in modo coerente con il test), con `rows={data.coverage}`, `welderSummary={data.summary}`. Tabella/semafori/chip esistenti **invariati**.
6. **`ContractReviewPage.jsx`** (solo `CoveragePanel`): montare il blocco dopo la tabella copertura WPS e **prima** dei box advisory; `companyId` = `company_id` del progetto selezionato in `projects` (già in `getProjects`), `rows={coverage.coverage}`. Advisory WPQR e visione, profilo documenti, semaforo: **invariati**.
7. **Test Vitest L1** (mock di `apiService`, stile `coverageVerifyPanel.test.jsx`):
   - `coverageCriteriaFromWps.test.js`: mappatura (min/max, solo un estremo, min=max, stringhe numeriche, nulli → omessi), `hasUsableCriteria`, `bestMatch`, tetto.
   - `coverageFeasibilityBlock.test.jsx`: sezioni solo per domini implementati; click «Verifica procedure» → una `verifyCoverageRequirement` per WPS con `domain: "wpqr_procedure"`, `company_id` e criteri attesi; badge `Coperto/Parziale/Non coperto` e `reasons` verbatim; **nessuna** chiamata con criteri vuoti (riga «insufficienti»); errore di una WPS non blocca le altre; stato vuoto senza WPS (pulsante visibile, `disabled` + `title`); messaggio motore «Nessuna WPQR…»; riga saldatori letta da `welderSummary` e **zero** chiamate `verify` per `welder_9606`; troncamento oltre 20; reset al cambio `rows`; testi italiani con accenti.
   - `coverageVerifyPanel.test.jsx`: **aggiungere** (non modificare gli esistenti) casi per `allowedDomains` / `defaultDomain` / `embedded`.
   - Rieseguire: `projectsRowActions`, `projectsCompanyScopeClient`, `contractReviewLabels`, `contractReviewPolling`, `routerContext.match` (non regredire).
   - **Regola URL (query ≠ pagina):** il blocco **non** aggiunge link né `navigate`. Se il deputy aggiunge un link (es. a WPQR/Qualifiche) deve usare `?select=`/`?highlight=` con il match solo su `pathnameOnly` in `RouterContext` e rieseguire `routerContext.match.test.js`.
8. **Doc:** `docs/reference/LIBRERIA_UI_SGQ.md` — aggiornare la riga «Verifica copertura» (nuovo `CoverageFeasibilityBlock` + props `allowedDomains`/`embedded`, CSS spostato in `CoverageVerifyPanel.css`); piano (DoD COV-5 spuntato, riga «Brief attivo» → COV-5 CHIUSO, «Non ancora specificato»: righe chiuse/aperte); questo brief (esito); una riga in `PROJECT_ROADMAP.md` § Stato attuale (nessun altro `DEPUTYTASK*` APERTO → stessa PR). `PROJECT_CONTEXT.md`: **non** serve (nessun modulo nuovo: componente dentro la riga «Qualifiche / alert / copertura»; solo se il deputy lo ritiene, aggiungere `CoverageFeasibilityBlock.jsx` a quella riga e far girare `check-harness-boot`).
9. **Rielaborazioni (Registro):** **esenzione dichiarata** — nessun campo AI-estraibile aggiunto, nessuna colonna, nessun valore persistito. Nessuna voce in `REPROCESSABLE_FIELD_REGISTRY`.

## HITL / decisioni aperte (non bloccanti per COV-5)

- **Riesame: advisory WPQR vs blocco «Registro capacità»** — due viste sulla stessa dimensione (WPQR) nella stessa schermata. Default: restano entrambe, il blocco nuovo è etichettato. Se il committente vuole una sola fonte, la slice successiva sostituisce l'advisory WPQR con il registry (cambia un testo del Riesame esistente → conferma esplicita). Dichiarare nel body PR.
- **`welder_9606` via registry nei blocchi** (fianco al semaforo): rinviato finché non si chiude l'HITL COV-4 «fonte processo = `welding_processes_validity`» / «qualifica senza processo = `partial`».
- **Requisiti CND da commessa:** oggi non esiste un dato strutturato (né su WPS né nei requisiti estratti). Derivarli = nuovo campo (ingest/schema → regola Rielaborazioni) → slice separata, decisione committente.
- **Tipo giunto nei criteri WPQR da WPS:** richiede `joint_type` nelle SELECT di coverage (BE, contratto) → fuori da COV-5.
- Restano aperti, non toccati: 9712 Annex A.3 (settori industriali), 9712 Table 1 (codici metodo), soglie 15613.

## File previsti (FE + doc; **nessun file BE**)

- `app/src/components/CoverageFeasibilityBlock.jsx` (**nuovo**)
- `app/src/components/CoverageVerifyPanel.jsx` (solo props `allowedDomains`/`defaultDomain`/`embedded`, export etichette, import CSS)
- `app/src/components/CoverageVerifyPanel.css` (**nuovo**: `.sq-cov-*` spostate + primitivi scoped)
- `app/src/pages/QualificationsPage.css` (**solo** rimozione del blocco «Verifica copertura (COV-1)» spostato; `QualificationsPage.jsx` non cambia)
- `app/src/utils/coverageCriteriaFromWps.js` (**nuovo**, puro)
- `app/src/pages/ProjectsPage.jsx` (solo `CoverageModal`, import, `setCoverageProject`)
- `app/src/pages/ContractReviewPage.jsx` (solo `CoveragePanel`, import)
- Test: `app/src/tests/coverageFeasibilityBlock.test.jsx` (**nuovo**), `app/src/tests/coverageCriteriaFromWps.test.js` (**nuovo**), `app/src/tests/coverageVerifyPanel.test.jsx` (solo casi aggiunti)
- Solo lettura/riuso: `app/src/services/apiService.js` (`getCoverageDomains`, `verifyCoverageRequirement`: **nessuna modifica**), `backend/src/services/capabilityCoverage/**` (adapter, engine, `wpsWelderCoverage.js`), `backend/src/controllers/qualifications.controller.js` (`verifyCoverageRequirement`), `backend/src/services/caseCoverageAdvisory.service.js`, `app/src/design-system/README.md`
- Doc: `docs/agent-tasks/PLAN_COPERTURA_SCALABILE_SLICES.md`, questo brief, `docs/reference/LIBRERIA_UI_SGQ.md`, `docs/PROJECT_ROADMAP.md` (una riga)

## Cosa NON toccare

- **Backend in toto:** `qualifications.controller.js`, `qualifications.routes.js`, `caseExtractedCoverage.service.js`, `wpsWelderCoverage.js`, `caseCoverageAdvisory.service.js`, `caseCapabilityGapReport.service.js`, adapter (`welder9606`, `wpqrProcedure`, `cnd9712`), `coverageEngine.service.js`, `coverageTypes.js`, `coverageRegistry.js`, `registerDefaultAdapters.js`, `qualificationCoverage.js`, `deploy-manifest.json` (nessun `.js` runtime BE nuovo)
- **Contratto HTTP** e forme di risposta di `GET /qualifications/coverage`, `GET /cases/:id/extracted-coverage`, `GET/POST /contract-reviews/:id/capability-gap-report`, `GET …/coverage/domains`, `POST …/coverage/verify`; `apiService.js`
- **Semafori e tabella esistenti** di Progetti (`CoverageModal`: riepilogo, chip, `esito`) e Riesame (`CoveragePanel`: tabella WPS, profilo documenti, advisory WPQR, idoneità visiva, `EvadibilitySignalPanel`, `StudioReportPanel`): solo montaggio del blocco accanto
- `QualificationsPage.jsx`, `QualificationForm.jsx`, altre pagine; `RouterContext`; auth.middleware, JWT, `syncService`; ingest `cert_ndt`, `documentTypeSchemas`, `reprocessableFields.js`
- **Migrazioni SQL: nessuna** (né file né applicazione sul VPS)
- Nuovo look, palette, card KPI, tendine su dimensioni già coperte, `<table>` con CSS di pagina nuovo, emoji decorative (usare solo i badge `sq-tag`), `fetch` diretto (solo `apiService`)
- Fuori scope: derivare requisiti CND dalla commessa, `welder_9606` via registry nei blocchi, sostituire l'advisory WPQR del Riesame, nuove soglie normative

## Disgiunzione da altri brief

Verificato su `origin/main` (06/10/2026): **nessun** altro `DEPUTYTASK*` è APERTO. `DEPUTYTASK.md`, `1`–`5` e tutti gli stream `DEPUTYTASK_<EPIC>.md` sono CHIUSO; `DEPUTYTASK_AI_CHECKLIST.md` è «IN REVIEW» (assistente AI quesiti checklist, file diversi: nessuna sovrapposizione con `CoverageVerifyPanel`, `ProjectsPage` `CoverageModal`, `ContractReviewPage` `CoveragePanel`). PR aperte: nessuna (`gh pr list --state open` → `[]`), salvo la PR docs di questo brief (solo `docs/agent-tasks/`). Nessun file BE in comune con altre chat. Attenzione residua: `ProjectsPage.jsx` e `ContractReviewPage.jsx` sono file grandi e condivisi da altre slice storiche — toccare **solo** `CoverageModal` e `CoveragePanel`.

## DoD

- [ ] `CoverageVerifyPanel.css` creato, regole `.sq-cov-*` spostate (non duplicate); Qualifiche visivamente identica; panel e blocco stilati anche in Progetti/Riesame
- [ ] `CoverageVerifyPanel`: `allowedDomains` / `defaultDomain` / `embedded` retrocompatibili (4 test esistenti verdi senza ritocchi)
- [ ] `coverageCriteriaFromWps.js` puro + test (mappatura range, estremi singoli, vuoti omessi)
- [ ] Blocco «Fattibilità multi-dominio» montato in Progetti (`CoverageModal`) e Riesame (`CoveragePanel`), semafori/tabelle/advisory esistenti invariati
- [ ] Una `verify` `wpqr_procedure` per WPS (max 20, batch 4), **mai** con criteri vuoti; errore per riga isolato; `reasons[]` verbatim
- [ ] Riga saldatori read-only dal semaforo; **zero** `verify` `welder_9606` nel blocco
- [ ] CND: `CoverageVerifyPanel` embedded solo `cnd_9712`, ambito = azienda commessa
- [ ] Stati vuoto / errore / loading / dati insufficienti / troncamento coperti da test; pulsanti operativi sempre visibili (`disabled` + `title`)
- [ ] Testi italiani con accenti corretti (UTF-8, `\u` solo in stringhe JS), nessun emoji nuovo; nessun link nuovo (o regola URL rispettata)
- [ ] `cd app && NODE_ENV=test npm run test:run -- coverageFeasibilityBlock coverageCriteriaFromWps coverageVerifyPanel projectsRowActions projectsCompanyScopeClient contractReview routerContext` verde + `npm run build` OK
- [ ] `node backend/scripts/check-harness-boot.js` e `node backend/scripts/check-utf8-encoding.js` OK; **nessun file in `backend/`** nel diff (`git diff --stat origin/main -- backend` vuoto)
- [ ] Smoke UI (se i Secrets sono disponibili): `SGQ_SMOKE_PATHS=login,qualifiche node backend/scripts/smoke-percorsi-critici.mjs`; verifica a vista del blocco in una commessa con WPS (screenshot nel body PR). Se non eseguibile, dichiararlo
- [ ] Esenzione Rielaborazioni dichiarata nel body PR (nessun campo AI nuovo); nessuna migrazione; decisioni HITL elencate nel body PR
- [ ] Branch allineato a `origin/main` prima di push/PR; `bugbot run` **una sola volta** a slice chiusa (Bugbot letto prima di «pronta»; Security Review se presente)

## Comando di avvio

`Leggi docs/agent-tasks/DEPUTYTASK_COPERTURA.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Esito (06/10/2026) — TEST OK

**Consegnato (solo FE additivo, nessun file in `backend/`, nessuna migrazione, nessun endpoint):**

- Blocco «Fattibilità multi-dominio» (`CoverageFeasibilityBlock`) montato in Progetti (`CoverageModal`, anche senza WPS: pulsante `disabled` + `title`) e in Riesame (`CoveragePanel`, dopo la tabella WPS e prima degli advisory). Semafori, tabelle, advisory e idoneità visiva **invariati**.
- WPQR: una `verify` `wpqr_procedure` per WPS su click (max 20, batch 4, `Promise.allSettled`), **mai** con criteri vuoti (riga «Requisiti WPS insufficienti per la verifica»), `reasons[]`/`message` verbatim, errore isolato per riga.
- Saldatori: riga read-only da `summary` del semaforo, zero `verify` `welder_9606`. CND: `CoverageVerifyPanel` `embedded` solo `cnd_9712`, ambito = azienda della commessa.
- `CoverageVerifyPanel`: props `allowedDomains` / `defaultDomain` / `embedded` retrocompatibili (i 4 test esistenti invariati) ed export `COVERAGE_STATUS_LABEL` / `filterCoverageDomains`; CSS `.sq-cov-*` spostato in `CoverageVerifyPanel.css` (primitivi scoped; rimosso da `QualificationsPage.css`).

**File toccati:** `app/src/components/CoverageFeasibilityBlock.jsx` (nuovo) · `CoverageVerifyPanel.jsx` · `CoverageVerifyPanel.css` (nuovo) · `app/src/utils/coverageCriteriaFromWps.js` (nuovo) · `app/src/pages/ProjectsPage.jsx` (`CoverageModal` + stato `setCoverageProject`) · `ContractReviewPage.jsx` (`CoveragePanel`) · `QualificationsPage.css` (solo rimozione blocco COV-1) · test `coverageFeasibilityBlock.test.jsx`, `coverageCriteriaFromWps.test.js` (nuovi), `coverageVerifyPanel.test.jsx` (casi aggiunti) · doc: piano, questo brief, `LIBRERIA_UI_SGQ.md`, `PROJECT_ROADMAP.md`.

**Scostamenti dal brief (dichiarati):**

- Aggiunto `app/src/tests/coverageFeasibilityMount.test.jsx` (non in elenco): montaggio nella modale di Progetti (ordine dopo la tabella, `company_id` della commessa, stato vuoto). Solo test, nessun codice di produzione.
- `ContractReviewPage.jsx`: `CoveragePanel` riceve la prop opzionale `companiesById` (già nello scope della pagina) per mostrare il nome azienda nell'ambito; `company_id`/`company_name` vengono dalla lista `getProjects` già caricata.
- Riga saldatori mostrata sempre che il semaforo sia presente (anche se `getCoverageDomains` fallisce): è un dato già in memoria, non dipende dal registry.
- Riesame: nessun test di integrazione (`CoveragePanel` non è esportato); coperto da build e da test del blocco. `PROJECT_CONTEXT.md` non toccato (componente dentro la riga «Qualifiche / alert / copertura»).
- Smoke autenticato non eseguito (la produzione Netlify non contiene il branch); verifica a vista con harness Vite + Playwright su dati mock (stati ok / calcolo / vuoto / errore registro).

**Test:** `cd app && NODE_ENV=test npm run test:run` → 261 file / 1724 test verdi (incluso `coverageFeasibilityBlock` 19, `coverageCriteriaFromWps` 13, `coverageVerifyPanel` 11, `coverageFeasibilityMount` 3, `projectsRowActions`, `projectsCompanyScopeClient`, `contractReview*`, `routerContext.match`); `npm run build` OK; `check-harness-boot` OK; `check-utf8-encoding` 0 issue; `git diff --stat origin/main -- backend` vuoto.

**HITL aperti, non toccati:** advisory WPQR vs «Registro capacità» nel Riesame (due viste coesistono) · `welder_9606` via registry accanto al semaforo · requisiti CND derivati dalla commessa · `joint_type` nei criteri WPQR · 9712 Annex A.3 / Table 1 · soglie 15613.

## Handoff

_(vuoto — slice chiusa)_
