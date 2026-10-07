# DEPUTYTASK_VERIFICA_WPQR_CORE — WV-1: dominio `wpqr` nell'engine di verifica + vista record WPQR + stub dei pack (modulo puro, non agganciato)

**Stato:** APERTO — lanciabile **solo dopo il merge su `origin/main`** della PR di charting (gate DEPUTYTASK: `git show origin/main:docs/agent-tasks/DEPUTYTASK_VERIFICA_WPQR_CORE.md` deve mostrare `APERTO`)  
**Aperto:** 07/10/2026  
**Piano:** [`PLAN_VERIFICA_WPQR_SLICES.md`](PLAN_VERIFICA_WPQR_SLICES.md) § 1 (architettura) · § 6.3 WV-1  
**Dipende da:** nessuna (onda 1; il contratto `Finding` è già su `main`)  
**Rischio:** **Medio** — BE additivo, modulo non agganciato a nessun flusso, nessuna migrazione, nessuna route. Diventa **Alto** (stop + conferma) se per farlo quadrare serve cambiare il contratto `Finding`, il comportamento di `verifyQualification`, ingest, controller, Rielaborazioni, `auth.middleware`, sync o schema.  
**Stream:** `DEPUTYTASK_VERIFICA_WPQR_*.md` (epic verifica e archiviazione dati di prova WPQR; non riusare questo file per altri epic)  
**Branch suggerito:** `cursor/wv-1-core-<suffisso>`  
**Contesto consigliato:** default/basso (non 1M)

---

## Obiettivo (una slice = un risultato verificabile)

Esiste `verifyWpqr(recordOrFields, { mode })` in `backend/src/services/qualificationVerify/`: **puro** (nessun DB, nessun `fs`), restituisce un `VerifyResult` valido (con il campo additivo `domain: 'wpqr'`) **anche con tutti i pack vuoti**: profilo risolto (`15614-1:BW`, `15614-1:FW`, `15614-1:UNKNOWN`, `15614-2:BW`, `15614-2:FW`, `14555:SW`), `summary` a zero; norma/edizione non coperta → un solo finding `non_verificabile_fonte_mancante`; ISO 15613 senza parte 15614 dichiarata → un solo finding informativo `non_verificabile_dato_mancante`. La slice estrae la **pipeline condivisa** dell'engine (vista → profilo → regole del registry → ordinamento → summary) **senza cambiare il comportamento di `verifyQualification`**, e crea i **quattro file pack come stub** (`rules: []`) più l'elenco esplicito in `registerDefaultPacks.js`, così le slice dell'onda 2 sovrascrivono ciascuna solo il proprio pack.

Non agganciare nulla: nessuna chiamata dall'ingest, nessuna route, nessuna voce Rielaborazioni (sono WV-5c).

## Gate norme (dichiarato)

La slice **non codifica soglie né clausole**: definisce il contenitore e la risoluzione del profilo. Dichiarazione:

- **Coperte:** ISO 15614-1:2017 e 2017+A1:2019 (`NORMA_00043`), ISO 15614-2:2025 (`NORMA_00031`), ISO 14555:2025 (`NORMA_00033`) per la sola **risoluzione di standard/edizione/profilo/livello**; ISO 15613:2025 (`NORMA_00045` §8: rinvio alla parte 15614 di Tabella 2).
- **Mancanti:** edizioni legacy (15614-1:2004+A2:2012, 15614-2:2005), ISO 15614-3/-5/-6/-8/-10/-11/-12/-13. Nel core diventano **`non_verificabile_fonte_mancante`**, mai una regola.
- **Si parte su:** contratto invariato + dominio `wpqr`; nessuna clausola nuova. Livello 15614-1: dichiarato sul certificato, **default Level 2** se assente (National foreword di `NORMA_00043`).

## Checklist dato ↔ norma ↔ UI ↔ API

| Dato | Clausola / fonte MD | UI | API / persistenza |
|------|---------------------|----|-------------------|
| `VerifyResult.domain` (additivo) | — (contenitore) | consumato da WV-6b | nessuna in questa slice (route in WV-5c) · **nessuna persistenza** |
| Profilo (`15614-1:BW/FW/UNKNOWN`, `15614-2:BW/FW`, `14555:SW`) | partizione BW/FW da `joint_type` (già in `wpqr_records`); stud da `standard_reference` / `qualifying_element` | — | — |
| Livello 1/2 (15614-1) | National foreword `NORMA_00043`; `qualification_level` | — | `qualification_level` già in DB (mig. 133) |
| Norma/edizione non coperta; 15613 senza parte | assenza di fonte MD (piano § 4) | riga informativa nel pannello | `non_verificabile_fonte_mancante` / `…_dato_mancante`, un solo finding |
| Qualifica 15613 con range secondo una parte 15614 (`range_standard_reference`) | 15613 §8 (rinvio ai range della parte 15614 di Tab. 2); `range_standard_reference`: da campione, nessuna clausola (1/10) | — | la vista usa la parte dichiarata per il profilo; assente → un solo finding informativo come sopra |
| Polarità per riga con ripiego su `current_type`; apporto termico e avanzamento come valore + unità lette; `heat_input_kind` assente; esiti non canonici (`Not required`, `--`, `N.A.`) | §8.4.6 (corrente/polarità), §8.4.7 (apporto: «kind documented»); esiti e unità: da campione, nessuna clausola (piano «Evidenze dal campione») | — | solo vista in memoria: **nessuna scrittura**, nessun nuovo campo persistito |

Nessuna nuova colonna. Nessun campo AI-estraibile nuovo.

## File previsti

- *Nuovi* `backend/src/services/qualificationVerify/{wpqrRecordView,verifyWpqr}.js` + i relativi `*.test.js`
- *Modificati* `backend/src/services/qualificationVerify/{verifyEngine,registerDefaultPacks,index}.js` (`verifyEngine`: **solo** estrazione della pipeline condivisa; `index`: export `verifyWpqr`)
- *Nuovi (stub, `rules: []`)* `backend/src/services/qualificationVerify/packs/{wpqrCompleteness,wpqr15614_1Correctness,wpqr15614_2Correctness,wpqr14555Correctness}.pack.js` (`standardFamily` `15614-1` / `15614-2` / `14555`, `editions` e `profiles` dichiarati)
- *Modificato* `backend/scripts/deploy-manifest.json` (**solo** le righe dei file nuovi)
- *Modificato* `PROJECT_CONTEXT.md` (una riga bussola «WPQR — verifica vs norma» con i path in backtick; poi `node backend/scripts/check-harness-boot.js` verde)
- Solo lettura/riuso: `findingTypes.js`, `verifyRegistry.js`, `qualificationRecordView.js` (parità di stile), `backend/src/data/weldingQualificationRules15614*.js`, `weldingQualificationRules14555.js` (`isIso14555`, `isIso15614Part2`), `backend/src/services/wpqrIngest.service.js` (solo lettura dei nomi dei review-fields e delle colonne)

## Cosa NON toccare

`wpqrIngest.service.js`, `ingestPlausibilityChecks.js`, qualsiasi controller/route, `findingTypes.js` (nessun cambio di contratto), `verifyRegistry.js` salvo evidenza nel test che serva, pack 9606 / `operator14732`, `weldingQualificationRules*`, `reprocessableFields.js` e tutta la Rielaborazioni, qualsiasi file `app/` (FE), `database/migrations/**`, `PLAN_*`, GUIDA, `PROJECT_ROADMAP.md`.

## Cosa fare

1. `verifyEngine.js`: estrarre dalla funzione `verifyQualification` la parte indipendente dal dominio (copertura standard → profilo → regole → ordinamento → summary) in una funzione interna riusabile; `verifyQualification` la chiama con la sua vista e **produce lo stesso output di oggi** (aggiungere `domain: 'qualification'` al risultato; tutti i test esistenti restano verdi **senza modifiche**).
2. `wpqrRecordView.js`: `toWpqrView(input, {source:'review'|'db'})` normalizza **review-fields** dell'ingest WPQR (`mapPipelineFieldsToReview`: `welding_process`, `thickness_tested`, `thickness_min/max`, `diameter_min/max`, `welding_positions`, `preheat_temp`, `interpass_temp`, `current_type`, `metal_transfer`, `heat_input_note`, `qualification_level`, `joint_type`, `standard_reference`, …) e **riga DB** `wpqr_records` + array opzionale `runs` (da `wpqr_test_runs`, assente = `[]`, colonne assenti = `null`) in un'unica vista canonica; risolve `standard` (famiglia 15614-1 / 15614-2 / 14555 / 15613 + edizione da `standard_reference`), `level` (default 2) e `profile`.
   **Normalizzazione solo in memoria** (dati PROD 07/10/2026: grafie non canoniche di `standard_reference` con edizione, `current_type` DC-EP/DCEP e designazione del filler): la vista produce valori canonici per il confronto e **non riscrive mai** il dato né emette scritture. **Evidenze dal campione di 10 certificati (07/10/2026, piano «Evidenze dal campione») che la vista deve gestire**: (a) **polarità per riga** assente in 3/10 (layout C) → la vista espone per ogni passata la polarità della riga **con ripiego su `current_type` di testata** (e segnala la provenienza), così `COMP.RUN_FIELDS` di WV-5a non dà un falso `warn`; (b) `runs` con `heat_input_value`+`heat_input_unit` e `travel_speed`+`travel_speed_unit` **come lette** (`kJ/mm`, `J/mm`, `kJ/cm`; `mm/s`, `cm/min`): la conversione in kJ/mm esiste solo nella vista, mai riscritta; (c) `heat_input_kind` assente (6/10) = «non dichiarato», non errore; (d) `wire_feed_speed` assente = normale (0/18), mai dato mancante; (e) valore di prova `preheat_temp_test`/`interpass_temp_test` con ripiego sul testo `preheat_temp`/`interpass_temp` per i record senza le colonne nuove; (f) esiti `*_result` non canonici (`Not required`, `--`, `N.A.`) letti come `NA`, **mai `KO` dedotto**; (g) `range_standard_reference`, se presente, risolve il profilo di un record 15613. Chiavi nuove assenti = `null` (la vista è tollerante alle colonne non ancora migrate). Le **severità** delle regole di completezza (polarità con ripiego, `COMP.HEAT_INPUT_KIND` `info`, velocità filo mai `warn`, preheat/interpass di prova) sono in piano § 5.1 e **non** si codificano in questa slice (WV-5a). `pwht` è un bit con default 0 (mai «non rilevato») e `product_type` può essere NULL: in questi casi la vista segnala «dato non determinabile» (poi `non_verificabile_dato_mancante` nelle slice 5), mai `warn`. Il default Level 2 (National foreword di `NORMA_00043`) resta, ma la vista espone `level_declared: boolean` per il finding `COMP.LEVEL` di WV-5a.
3. `verifyWpqr.js`: `verifyWpqr(input, {mode})` → `VerifyResult` con `domain: 'wpqr'`; **nessun `if (15614)`**: dispatch solo via registry.
4. Quattro stub pack + elenco esplicito in `registerDefaultPacks.js` (stile esistente). I codici dei finding saranno prefissati `WPQR15614_1.*`, `WPQR15614_2.*`, `WPQR14555.*` (unici globalmente).
5. `deploy-manifest.json`: righe per ogni `.js` nuovo sotto `backend/src/`.
6. `PROJECT_CONTEXT.md`: una riga nella bussola (path reali in backtick).

## Test L1

Comandi: `cd backend && npx jest src/services/qualificationVerify` · repo: `node backend/scripts/check-harness-boot.js` e `node backend/scripts/check-utf8-encoding.js`.

- **Non regressione**: tutti i test esistenti di `verifyEngine`, `verifyRegistry`, `findingTypes`, pack 9606/14732, `verifyReprocess`, `verifyRecordLoader` verdi **senza modificarli**.
- Vista WPQR: parità review-fields ↔ riga DB (stessi valori canonici da ingresso diverso); input non mutato (normalizzazione in memoria); `runs` assenti/vuoti/presenti; livello default 2; tabella `standard_reference` → profilo (15614-1 BW/FW/UNKNOWN, 15614-2, 14555 stud, 15613, edizioni legacy, norma sconosciuta).
- Engine: pack stub → `findings` vuoto per norma coperta, `summary` zero; edizione legacy / norma non coperta → un solo `non_verificabile_fonte_mancante`; 15613 senza parte → un solo `non_verificabile_dato_mancante`; regola che lancia → `RULE_ERROR`; `code` duplicato → errore di registrazione.
- Strutturali: nessun import di `config/database`, `fs`, `createStagingRecord`; **ogni `*.pack.js` è in `registerDefaultPacks.js` e in `deploy-manifest.json`** (il test esistente copre anche i nuovi stub).

## Rielaborazioni (Registro)

**Esenzione dichiarata:** nessun campo AI-estraibile, nessuna colonna, nessun valore persistito. Le voci `verify_wpqr_*` nascono in **WV-5c**.

## DoD

- [ ] `verifyWpqr` esiste, puro, valido con pack stub; `domain: 'wpqr'`; `engine_version` presente
- [ ] Pipeline condivisa estratta; **`verifyQualification` invariato** (test esistenti verdi senza modifiche)
- [ ] `wpqrRecordView` converte review-fields e riga DB (+ `runs`) con test di parità; livello default 2 con `level_declared`; normalizzazione solo in memoria (test: input con `DC-EP`/`DCEP`, edizione in `standard_reference`; il dato in ingresso non viene mutato); `pwht`/`product_type` NULL → dato non determinabile
- [ ] Vista e campione 07/10/2026: test con review-fields **sintetici in linea** (non i `.txt` di WV-4b) che coprono polarità per riga assente → ripiego su `current_type`, unità `kJ/mm`/`J/mm`/`kJ/cm` e `mm/s`/`cm/min` conservate, `heat_input_kind` assente, `wire_feed_speed` assente, esiti non canonici → `NA`, qualifica 15613 con `range_standard_reference` → profilo 15614-1
- [ ] Quattro stub pack + `registerDefaultPacks.js`; test «pack ⇄ registerDefaultPacks ⇄ deploy-manifest» verde
- [ ] Test strutturale «nessun import DB/fs / nessuna scrittura» nel modulo
- [ ] Riga bussola in `PROJECT_CONTEXT.md` e `check-harness-boot.js` verde; `check-utf8-encoding.js` verde
- [ ] `cd backend && npx jest src/services/qualificationVerify` verde; **nessun file FE, nessuna route, nessuna migrazione** nel diff
- [ ] Branch allineato a `origin/main` (`git fetch origin main && git merge origin/main`) prima di push/PR; `bugbot run` **una sola volta** a slice chiusa (Bugbot letto prima di «pronta»; Security Review se presente)

## HITL

Nessuno bloccante. Se il contratto o l'engine si rivelano inadeguati al dominio WPQR → **stop**, handoff nel brief, aggiornamento del PLAN (contract review): è l'unico punto che sblocca l'onda 2 in parallelo.

## Comando di avvio

`Leggi docs/agent-tasks/DEPUTYTASK_VERIFICA_WPQR_CORE.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Handoff

_(vuoto)_
