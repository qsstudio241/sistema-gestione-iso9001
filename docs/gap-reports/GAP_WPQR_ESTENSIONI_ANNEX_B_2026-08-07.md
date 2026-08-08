# Gap report — Campi Annex B ISO 15614-1 per estensioni WPQR (post-fix)

**Data**: 07/08/2026
**Modulo**: Saldatura/WPQR (ISO 3834, cliente Mason)
**Contesto**: verifica di chiusura dopo i due fix deployati in produzione (`a3971aeb`, migrazione 139) sul flag `thickness_max_unlimited`. Segue l'audit strutturale registrato in `docs/GUIDA_CONSOLIDATA.md` (riga "Audit strutturale ingest saldatura/3834 (07/08/2026)").
**Nota**: la tabella completa dei 20 campi Annex B prodotta in una sessione precedente non è mai stata persistita in un file — questo report copre solo il sottoinsieme rilevante per il calcolo delle **estensioni di qualifica** (non tutti i campi anagrafici).

## 1. Campi che determinano la copertura di un giunto

| Campo | Acquisito (schema + prompt AI) | Sopravvive review → DB | Usato nel calcolo copertura (`wpsGenerator.service.js`) | Stato |
|---|---|---|---|---|
| Tipo giunto (`joint_type`) | Sì | Sì | Sì — `jointTypeCompatible()` | **OK** |
| Gruppo materiale (`material_group` → `base_material_group`) | Sì | Sì | Sì — `isParentMaterialCombinationCovered()` | **OK** |
| Spessore (`thickness_min`/`thickness_max` + `thickness_max_unlimited`) | Sì | Sì | Sì — `checkThicknessCoverage()`, `buildWpsDraft()` | **OK — fix deployato** (mig. 139 + `wpsGenerator.service.js`, commit `a3971aeb`) |
| Gola/throat giunti d'angolo (Tabella 8) | **NO** — nessun campo dedicato in `fields`/`aiPrompt`/`aiExpectedSchema` | N/A | Solo hint **calcolato** da `thickness_tested` (`computeQualifiedFilletThroatThicknessRange`), non da un valore reale estratto dal documento | **GAP APERTO — non corretto** |
| Diametro tubo (`diameter_min`/`diameter_max`) | Sì | Sì | **NO** — nessun controllo diametro nel loop candidati di `generateWpsFromWpqr()`; la richiesta (`request`) non ha nemmeno un parametro diametro | **GAP APERTO — acquisito ma non usato in copertura** |
| Posizione di saldatura (`welding_positions`) | Sì | Sì | **NO** — solo copiato nella bozza WPS (`buildWpsDraft`), mai usato come filtro di copertura | **GAP APERTO — acquisito ma non usato in copertura** |
| Mono/multipassata (`single_multi_run`) | Sì | Sì | **NO** — mai letto in `wpsGenerator.service.js` | **GAP APERTO — acquisito ma non usato in copertura** |

## 2. Bug attivo aggiuntivo trovato (fuori dalla lista sopra, non richiesto dal committente ma rilevante)

`preheat_temp` e `interpass_temp` sono presenti in `fields`, `aiPrompt` e `aiExpectedSchema` dello schema `wpqr` (quindi **visibili e compilabili in UI**, essendo l'interfaccia data-driven — vedi §3), ma **assenti** sia da `mapPipelineFieldsToReview()` sia da `mapReviewFieldsToDb()` in `backend/src/services/wpqrIngest.service.js`, e la tabella `wpqr_records` non ha nemmeno le colonne corrispondenti. Stesso pattern strutturale ("campo in schema ma perso prima del DB") già documentato in `GUIDA_CONSOLIDATA.md` — **non ancora corretto**.

## 3. Verifica UI — data-driven, non hardcoded

`app/src/components/IngestReviewDialog.jsx` itera dinamicamente su `schema.fields` (righe 123, 169, 274) — nessun elenco campi hardcoded. Il pattern di bug "campo in schema ma non mostrato" **non è mai causato dalla UI**: il punto di rottura è sempre nelle funzioni di mapping per-tipo-documento nel service backend (`mapPipelineFieldsToReview` / `mapReviewFieldsToDb`), che sono manuali e vanno aggiornate ad ogni estensione di schema.

## 4. Raccomandazione test

Vedi risposta chat 07/08/2026 (worker WPQR estensioni) per il confronto E2E browser / integrazione a livello servizio / round-trip a sentinella. Raccomandazione: **round-trip a sentinella in CI** (per-chiave `aiExpectedSchema` → verifica sopravvivenza a `mapPipelineFieldsToReview` + `mapReviewFieldsToDb`) come test sempre attivo, economico, che avrebbe intercettato anche il gap `preheat_temp`/`interpass_temp` di cui sopra. Test con documento reale solo mirato (nuovo tipo documento o sospetto qualità estrazione), non ad ogni build.

## Fix prioritari da pianificare (non eseguiti in questo giro — solo analisi)

1. Gola/throat FW: aggiungere campo dedicato allo schema `wpqr` + colonna DB + uso in `wpsGenerator` (oggi solo hint calcolato).
2. `wpsGenerator.service.js`: aggiungere filtro diametro tubo, posizione di saldatura, mono/multipassata al loop candidati (oggi solo materiale/spessore/giunto/processo).
3. `preheat_temp`/`interpass_temp`: aggiungere ai mapping + colonne DB (stesso pattern del fix preheat/interpass "chiuso" citato in GUIDA — qui invece risulta ancora apeto).
4. Round-trip a sentinella (test trasversale) — vedi audit strutturale 07/08/2026.

## Aggiornamento 07/08/2026 (sessione successiva) — stato dopo il secondo giro di fix

| # | Item | Esito |
|---|---|---|
| 1 | Gola/throat FW | **Chiuso** (07/08/2026, terzo giro): `checkThroatCoverage()` in `wpsGenerator.service.js`, wired nel loop candidati, applicato SOLO se il chiamante richiede esplicitamente una gola (nuovo parametro opzionale `throat_mm`, API `POST /welding/wps/generate` + UI "Genera WPS", visibile solo per giunti FW) — usa `computeQualifiedFilletThroatThicknessRange({ testThicknessMm: wpqr.thickness_tested })`, la stessa formula Tabella 8 già codificata e già usata come hint informale in `checkThicknessCoverage`, ora usata come vero controllo di copertura. **Nota normativa importante** (Tabella 8, testo integrale norma — vedi sotto): esiste una SECONDA formula in direzione opposta (gola nominale del provino "a" → range spessore materiale qualificato: 0,75a-1,5a per mono-passata, nessuna restrizione per multi-passata) che userebbe il campo `throat_test_mm` aggiunto nel giro precedente. Non implementata in questo giro per non mescolare due controlli diversi (verifica gola vs affinamento range spessore materiale) — **backlog residuo**, vedi tabella sotto. |
| 2a | Diametro tubo in copertura | **Chiuso**: `checkDiameterCoverage()` in `wpsGenerator.service.js`, wired nel loop candidati, applicato SOLO se il chiamante specifica `pipe_diameter_mm` (giunto su tubo) — Level 1 sempre coperto, Level 2 richiede range dichiarato sul WPQR (fail-closed se assente, mai fail-open). Nuovo campo opzionale "Diametro tubo (mm)" nel form "Genera WPS" (`WeldingProceduresPage.jsx`) + parametro `pipe_diameter_mm` nell'API `POST /welding/wps/generate`. |
| 2b | Posizione di saldatura in copertura | **Non è un gap da correggere con un filtro** — vedi `docs/reference/ISO-15614-1-range-validita-WPQR.md` §"Posizione di saldatura (§8.4.2)": se non sono richieste prove d'urto/durezza, la saldatura del provino in **qualsiasi posizione qualifica tutte le posizioni**. Aggiungere un filtro posizione senza sapere se il WPQR ha richiesto prove d'urto produrrebbe un **fail-closed scorretto** (rischio di rifiutare WPQR realmente coperte) — rischio peggiore del gap attuale (nessun filtro = comportamento normativamente corretto nel caso generale). **Gap residuo reale**: manca un campo `impact_test_required` per gestire correttamente il caso minoritario in cui le prove d'urto SONO richieste — non implementato in questo giro (richiede nuova estrazione + logica dedicata). |
| 2c | Mono/multipassata in copertura | **Stessa motivazione di 2b** — §8.4.3: un cambio mono↔multi-passata richiede nuova qualifica **solo se sono richieste prove d'urto o durezza**. Senza un campo `impact_test_required`/`hardness_test_required`, un filtro qui sarebbe altrettanto un fail-closed scorretto nel caso generale. Non implementato — stesso gap residuo di 2b. |
| 3 | `preheat_temp`/`interpass_temp` | **Chiuso**: aggiunti a `mapPipelineFieldsToReview`/`mapReviewFieldsToDb`/INSERT in `wpqrIngest.service.js` + colonne `wpqr_records.preheat_temp`/`interpass_temp` (migrazione 141). |
| 4 | Round-trip a sentinella | **Chiuso**: helper `backend/src/utils/ingestRoundTripSentinel.js` + test applicati su `wpqr` e `patentino_saldatore` (i due doc type con bug reali già trovati). Estensione ad altri doc type (`wps` legacy, `cert_ndt`, `qualifica_14732`) raccomandata come prossimo passo, stesso pattern. |

**Nuovo backlog aperto (non bloccante, da tracciare)**:
- `impact_test_required` (booleano, ISO 15614-1 §8.4) per abilitare in modo normativamente corretto i filtri posizione/mono-multipassata quando pertinenti — senza questo campo, aggiungerli produrrebbe falsi negativi (fail-closed scorretto), quindi non vanno implementati come filtro hard finché il dato non è disponibile.
- Formula inversa Tabella 8 (gola dichiarata "a" → range spessore materiale qualificato 0,75a-1,5a mono-passata / nessuna restrizione multi-passata): userebbe `throat_test_mm` + `single_multi_run`, per affinare `checkThicknessCoverage` quando `thickness_min`/`thickness_max` non sono dichiarati ma la gola sì. Non implementata: è un affinamento del controllo spessore, non del controllo gola (già chiuso sopra).

## Testo normativo di riferimento — Tabella 8 (ISO 15614-1:2017, §8.3.2.2, pag. 31 del documento digitalizzato)

> "Table 8 — For level 2: Range of qualification for material thickness and throat thickness of fillet welds [...] Thickness of test piece t | Throat thickness | Material thickness (single run / multi-run) [...] t ≤ 3: 0,7 t to 2 t | 0,75 a to 1,5 a | No restriction [...] 3 < t < 30: 3 to 2 t [...] t ≥ 30: ≥5 [...] NOTE a is the nominal throat thickness as specified in pWPS for the test piece."

Conferma le due direzioni: (1) spessore provino → range gola [implementata in `checkThroatCoverage`], (2) gola nominale provino "a" → range spessore materiale [non implementata, backlog].

## Deploy produzione (07/08/2026, stessa sessione)

Migrazioni **140** (qualifications.thickness_max_unlimited — già su `main`, non ancora applicata in produzione) e **141** (wpqr_records.preheat_temp/interpass_temp/throat_test_mm — PR #357) applicate su VPS con `backend/scripts/run-migration-140-vps.js`/`run-migration-141-vps.js`, colonne verificate. Deploy backend completo (`backend/scripts/deploy-to-vps.sh`, manifest invariato — tutti i file toccati erano già presenti) — PID riavviato, health API 200, smoke `npm run smoke:deploy` OK, endpoint `qualifications`/`welding/wpqr` rispondono 401 (nessun crash). Nota: il deploy segnala `deploy_norm_upload_route_MISSING` — falso positivo del grep di sanità dello script (cerca `normUpload.routes.js` letterale, il require reale è `normUpload.routes` senza estensione), non un problema reale, verificato con `grep` diretto sul `server.js` remoto.
