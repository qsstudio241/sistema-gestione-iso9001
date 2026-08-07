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
