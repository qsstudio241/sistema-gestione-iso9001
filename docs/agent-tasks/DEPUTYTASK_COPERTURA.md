# DEPUTYTASK_COPERTURA — COV-3: adapter `cnd_9712` pieno (settore · schema · tecnica · idoneità visiva)

**Stato:** CHIUSO — TEST OK (06/10/2026)  
**Aperto:** 06/10/2026  
**Piano:** [`PLAN_COPERTURA_SCALABILE_SLICES.md`](PLAN_COPERTURA_SCALABILE_SLICES.md) § COV-3  
**Dipende da:** COV-1 CHIUSO (PR #702) · COV-2 CHIUSO (PR #704) — entrambe su `main`  
**Rischio:** Medio — BE additivo, nessuna migrazione, nessuna modifica a auth/sync/schema  
**Stream:** `DEPUTYTASK_COPERTURA.md` (epic copertura; COV-4/5 riusano questo file solo dopo che COV-3 è CHIUSO e la riga titolo/file è aggiornata)  
**Branch suggerito:** `cursor/cov-3-cnd-adapter-<suffisso>`

**Scontrino COV-2 (CHIUSO, PR #704):** adapter `wpqr_procedure` pieno; toccati `wpqrProcedure.adapter.js` (+ test), `coverageEngine.service.js` (campo opzionale `message` da `adapter.emptyMessage`), `CoverageVerifyPanel.jsx` (+ test), piano, roadmap. Pattern da copiare: aggregazione fail → `no_match`, dato mancante → `partial`, ordinamento match → partial → no_match.

---

## Esito (CHIUSO — TEST OK)

- `cnd9712.adapter.js`: `maturity: 'full'`; `requirementFields` = metodo, livello (hint aggiornato), **settore**, **schema**, **tecnica**; SELECT estesa (`personnel_id`, `ndt_sector`, `certification_scheme`, `scope_detail`, `certificate_number`); certificati visivi esclusi dalle capacità (`isVisionFitnessType`) e caricati con seconda query (`visionFitnessSqlInList()`, stesso scope azienda); `matchCndCapability(qual, criteria, { todayIso, visionRows })` pura; ordinamento match → partial → no_match; `emptyMessage` per nessuna qualifica NDT.
- Visione: `visionStateForPerson` esportato da `ndtInspectorGate.service.js` (solo `module.exports`, nessun cambio di logica). Senza `opts.visionRows` la visione è `skipped` (contratto COV-1 invariato; i 2 test CND di `coverageEngine.service.test.js` restano verdi senza ritocchi). `missing`/`expired` → `no_match`; `ok` senza scadenza → `ok` + `detail.vision_note = 'senza_scadenza'`.
- Regole implementate come da brief. Scelte di dettaglio non esplicitate nel brief (tutte conservative, nessuna regola normativa nuova):
  - qualifica con settore non riconosciuto (testo libero fuori da `c f w t wp p m s r a`) → `unverifiable` (`partial`), non `mismatch`; settore multiplo (es. `w, t`) valutato per token;
  - tecnica: `ok` solo se **tutti** i token richiesti sono nello scope del certificato; intersezione solo parziale → `partial` (mai `match` per sovrapposizione parziale, mai `no_match`).
- FE: nessuna modifica (pannello dinamico da `requirementFields`; `maturity === 'full'` toglie il «(minimo)»). Rielaborazioni: **esenzione dichiarata** (nessun campo AI nuovo). HITL settori industriali / codici metodo: invariato (nessuna risposta), `NORME_MANCANTI_BACKLOG.md` non toccato.
- Test: `cd backend && npx jest src/services/capabilityCoverage src/services/ndtInspectorGate` → 4 suite, 87 test verdi (anche con `TZ=America/Los_Angeles` e `Pacific/Auckland`); `check-harness-boot` OK; `check-utf8-encoding` OK (0 issue).
- File toccati: `backend/src/services/capabilityCoverage/adapters/cnd9712.adapter.js`, `…/cnd9712.adapter.test.js` (nuovo), `backend/src/services/ndtInspectorGate.service.js` (solo export), `docs/agent-tasks/PLAN_COPERTURA_SCALABILE_SLICES.md`, questo brief, `docs/PROJECT_ROADMAP.md` (una riga). Nessuna migrazione, `deploy-manifest.json` invariato.

---

## Obiettivo (una slice = un risultato verificabile)

Portare `cnd9712.adapter.js` da `maturity: 'minimal'` a `'full'`: oltre a metodo + livello + non scaduta (già in COV-1), il match deve valutare **settore** (`ndt_sector`), **schema di certificazione** (`certification_scheme`), **tecnica** (`scope_detail`) e **idoneità visiva in corso di validità** (riuso `visionFitness` / gate CND-2). Esito per ogni qualifica 9712 dell'organizzazione: `match` / `partial` / `no_match` con motivi leggibili. Nessuna logica duplicata: la regola «patentino + visione» esiste già in `ndtInspectorGate.service.js`.

## Gate norme (dichiarato)

- **Coperte (MD+JSON in `docs/Normative/`):** ISO 9712:2021 = `Normative NORMA_00034_ ISO 9712_2021 Rev. 0.{md,json}` (il nome file inizia con `Normative ` — è quello reale in Git).
  - Annex A.1–A.3 (settori prodotto `c f w t wp` + compositi; industriali `m s r a`; «`s` include la fabbricazione»; «chi è certificato in un settore industriale è considerato certificato anche in ciascun settore che lo compone»).
  - §7.4.2 acuità visiva vicina verificata **annualmente**; §7.4.3 visione cromatica entro 5 anni solari; §9.3.1 «per essere valido il certificato deve essere supportato da una verifica annuale corrente della vista».
  - §9.4 riconoscimento di certificazioni di altri enti (base per `partial`, non `no_match`, su schema diverso).
  - Estratto operativo: `docs/reference/ISO_9712_2022_NDT_QUALIFICATION.md` (§4 settori, §5 schemi).
  - Decisioni HITL 23/08/2026 (`PLAN_CND_SLICES.md`): gate = patentino 9712 valido per il metodo **e** idoneità visiva in corso di validità.
- **Parziali (non inventare):**
  - **Composizione dei settori industriali** `m`, `r`, `a` (e `s`/`m` → `w`): l'Annex A.3 dice solo che l'ente di certificazione ne definisce lo scope pubblicato. Il testo 2021 **non** elenca i prodotti compresi. L'estratto repo (§4 «Regola di copertura: `w` oppure `s`/`m` coprono saldature») è una convenzione operativa **non verificabile** dal testo 2021 e **non risulta implementata** in nessun servizio (verificato: nessun uso di `ndt_sector` in `caseExtractedCoverage` / `caseCoverageAdvisory`). In COV-3: settore industriale posseduto vs settore di prodotto richiesto = `partial` («verificare scope pubblicato dall'ente»). Salvo risposta HITL (vedi sotto).
  - **Scadenza visione:** il certificato oculistico unico (`VISION_FITNESS_TYPE`) ha una sola `expiry_date`; la norma distingue acuità annuale e colore 5 anni. COV-3 usa la `expiry_date` del certificato come fa già `visionFitness`/gate; non distingue le due componenti.
  - **Schema:** `certification_scheme` è testo libero (CICPND, PCN, TEC Eurolab…). Nessuna tabella normativa di equivalenza tra schemi → confronto testuale, esito massimo `partial` se diverso.
  - **Codici metodo:** Table 1 di ISO 9712:2021 (righe VT/UT vuote nel MD, GAP già in backlog) usa `AT` `LT` `ST` `TT` per emissione acustica / tenuta / estensimetri / termografia; il repo (`ndtInspectorGate` `NDT_METHODS`, estratto) usa `AE` `TT`(tenuta) `ST`(stress) `LT`. **Non allineare in questa slice**: `requirementFields.ndt_method` resta sui 6 metodi già presenti (VT PT MT UT RT ET); riga nel backlog + HITL.
- **Mancanti:** nessun PDF bloccante per il perimetro COV-3. Richieste HITL aperte (non bloccano, perimetro = sopra): vedi §«HITL» e `NORME_MANCANTI_BACKLOG.md`.

## Checklist dato ↔ norma ↔ UI ↔ API

| Dato | Clausola / fonte MD | UI | API / persistenza |
|------|---------------------|----|-------------------|
| `ndt_method` (VT PT MT UT RT ET) | ISO 9712 Table 1 / `qualifications.ndt_method` | select già in `CoverageVerifyPanel` | `POST /qualifications/coverage/verify` (esistente) |
| `ndt_level` (1/2/3, opzionale) | §5.3.2 estratto repo (livello ≥ richiesto) | select già presente; togliere dall'hint «Opzionale in COV-1» | idem |
| `ndt_sector` (c f w t wp p / m s r a, opzionale) | Annex A.2/A.3; colonna `qualifications.ndt_sector` (mig. 084, **esistente**) | **nuovo** `requirementFields` select (nessun JSX nuovo: il pannello è dinamico) | idem — nessuna nuova colonna |
| `certification_scheme` (testo, opzionale) | §9.4 (altri enti → partial); colonna `certification_scheme` (mig. 084) | **nuovo** campo text | idem |
| `scope_detail` = tecnica richiesta (PA, TOFD, DR…) (testo, opzionale) | Annex A.1 «scope sul certificato»; colonna `scope_detail` (mig. 032) | **nuovo** campo text | idem |
| Idoneità visiva (nessun campo requisito: sempre verificata) | §7.4.2, §9.3.1; HITL 23/08 (CND-2); `visionFitness.service` / `ndtInspectorGate.visionStateForPerson` + `occupationalQualificationTypes` | colonna esito/`detail.vision` (nessun campo nuovo) | idem — lettura `qualifications` tipo `VISION_FITNESS_TYPE`, nessuna nuova colonna |

### Regole di match (da implementare; motivi leggibili in `reasons`)

- **Metodo / livello / operativa:** invariati da COV-1 (nessuna regressione sui test esistenti).
- **Settore** (`detail.ndt_sector`):
  - requisito vuoto → `skipped`;
  - qualifica senza settore → `unverifiable` (→ `partial`);
  - codici uguali → `ok`;
  - requisito `m` e qualifica `s` → `ok` (A.3 b: «`s` include la fabbricazione»);
  - requisito di **prodotto** (`c f w t wp p`) e qualifica **industriale** (`m s r a`) → `unverifiable` (→ `partial`, motivo «scope del settore industriale definito dall'ente (A.3): verificare sul certificato»);
  - altrimenti (prodotto ≠ prodotto, industriale ≠ industriale, requisito industriale con qualifica di solo prodotto) → `mismatch` (→ `no_match`; possedere un settore di prodotto non implica il settore industriale — A.3, ultimo capoverso, vale nell'altro verso).
- **Schema** (`detail.certification_scheme`): confronto case-insensitive su stringa normalizzata; richiesto vuoto → `skipped`; qualifica senza schema → `unverifiable`; diverso → `unverifiable` con motivo «schema diverso: verificare accettazione/riconoscimento (§9.4)». **Mai** `no_match` da questo campo (testo libero).
- **Tecnica** (`detail.scope_detail`): token case-insensitive (split su `, ; /` e spazi); richiesto vuoto → `skipped`; qualifica senza `scope_detail` o senza intersezione → `unverifiable` (→ `partial`). **Mai** `no_match` da testo libero estratto AI.
- **Idoneità visiva** (`detail.vision`): stato per persona via `visionStateForPerson` (stessa logica del gate: `personnel_id` preferito, altrimenti nome normalizzato; preferenza stessa azienda). `ok` → `ok`; `missing` o `expired` → `mismatch` (→ `no_match`, coerente con HITL 23/08 e §9.3.1: certificato non supportato da verifica vista corrente). Se `ok` ma senza scadenza sul certificato: esito `ok` come il gate, con `detail.vision_note = 'senza_scadenza'` (verifica annuale non dimostrabile, nessun `no_match` nuovo).
- **Aggregazione:** qualunque `mismatch` → `no_match`; altrimenti qualunque `unverifiable` → `partial`; altrimenti `match`. Ordinamento risultati match → partial → no_match (come COV-2). Nessuna qualifica NDT → `matches: []` + `emptyMessage` (campo già supportato dal motore).
- `capability` (summarize): aggiungere `ndt_sector`, `certification_scheme`, `scope_detail`, `certificate_number`, `vision_state`/`vision_expiry_date`.

## Cosa fare

1. **Adapter** `backend/src/services/capabilityCoverage/adapters/cnd9712.adapter.js`: `maturity: 'full'`; estendere `REQUIREMENT_FIELDS` (settore, schema, tecnica; aggiornare hint livello) **senza** rompere i campi COV-1; estendere la SELECT con `q.personnel_id, q.ndt_sector, q.certification_scheme, q.scope_detail, q.certificate_number` (colonne tutte esistenti); escludere i certificati visivi dalle capacità candidate (`isVisionFitnessType`) e caricare in una seconda query (stesso `ctx.pool`) le righe visione con `visionFitnessSqlInList()` (stesso SQL di `loadVisionRows` nel gate, con scope azienda come la query principale). `matchCndCapability(qual, criteria, opts)` resta pura: ricevere le righe visione in `opts.visionRows` e la `today` in `opts.todayIso`. `emptyMessage` per «nessuna qualifica NDT».
2. **Riuso visione:** in `ndtInspectorGate.service.js` aggiungere **solo** `visionStateForPerson` a `module.exports` (nessun cambio di logica; il file è già nel `deploy-manifest.json`). Vietato copiare la funzione.
3. **Test L1 Jest** (`cnd9712.adapter.test.js`, nuovo, accanto all'adapter, DB mockato come `wpqrProcedure.adapter.test.js`): match pieno (metodo+livello+settore+schema+visione ok); no_match visione mancante e scaduta; no_match settore prodotto diverso e requisito industriale con qualifica di prodotto; `m` richiesto con `s` posseduto = match; `w` richiesto con `s`/`m` posseduto = partial; settore/schema/tecnica assenti in anagrafica = partial; schema diverso = partial (mai no_match); tecnica senza intersezione = partial; certificato visivo senza scadenza = match con `vision_note`; nessuna qualifica → lista vuota + messaggio; ordinamento match → partial → no_match; certificato visivo non compare tra le capacità. Spostare/estendere i 2 test «cnd_9712 match minimo» di `coverageEngine.service.test.js` solo se il contratto cambia (firma `matchCndCapability` retrocompatibile: senza `visionRows` il comportamento COV-1 non deve cambiare → decidere e testare esplicitamente se visione non caricata = `skipped`).
4. **FE:** zero modifiche previste (`CoverageVerifyPanel.jsx` rende select/text da `requirementFields`; mostra «(minimo)» solo se `maturity === 'minimal'`). Se serve un fix, minimo + `coverageVerifyPanel.test.jsx`.
5. **Backlog/Doc:** righe già aperte dal brief in `NORME_MANCANTI_BACKLOG.md` (settori industriali + codici metodo): aggiornare lo stato solo se arriva la risposta HITL. Aggiornare `PLAN_COPERTURA_SCALABILE_SLICES.md` (DoD COV-3 spuntato, riga «Brief attivo»). GUIDA/roadmap: nella **stessa** PR una riga in roadmap § Stato attuale solo se non ci sono altri `DEPUTYTASK*` APERTI (al momento nessuno).
6. **Rielaborazioni (Registro):** COV-3 **non aggiunge** campi AI-estraibili (`ndt_sector`, `certification_scheme`, `scope_detail` esistono già nello schema `cert_ndt` e nella tabella) → **esenzione dichiarata**: nessuna voce in `REPROCESSABLE_FIELD_REGISTRY`/whitelist. Se invece il deputy aggiungesse un campo nuovo a `aiExpectedSchema`, la voce Rielaborazioni è obbligatoria nella stessa slice (`sgq-operating-memory.mdc`) — ma non è nel perimetro.

## HITL aperto (non bloccante — perimetro COV-3 = quanto sopra)

Richiesta norma al committente (copia dal template [`HANDOFF_TEMPLATE.md`](HANDOFF_TEMPLATE.md)), registrata anche in `NORME_MANCANTI_BACKLOG.md`:

- **Codice / titolo:** scope pubblicato dei settori industriali ISO 9712 (`m` `s` `r` `a`) dall'ente di certificazione che emette i patentini dello studio (es. TEC Eurolab / CICPND). Edizione ISO 9712:2021 già in repo (`NORMA_00034`): l'Annex A.3 rimanda allo scope dell'ente.
- **Serve a:** COV-3 — decidere se `s`/`m` **coprono** `w` (saldature) con `match` invece di `partial`.
- **Cosa c'è già in repo:** `NORMA_00034` MD+JSON, estratto `ISO_9712_2022_NDT_QUALIFICATION.md` §4 (convenzione operativa non verificabile dal testo).
- **Cosa NON inventiamo senza fonte:** quali prodotti comprendono `m`, `r`, `a`; equivalenza tra schemi di certificazione.
- **Perimetro su cui si parte comunque:** uguaglianza codici, `s ⊇ m`, `partial` per industriale→prodotto.
- **Formato utile:** documento dell'ente (PDF) con lo scope dei settori; in alternativa una decisione scritta del committente («`s` e `m` coprono `w`: sì/no»).
- **Secondo punto HITL:** allineamento codici metodo `AE`/`TT`/`ST`/`LT` (repo) vs `AT`/`LT`/`ST`/`TT` (Table 1, ISO 9712:2021) — slice separata, non qui.

## File previsti (codice)

- `backend/src/services/capabilityCoverage/adapters/cnd9712.adapter.js`
- `backend/src/services/capabilityCoverage/adapters/cnd9712.adapter.test.js` (nuovo)
- `backend/src/services/capabilityCoverage/coverageEngine.service.test.js` (solo ritocchi ai 2 test CND)
- `backend/src/services/ndtInspectorGate.service.js` (**solo** `module.exports` += `visionStateForPerson`)
- Solo lettura/riuso: `backend/src/services/visionFitness.service.js`, `backend/src/constants/occupationalQualificationTypes.js` (`isVisionFitnessType`, `visionFitnessSqlInList`), `backend/src/services/weldingCoordinatorAuth.service.js` (`isQualificationOperationallyActive`)
- `app/src/components/CoverageVerifyPanel.jsx` + `app/src/tests/coverageVerifyPanel.test.jsx` (solo se necessario)
- Doc: `docs/agent-tasks/PLAN_COPERTURA_SCALABILE_SLICES.md`, questo brief, `docs/reference/NORME_MANCANTI_BACKLOG.md` (solo aggiornamento stato HITL), `docs/PROJECT_ROADMAP.md` (una riga)

## Cosa NON toccare

- Logica di `ndtInspectorGate.service.js` (gate CND-2) e di `visionFitness.service.js`: solo riuso/export
- `NDT_METHODS` / codici metodo del gate e dell'estratto (allineamento 9712:2021 = slice separata)
- Adapter `welder9606` e `wpqrProcedure` (COV-1/2 chiusi)
- `qualifications.controller.js` / `.routes.js` (rotte COV-1 già pronte; `getCoverage` → COV-4)
- `coverageEngine.service.js`, `coverageTypes.js`, `coverageRegistry.js`, `registerDefaultAdapters.js` (nessun cambio di contratto previsto)
- Ingest `cert_ndt` (`documentTypeSchemas.js`, `qualificationIngest.service.js`), `reprocessableFields.js`, `QualificationForm.jsx` (compositi `p` vs `cc/frp/mmc/cmc` 2021 = fuori slice)
- Migrazioni SQL (**nessuna** in COV-3), `deploy-manifest.json` (nessun nuovo `.js` runtime: il test non va nel manifest)
- Verbali CND (`NdtReportsPage`, `ndt_reports`), auth.middleware, JWT, `syncService`

## Disgiunzione da altri brief

Su `origin/main` **nessun** `DEPUTYTASK*` è APERTO eccetto questo (verificato 06/10/2026: `DEPUTYTASK_AI_CHECKLIST.md` è «IN REVIEW», file diversi — AI checklist, nessuna sovrapposizione con `capabilityCoverage/`, `ndtInspectorGate`, `visionFitness`). PR aperte: nessuna (`gh pr list --state open` vuoto, 06/10/2026), salvo la PR docs di questo brief.

## DoD

- [x] `GET /qualifications/coverage/domains` mostra `cnd_9712` con `maturity: 'full'`
- [x] `POST /qualifications/coverage/verify` con `domain: cnd_9712` valuta settore, schema, tecnica e idoneità visiva; match / partial / no_match ordinati
- [x] Visione riusata da `visionStateForPerson` (nessuna copia di logica); `missing`/`expired` → `no_match`
- [x] Nessuna regola inventata: industriale→prodotto = `partial`; schema/tecnica mai `no_match`
- [x] `requirementFields` estesi senza rompere COV-1 (metodo/livello invariati)
- [x] Nessuna qualifica NDT → lista vuota + `message`
- [x] Jest mirato verde (`cd backend && npx jest src/services/capabilityCoverage src/services/ndtInspectorGate`)
- [x] Se toccato FE: `cd app && NODE_ENV=test npm run test:run -- coverageVerifyPanel` + `npm run build`
- [x] `node backend/scripts/check-harness-boot.js` e `node backend/scripts/check-utf8-encoding.js` OK
- [x] Esenzione Rielaborazioni dichiarata nel body PR (nessun campo AI nuovo)
- [x] Branch allineato a `origin/main` prima di push/PR; `bugbot run` una sola volta a slice chiusa

## Comando di avvio

`Leggi docs/agent-tasks/DEPUTYTASK_COPERTURA.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Handoff

_(vuoto — compilare dal template [`HANDOFF_TEMPLATE.md`](HANDOFF_TEMPLATE.md) solo se la slice non si chiude)_
