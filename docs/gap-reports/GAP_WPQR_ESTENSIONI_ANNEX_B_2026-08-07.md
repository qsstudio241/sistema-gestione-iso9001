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

## Aggiornamento 08/08/2026 — chiusura anomalie UI/UX segnalate dal committente

Segnalazione: campi con nomenclatura ambigua (spessore materiale base vs prova vs gola), campo diametro tubo privo di indicazioni su come gestire il caso "testata su piastra" (il verbale reale riporta lì una regola testuale ISO 15614-1 §8.3.3 — "Outside diameter: > 500; > 150 for position PC, PF/PA rotated" — non un numero), ente/esaminatore vincolato a un menu chiuso senza "IIS - ISSCERT" e senza possibilità di specificare un ente non catalogato.

| Anomalia | Fix |
|---|---|
| Etichette ambigue `thickness_min`/`thickness_max` | Rinominate "Spessore materiale base — minimo/massimo (mm)" + hint che distingue da spessore prova e gola |
| Campo diametro senza indicazioni sul caso "testata su piastra" | Hint esplicito: non trascrivere la regola testuale, usare invece il nuovo campo "Tipo prodotto testato" |
| **Regola piastra→tubo mai collegata** (funzione già scritta ma orfana) | Nuovi campi WPQR `product_type` (P/T) e `rotated_position` (booleano) — schema FE+BE, colonne DB (migrazione **142**), mapping ingest completo, `checkDiameterCoverage()` ora applica automaticamente `describePlateCoversPipeDiameterLevel2()` quando `product_type='P'` e nessun diametro numerico dichiarato |
| **Bug scoperto nella funzione stessa** (preesistente, non di questa sessione): richiedeva il flag "ruotato" anche per la posizione PC, quando la norma prevede che PC da sola già qualifichi la soglia ridotta (>150mm) — solo PF/PA richiedono la conferma "ruotata" | Corretta `describePlateCoversPipeDiameterLevel2()` in `weldingQualificationRules15614.js` (FE+BE), nuovi test di regressione |
| Menu "Ente/esaminatore" e "Ente certificatore" (WPQR, patentino saldatore, ISO 14732) chiuso, valori fuori elenco scartati silenziosamente dalla UI (non solo "IIS" mancante — QUALSIASI ente futuro non catalogato) | Aggiunto "IIS - ISSCERT (Istituto Italiano di Saldatura)" alle 3 liste. **Fix strutturale**: `IngestReviewDialog.jsx` ora rileva quando un valore estratto dall'AI non corrisponde a nessuna opzione e lo mostra in un campo di testo libero (mai più scartato silenziosamente), generico per qualsiasi campo con opzione "Altro" |

Test: nuovi test `weldingQualificationRules15614.test.js` (regola piastra→tubo, bug PC), `wpsGenerator.service.test.js` (6 scenari piastra→tubo), `ingestReviewDialog.test.jsx` (4 scenari select+Altro). Round-trip a sentinella WPQR verificato con i 2 nuovi campi senza modifiche al test (rilevazione automatica via `aiExpectedSchema`).

## Aggiornamento 08/08/2026 (bis) — form "Modifica WPQR" disallineato dall'ingest

Segnalazione committente: aprendo "Modifica" su una WPQR già esistente, molti campi estratti correttamente dall'AI non comparivano nel form manuale. Verifica riga per riga (colonna DB vs form vs whitelist API di `updateWPQR`/`createWPQR`):

- **6 campi completamente bloccati** (aggiunti nelle sessioni precedenti — `thickness_max_unlimited`, `preheat_temp`, `interpass_temp`, `throat_test_mm`, `product_type`, `rotated_position`): visibili in lettura ma **non scrivibili né da form né da API manuale**, solo l'ingest AI poteva impostarli.
- **7 campi accettati dall'API ma invisibili in UI** (`base_material_spec`, `shielding_gas`, `current_type`, `metal_transfer`, `mechanization`, `single_multi_run`, `heat_input_note`) + checkbox `pwht` mancante.
- **Duplicazione `testing_body`/`examiner_body`**: stesso concetto reale ("Examiner or examining body" nel modulo WPQR ufficiale), ma solo `testing_body` esposto in UI — una correzione manuale lasciava `examiner_body` congelato al valore dell'ingest.

**Fix**: tutti e 6 i campi bloccati aggiunti a `createWPQR`/`updateWPQR` (whitelist + INSERT); i 7 campi invisibili + `pwht` aggiunti al form in una nuova sezione "Parametri prova avanzati (pag.2 verbale)"; mirroring automatico `testing_body → examiner_body` in `updateWPQR` quando solo il primo viene inviato (mai sovrascrive se `examiner_body` è inviato esplicitamente). Nessuna modifica a `reference_number` (duplicato tecnico di `wpqr_code` usato solo per il controllo duplicati interno — già coperto su entrambe le colonne).

Test: nuovo `welding.controller.wpqrFields.test.js` (5 test — create/update campi estensione + mirroring). Nessuna migrazione aggiuntiva (le colonne esistono già dalle migrazioni 133/139/141/142).

## Aggiornamento 08/08/2026 (tris) — stessa verifica estesa alle Qualifiche saldatori + sistematizzazione

Su richiesta del committente, la stessa verifica "modifica manuale vs ingest" è stata ripetuta sul modulo Qualifiche saldatori. Esito:

- **`QualificationForm.jsx` era già quasi completo** (grazie al lavoro delle sessioni precedenti — 26-28/07, 01/08): tutti i campi dei 4 schemi ingest collegati (`patentino_saldatore`, `qualifica_14732`, `cert_ndt`, `qualifica_14731`) risultano editabili a mano, verificato ora con un test automatico dedicato.
- **Trovato un bug diverso ma della stessa famiglia**: il selettore "Da anagrafica azienda" (`personnel_id`) nel form era **puramente visivo** — `createQualification`/`updateQualification` non lo salvavano mai. La funzione `resolvePersonnelForQualification` (già usata correttamente dall'ingest e dal rinnovo) era importata nel controller ma **mai chiamata** dai due percorsi manuali. Un backfill periodico (`personnelQualificationLink.service.js`) compensava il sintomo senza chiudere la causa.
- **Fix**: `resolvePersonnelForQualification` collegata a entrambi i percorsi manuali, con validazione (rifiuta con 400 se `personnel_id` non appartiene all'azienda) e normalizzazione nome/codice coerente con l'ingest.
- **Sistematizzazione** (richiesta esplicita del committente): l'audit manuale è stato reso un test automatico permanente — vedi `docs/GUIDA_CONSOLIDATA.md` sezione dedicata. Il nuovo test ha **già trovato 2 falsi positivi** nell'audit WPQR di ieri (`thickness_test_mm`, `approval_date` — stesso concetto, nome colonna diverso), risolti con alias documentati: prova concreta che il controllo automatico è più affidabile di quello a occhio.

Test: `qualifications.controller.test.js` (+5 test collegamento anagrafica), `welding.controller.manualFieldsCompleteness.test.js`, `qualifications.controller.manualFieldsCompleteness.test.js` (5 test totali, 4 schemi). Nessuna migrazione (colonna `personnel_id` già esistente).

## Aggiornamento 08/08/2026 (quater) — verifica procedura superadmin "Rielaborazioni disponibili"

Su richiesta del committente, verificata l'esistenza e il funzionamento del pannello superadmin che permette di recuperare, sui documenti già ingeriti PRIMA di un fix, i campi aggiunti successivamente all'estrazione AI (senza richiedere il ricaricamento del PDF). Confermato: esiste (`GET/POST /admin/reprocess-tasks`, protetto `superadminOnly`, UI in `BillingDashboardPage.jsx`), architettura solida (mai scrittura diretta — sempre una proposta in coda di revisione).

**Gap trovati:**

| Gap | Stato |
|---|---|
| Registro copriva solo 6 campi delle Qualifiche (26/07-01/08), non `thickness_max_unlimited` (fix precedente) | **Chiuso**: nuova voce nel registro, con `candidateWhere`/`writeGuard` dedicati (la colonna è `BIT NOT NULL DEFAULT 0`, diversa dagli altri campi nullable — la condizione standard "colonna IS NULL" non si applicherebbe mai) |
| Nessun equivalente per la WPQR — l'intero meccanismo è scritto solo per `qualifications` | **Aperto, non chiuso in autonomia**: è una capacità nuova (generalizzare il registro a più tabelle), non un fix — richiede una decisione di prodotto (stesso pannello o separato) prima di essere costruita. Significa che nessuno dei campi WPQR corretti in questa sessione (`preheat_temp`, `interpass_temp`, `throat_test_mm`, `product_type`, `rotated_position`, `thickness_max_unlimited`) è recuperabile sulle WPQR già caricate senza ricaricare il PDF |
| Due registri duplicati a mano (`reprocessableFields.js` + `REPROCESSABLE_FIELDS` in `qualificationIngest.service.js`) senza controllo di sincronia automatico | **Chiuso**: nuovo test `reprocessableFields.test.js` verifica che le due liste abbiano sempre le stesse chiavi |
| `personnel_id`: nessun'azione necessaria — esiste già un percorso di recupero separato e funzionante (pulsante "Collega anagrafica" in `CompanyPersonnelPanel.jsx`, basato su corrispondenza nome) | Nessun gap |
| Logica core del servizio di rielaborazione (`qualificationReprocess.service.js`) priva di test diretti (solo test del controller con servizio mockato) | **Chiuso**: nuovo `qualificationReprocess.service.test.js` |

## Aggiornamento 08/08/2026 (quinquies) — meccanismo di rielaborazione generalizzato alla WPQR

Su richiesta esplicita del committente, il meccanismo "Rielaborazioni disponibili" (prima solo `qualifications`) è stato generalizzato per supportare anche `wpqr_records`, chiudendo il gap segnalato in precedenza in questo stesso documento.

**Architettura** (nessuna duplicazione di logica, stesso principio "mai scrittura diretta" già esistente):

| Componente | Ruolo |
|---|---|
| Migrazione **143** | Colonna `ingest_staging.target_wpqr_id` + FK a `wpqr_records(id)` — stesso pattern esatto di `target_qualification_id` (migrazione 137), non una FK polimorfica |
| `wpqrIngest.service.js` — `WPQR_REPROCESSABLE_FIELDS` + `applyFieldReprocessUpdate` | Whitelist di scrittura + funzione di UPDATE mirato per WPQR, mirror esatto del pattern già usato per le Qualifiche |
| `reprocessTableAdapters.js` (nuovo) | Specificità per tabella: colonne da selezionare, come determinare il `docType`, quale mapper AI→reviewFields riusare (mai duplicato) |
| `reprocessableFields.js` | 6 nuove voci (`preheat_temp`, `interpass_temp`, `throat_test_mm`, `product_type`, `rotated_position`, `wpqr_thickness_max_unlimited` — quest'ultima prefissata per non collidere con l'omonima voce delle Qualifiche nel registro condiviso) |
| `qualificationReprocess.service.js` | Generalizzato per essere table-aware (nome file invariato per non rompere gli import esistenti) |
| `ingestStaging.service.js`/`.controller.js` | Dispatch su `target_wpqr_id`, preservazione file, filtro `?module=saldatura` |
| `ReprocessQueueBanner.jsx` | Parametrizzato con prop `module`, montato anche in `WeldingProceduresPage.jsx` |
| `BillingDashboardPage.jsx` | Nessuna modifica strutturale necessaria — il pannello "Rielaborazioni disponibili" è già generico, elenca qualsiasi voce del registro indipendentemente dalla tabella |

**Decisioni normative applicate ai filtri candidati** (criteri di sviluppo robusto, non solo tecnici):
- `throat_test_mm`: `jointTypeWhitelist: ['FW']` — la gola è una variabile qualificata solo sui giunti d'angolo (Tabella 8), evita chiamate AI inutili sui giunti BW.
- `rotated_position`: `candidateWhere` dedicato — proposto SOLO se testata su piastra E posizione PF/PA dichiarata (ISO 15614-1 §8.3.3), altrove il flag `false` è già corretto, non va rielaborato.
- `wpqr_thickness_max_unlimited`/`rotated_position`: come le Qualifiche, propongono SOLO `true` in fase di estrazione (mai `false`, già il valore di default — riproporlo sarebbe rumore).

Test: 15 test `qualificationReprocess.service.test.js` (7 nuovi WPQR), 4 test sincronia registro (estesi a 2 tabelle), 2 nuovi test `ingestStaging.service.test.js`, nuovo `ingestStaging.controller.test.js` (7 test, prima assente), 3 test frontend `reprocessQueueBanner.test.jsx` (prima assente). Suite completa invariata rispetto al baseline (backend: 2 falliti pre-esistenti noti; frontend: 1003/1003 verdi, build OK).

## Testo normativo di riferimento — Tabella 8 (ISO 15614-1:2017, §8.3.2.2, pag. 31 del documento digitalizzato)

> "Table 8 — For level 2: Range of qualification for material thickness and throat thickness of fillet welds [...] Thickness of test piece t | Throat thickness | Material thickness (single run / multi-run) [...] t ≤ 3: 0,7 t to 2 t | 0,75 a to 1,5 a | No restriction [...] 3 < t < 30: 3 to 2 t [...] t ≥ 30: ≥5 [...] NOTE a is the nominal throat thickness as specified in pWPS for the test piece."

Conferma le due direzioni: (1) spessore provino → range gola [implementata in `checkThroatCoverage`], (2) gola nominale provino "a" → range spessore materiale [non implementata, backlog].

## Deploy produzione (07/08/2026, stessa sessione)

Migrazioni **140** (qualifications.thickness_max_unlimited — già su `main`, non ancora applicata in produzione) e **141** (wpqr_records.preheat_temp/interpass_temp/throat_test_mm — PR #357) applicate su VPS con `backend/scripts/run-migration-140-vps.js`/`run-migration-141-vps.js`, colonne verificate. Deploy backend completo (`backend/scripts/deploy-to-vps.sh`, manifest invariato — tutti i file toccati erano già presenti) — PID riavviato, health API 200, smoke `npm run smoke:deploy` OK, endpoint `qualifications`/`welding/wpqr` rispondono 401 (nessun crash). Nota: il deploy segnala `deploy_norm_upload_route_MISSING` — falso positivo del grep di sanità dello script (cerca `normUpload.routes.js` letterale, il require reale è `normUpload.routes` senza estensione), non un problema reale, verificato con `grep` diretto sul `server.js` remoto.
