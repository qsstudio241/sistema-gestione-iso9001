# DEPUTYTASK_VERIFICA_QUALIFICHE_CORE — VQ-1: contratto Finding + registry + engine + vista record + stub dei pack (modulo puro, non agganciato)

**Stato:** CHIUSO — TEST OK (06/10/2026, mergiata [#718](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/718))  
**Aperto:** 06/10/2026  
**Piano:** [`PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md`](PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md) § 1 (architettura) · § 6.3 VQ-1  
**Dipende da:** nessuna (onda 1)  
**Rischio:** **Medio** — BE additivo, modulo non agganciato a nessun flusso, nessuna migrazione, nessuna route. Diventa **Alto** (stop + conferma) se per farlo quadrare serve toccare ingest, controller, Rielaborazioni, `auth.middleware`, sync o schema.  
**Stream:** `DEPUTYTASK_VERIFICA_QUALIFICHE_*.md` (epic verifica qualifiche vs norma; non riusare questo file per altri epic)  
**Branch suggerito:** `cursor/vq-1-core-<suffisso>`  
**Contesto consigliato:** default/basso (non 1M)

---

## Obiettivo (una slice = un risultato verificabile)

Esiste `verifyQualification(recordOrFields, { mode })` in `backend/src/services/qualificationVerify/`: **puro** (nessun DB, nessun `fs`), restituisce un `VerifyResult` valido secondo il contratto congelato nel piano (§ 1.3) **anche con tutti i pack vuoti**: profilo risolto, `summary` a zero, edizione/norma non coperta → un solo finding `non_verificabile_fonte_mancante`. La slice crea anche i **quattro file pack come stub** (`rules: []`) e l'elenco esplicito `registerDefaultPacks.js`, così le slice dell'onda 2–3 sovrascrivono **ciascuna solo il proprio pack** e non toccano il registro condiviso.

Non agganciare nulla: nessuna chiamata dall'ingest, nessuna route, nessuna voce Rielaborazioni (sono VQ-7 e VQ-8).

## Gate norme (dichiarato)

La slice **non codifica soglie né clausole**: definisce solo il contenitore. Non è norm-touching in senso stretto (nessuna regola). Dichiarazione:

- **Coperte:** ISO 9606-1:2017 (edizioni 2017/2013/2012: stesso testo) per la sola **risoluzione del profilo**; il testo delle regole arriva in VQ-5/VQ-6.
- **Mancanti:** tutto ciò che il piano elenca in § 3 (14732 integrale, EN 287-1, Tab. 3/4/5/11/12, TR 15608/CR 15608, 6947, 9606-3/-4/-5). Nel core diventano **`non_verificabile_fonte_mancante`**, mai una regola.
- **Si parte su:** contratto + engine; nessuna clausola nuova.

## Checklist dato ↔ norma ↔ UI ↔ API

| Dato | Clausola / fonte MD | UI | API / persistenza |
|------|---------------------|----|-------------------|
| `Finding` / `VerifyResult` (contratto § 1.3) | — (contenitore; le clausole nascono nei pack) | consumato da VQ-2 (`QualificationVerifyPanel`) | nessuna in questa slice (route in VQ-7) · **nessuna persistenza** |
| Profilo (`9606-1:BW`, `9606-1:FW`, `9606-1:UNKNOWN`, `9606-2:BW`, `9606-2:FW`, `14732`) | partizione già in `jointTypeProfiles.js` (`uses9606DimensionalBlock`) | — | — |
| Norma/edizione non coperta (EN 287-1, 9606-1:2004, …) | assenza di fonte MD (piano § 3) | riga informativa nel pannello | `non_verificabile_fonte_mancante`, un solo finding per record |

Nessuna nuova colonna. Nessun campo AI-estraibile nuovo.

## File previsti

- *Nuovi* `backend/src/services/qualificationVerify/{findingTypes,qualificationRecordView,verifyRegistry,verifyEngine,registerDefaultPacks,index}.js` + i relativi `*.test.js`
- *Nuovi (stub, `rules: []`)* `backend/src/services/qualificationVerify/packs/{welder9606Completeness,welder9606Correctness,welder9606Part2,operator14732}.pack.js`
- *Modificato* `backend/scripts/deploy-manifest.json` (**solo** le righe dei file nuovi)
- *Modificato* `PROJECT_CONTEXT.md` (una riga bussola «Qualifiche — verifica vs norma» con i path in backtick; poi `node backend/scripts/check-harness-boot.js` verde)
- Solo lettura/riuso: `backend/src/data/jointTypeProfiles.js` (parità di partizione `uses9606DimensionalBlock`), `backend/src/data/weldingQualificationRules9606.js`, `backend/src/services/capabilityCoverage/{coverageRegistry,registerDefaultAdapters}.js` (stesso schema), `backend/src/utils/weldingDesignation.js`

## Cosa NON toccare

`qualificationIngest.service.js`, `ingestPlausibilityChecks.js`, qualsiasi controller/route, `weldingQualificationRules9606.js`, `jointTypeProfiles.js` (solo import), `capabilityCoverage/**`, `reprocessableFields.js` e tutta la Rielaborazioni, qualsiasi file `app/` (FE), `database/migrations/**`, `PLAN_*`, GUIDA, `PROJECT_ROADMAP.md`.

## Cosa fare

1. `findingTypes.js`: costanti (`FAMILY`, `SEVERITY = {info, warn}`, `STATUS`, `DIRECTION`, `TEXT_STATUS`), `makeFinding(partial)` (campi opzionali con default `null`/`[]`), `validateFinding(f)` → `{ok, errors[]}` con le 7 invarianti del piano § 1.3 (nessun `blocking`/`error`; `verificabile` ⇒ `source.clause` + `text_status ≠ assente`; non verificabile ⇒ `info`; `message_it` cita la clausola se `verificabile`; `code` unico nel registry; nessun export di funzioni di scrittura).
2. `qualificationRecordView.js`: `toRecordView(input, {source:'review'|'db'})` normalizza **review-fields** dell'ingest (`welding_positions`, `welding_position`, `pipe_diameter_min/max`, …) e **riga DB** (`position_range`, …) in un'unica vista canonica; risolve `standard` (famiglia + edizione da `standard_reference`/`qualification_type`) e `profile`. La partizione dei profili 9606 deve coincidere con `uses9606DimensionalBlock` (test di parità su una tabella di `qualification_type`).
3. `verifyRegistry.js`: `registerRulePack(pack)` (valida forma: `{id, standardFamily, profiles[], rules[]}`, ogni regola `{id, family, run(view) → Finding[]}`), `listRulePacks()`, `resolveProfileKey(view)`; chiavi duplicate = errore.
4. `verifyEngine.js`: `verifyQualification(input, {mode})`: costruisce la vista, risolve il profilo, esegue le regole dei pack del profilo **catturando le eccezioni** (→ finding `info` `…ENGINE.RULE_ERROR`), ordina (warn prima di info; completezza prima di correttezza), calcola `summary`, imposta `engine_version`, `mode`. Se norma/edizione non coperta → un solo finding `non_verificabile_fonte_mancante` con `source.text_status: 'assente'`. L'engine **non** contiene `if (9606)`: dispatch solo via registry.
5. `registerDefaultPacks.js`: elenco **esplicito** dei quattro pack (stile `registerDefaultAdapters.js`); i pack stub esportano `{id, standardFamily, profiles, rules: []}`.
6. `index.js`: espone `verifyQualification`, `validateFinding`, `listRulePacks`.
7. `deploy-manifest.json`: righe per ogni `.js` nuovo sotto `backend/src/`.
8. `PROJECT_CONTEXT.md`: una riga nella bussola (path reali in backtick).

## Test L1

Comandi: `cd backend && npx jest src/services/qualificationVerify` · repo: `node backend/scripts/check-harness-boot.js` e `node backend/scripts/check-utf8-encoding.js`.

- Contratto: `validateFinding` accetta/rifiuta ognuna delle 7 invarianti; **test che itera tutti i pack registrati** (oggi vuoti, resta valido per i pack futuri) e valida ogni finding prodotto da fixture minime.
- Vista record: parità review-fields ↔ riga DB (stessi valori canonici da ingresso diverso); tabella `qualification_type` → profilo, con parità rispetto a `uses9606DimensionalBlock`.
- Engine: pack vuoti → `findings` vuoto per norma coperta, `summary` zero; EN 287-1 / 9606-1:2004 / norma sconosciuta → un solo finding `non_verificabile_fonte_mancante`; regola che lancia → finding `info` `RULE_ERROR`, nessuna eccezione propagata; ordinamento stabile; `code` duplicato → errore di registrazione.
- Strutturali: nessun import di `config/database`, `fs`, `createStagingRecord` nel modulo puro; **ogni `*.pack.js` è elencato in `registerDefaultPacks.js` e in `deploy-manifest.json`** (il test fallisce se manca).

## Rielaborazioni (Registro)

**Esenzione dichiarata:** nessun campo AI-estraibile, nessuna colonna, nessun valore persistito. La voce `verify_9606_1` nasce in **VQ-8**, non qui.

## DoD

- [ ] `verifyQualification` esiste, puro, valido con pack vuoti; `engine_version` presente
- [ ] `validateFinding` con le 7 invarianti + test di contratto che itera i pack registrati
- [ ] `qualificationRecordView` converte review-fields e riga DB con test di parità; profilo con parità su `uses9606DimensionalBlock`
- [ ] Quattro stub pack + `registerDefaultPacks.js`; test «pack ⇄ registerDefaultPacks ⇄ deploy-manifest»
- [ ] Test strutturale «nessun import DB/fs / nessuna scrittura» nel modulo
- [ ] Riga bussola in `PROJECT_CONTEXT.md` e `check-harness-boot.js` verde; `check-utf8-encoding.js` verde
- [ ] `cd backend && npx jest src/services/qualificationVerify` verde; **nessun file FE, nessuna route, nessuna migrazione** nel diff
- [ ] Branch allineato a `origin/main` (`git fetch origin main && git merge origin/main`) prima di push/PR; `bugbot run` **una sola volta** a slice chiusa (Bugbot letto prima di «pronta»; Security Review se presente)

## HITL

Nessuno bloccante. Se il contratto del piano si rivela inadeguato → **stop**, handoff nel brief, aggiornamento del PLAN (contract review) prima di proseguire: il contratto è l'unico punto che sblocca le onde 2–3 in parallelo.

## Comando di avvio

`Leggi docs/agent-tasks/DEPUTYTASK_VERIFICA_QUALIFICHE_CORE.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Handoff

_(vuoto)_
