# Piano slice — Verifica e archiviazione dati di prova WPQR

> **Destinazione**: mentre si legge una WPQR (ISO 15614-1, 15614-2, 14555; 15613 solo come rinvio) il sistema (a) **archivia in modo strutturato** i dati di prova della seconda pagina (passate: corrente, tensione, polarità, velocità filo e avanzamento, apporto termico, diametro del filler, trasferimento; condizioni di prova; esiti) e (b) li **confronta con la norma in entrambi i versi** — *completezza* (i dati che la norma pretende sul certificato ci sono?) e *correttezza* (dalla prova dichiarata, la validità ricalcolata coincide con quella scritta?) — con **avvisi non bloccanti che citano la clausola**. La conferma resta sempre umana. Gli stessi dati strutturati **alimentano la bozza WPS** discendente (parametri reali di prova invece di un solo campo testo).
> **Principio guida**: *la validità scritta sul certificato prevale* (come per le qualifiche saldatori). Il ricalcolo segnala, non sostituisce e non riscrive mai un dato.
> **Riuso**: stesso motore, stesso contratto `Finding`, stessa voce Rielaborazioni `kind:'verify'` dell'epic qualifiche (VQ-1…VQ-10 su `main`: [`PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md`](PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md), PR #732/#733). Quel piano escludeva esplicitamente la WPQR («epic separato»): questo è l'epic separato.
> **Spec / fonti**: [`PLAN_RIUNIONE_2026-10-03.md`](PLAN_RIUNIONE_2026-10-03.md) § 2 · [`ISO-15614-1-range-validita-WPQR.md`](../reference/ISO-15614-1-range-validita-WPQR.md) · [`ISO-15614-2-range-validita-WPQR.md`](../reference/ISO-15614-2-range-validita-WPQR.md) · [`ISO-14555-2025-range-validita-WPQR.md`](../reference/ISO-14555-2025-range-validita-WPQR.md) · [`ISO-15609-WPS-contenuto.md`](../reference/ISO-15609-WPS-contenuto.md) · [`ISO-15613-qualifica-pre-produzione.md`](../reference/ISO-15613-qualifica-pre-produzione.md) · [`GAP_WPQR_ESTENSIONI_ANNEX_B_2026-08-07.md`](../gap-reports/GAP_WPQR_ESTENSIONI_ANNEX_B_2026-08-07.md) · [`MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md`](../specs/MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md)
> **Brief attivi**: nessuno finché questa PR non è su `main`. I quattro brief della **prima onda** ([`CORE`](DEPUTYTASK_VERIFICA_WPQR_CORE.md), [`NORME_DOC`](DEPUTYTASK_VERIFICA_WPQR_NORME_DOC.md), [`DATI`](DEPUTYTASK_VERIFICA_WPQR_DATI.md), [`EDITOR_FE`](DEPUTYTASK_VERIFICA_WPQR_EDITOR_FE.md)) sono scritti con `Stato: APERTO` ma diventano **lanciabili solo dopo il merge di questa PR su `origin/main`** (gate convenzione DEPUTYTASK: `git show origin/main:docs/agent-tasks/<file>` deve mostrare `APERTO`). Al momento della stesura nessun altro `DEPUTYTASK*` risulta APERTO oltre a questi (i brief `DEPUTYTASK_VERIFICA_QUALIFICHE_*` sono CHIUSI).
> **Tipo di sessione**: charting (Lead, 07/10/2026). Nessun codice di prodotto, nessuna migrazione, in questa PR.

## Fuori scope

- Blocchi, rifiuti o correzioni automatiche di una WPQR: gli esiti sono **sempre** avvisi (`info` / `warn`); salvataggio, approvazione e uso in copertura/WPS non dipendono dall'esito.
- Sostituire o riscrivere `thickness_min/max`, `diameter_min/max`, `welding_positions`, `preheat_temp`, … con il valore ricalcolato (validità batte ricalcolo).
- Modi (a)/(b) del generatore WPS decisi il 03/10 (menu WPQR + pochi parametri; filtri progressivi fino a una WPQR): sono la «seconda fetta» di `PLAN_RIUNIONE_2026-10-03.md` § 2, **non** parte di questo epic. Qui si prepara il **dato** (passate strutturate) e si fa leggere alla bozza WPS esistente; l'interfaccia dei modi resta un epic successivo che *consuma* questi dati.
- Multiprocesso 111+135 (range combinati) e saldatura prigionieri lato operatore 14732: dopo i modi (a)/(b) (riunione 03/10). Il modello dati ammette un processo **per passata**, ma nessuna regola di range combinato si scrive qui.
- Esiti **quantitativi** di prova (Re, Rm, A %, Z %, energia di resilienza in J, HV10 per punto): non servono né alla verifica né alla WPS; restano gli esiti `OK/KO/NA` già presenti (`vt_result … macro_result`). Struttura proposta per un'eventuale fase B in § 2.5, **non** pianificata (D5).
- Edizioni legacy (ISO 15614-1:2004+A2:2012, ISO 15614-2:2005, EN ISO 15613:2004): `non_verificabile_fonte_mancante`, non regole.
- ISO 15614-3/-5/-6/-8/-10/-11/-12/-13 (ghise, titanio, rame, tubo-piastra, iperbarica, fascio, resistenza): fuori; nel registry compaiono come `non_verificabile_fonte_mancante` informativo (l'elenco è nella Tabella 2 di `NORMA_00045`).
- Calcolo ex novo dell'apporto termico da V, A, velocità (formula ISO/TR 18491 con k ISO/TR 17671-1): **fonte mancante** (§ 4), non si codifica.
- Acrobat, JEV, classificatore locale, scheduler automatico (ogni lancio resta manuale).

## Non ancora specificato

- **Quali righe di Annex B sono presenti nella pratica**: i conteggi PROD ci sono (sezione «Dati PROD»: nessun dato di prova strutturato oggi) ma manca ancora la **lettura del campione di WPQR reali** (la seconda pagina dei PDF non è stata letta; dal 07/10/2026 i 10 PDF sono leggibili in sola lettura per test tecnici, vedi HITL 1). Il piano parte dalle norme e dal codice; la **tolleranza** e la severità delle regole sulle passate si tarano sul campione (HITL 1), come per le qualifiche (D2/D6 di quell'epic).
- **Attribuzione «prova» vs «range qualificato»** per preheat/interpass/post-heating: Annex B pag. 1 ha due colonne («Test piece» / «Range of qualification»), il record oggi ha **una** colonna testo (`preheat_temp`, `interpass_temp`). Quale valore finisce lì oggi non è documentato → regole §8.4.8/§8.4.9 **non** codificate finché il campione non lo chiarisce (HITL 1) o non si decide di aggiungere le colonne `*_test` (D4).
- **Attribuzione livello 1 / livello 2 nella frase §8.4.7** sul limite inferiore di apporto termico per la durezza (il Markdown intercala le due colonne): HITL 2, **obbligatorio prima di qualsiasi regola sull'apporto termico**. Il «±25 %» citato in riunione è un esempio, non una soglia.
- **Parametri specifici di processo** (portata gas, diametro ugello, elettrodo di tungsteno, distanza tubo di contatto — ISO 15609-1 §4.5.x): entrano nella WPQR via «gli elementi pertinenti elencati per la WPS» (§9 di 15614-1/-2, §10.4 di 14555) ma **non hanno una riga in Annex B** (solo «Other information*»). Colonne previste come gruppo B opzionale; ingest solo dopo il campione (D3).
- Esito della verifica nei semafori di copertura commessa e nei candidati WPS (come per le qualifiche: D8, **no**).
- Persistenza di una «presa visione» degli avvisi: no (nessuna migrazione dedicata).

## Decisioni già prese (charting 07/10/2026)

- **Stesso motore, dominio `wpqr`** (non un secondo engine): l'engine di `qualificationVerify/` oggi è legato al record qualifica (`toRecordView`, `verifyQualification`); WV-1 estrae la pipeline condivisa (`vista → profilo → regole del registry → ordinamento → summary`) e aggiunge `verifyWpqr` + `wpqrRecordView`. **Finding invariato**; il `VerifyResult` guadagna solo un campo additivo `domain: 'qualification' | 'wpqr'`. Nessun `if (15614)` nell'engine: dispatch solo via registry.
- **Profili** (chiavi registry, distinte da quelle 9606): `15614-1:BW`, `15614-1:FW`, `15614-1:UNKNOWN` (giunto non leggibile: solo regole comuni), `15614-2:BW`, `15614-2:FW`, `14555:SW`. **ISO 15613:2025 non ha un profilo proprio**: il §8 rinvia ai range della «relevant standard» di Tabella 2 e il §10 chiede gli elementi della WPS di quella norma; un record 15613 → finding informativo `non_verificabile_dato_mancante` (quale parte 15614 si applica) o, se la parte è dichiarata, profilo di quella parte. Nessuna soglia 15613 (non ne ha).
- **Edizioni coperte**: 15614-1:2017 e 2017+A1:2019 (`NORMA_00043`, testo operativo; `NORMA_00019` è l'archivio senza A1) · 15614-2:2025 (`NORMA_00031`) · 14555:2025 (`NORMA_00033`). Altre edizioni/norme → un solo finding `non_verificabile_fonte_mancante`.
- **Livello 1/2 (15614-1)**: dichiarato sul certificato, **default Level 2 se assente** (National foreword di `NORMA_00043`: «when no level is specified … all the requirements of Level 2 should be applied»; una prova Level 2 qualifica anche Level 1). Le regole che dipendono da una colonna Level 1 **non leggibile** (Tab. 7 L1, § 4) restano `non_verificabile_fonte_mancante`.
- **Archiviazione**: **tabella figlia `wpqr_test_runs`** (una riga per passata) + **colonne di testata** su `wpqr_records` per le condizioni di prova di pag. 1/2 oggi assenti. Migrazione **additiva, solo colonne/tabella nullable**; i record esistenti non cambiano. Migrazione **170** (oggi: ultimo `169_*`; `DATABASE.md` è stantio — dice 168/169): il numero **non si riserva** qui, lo dichiara il deputy di WV-3 dopo `git fetch` (companion `NNN_verify.sql`/`NNN_rollback.sql`, policy ≥ 169).
- **Stud (ISO 14555)**: nessuna tabella per passata in Annex C (corrente, tempo, sporgenza, alzata; e, per scarica capacitiva, capacità, tensione di carica, gap/lift, forza molla): si usa **la stessa tabella figlia** con colonne stud nullable, 1–2 righe per WPQR. Nessuna tabella separata.
- **Nuovi campi AI-estraibili ⇒ stessa slice crea la voce Rielaborazioni** (vincolo del repo): chiavi con prefisso `wpqr_` (il registro è condiviso con le Qualifiche: `welding_position_test`, `pipe_diameter_test_mm` esistono già lì), whitelist `WPQR_REPROCESSABLE_FIELDS`, `reprocessableFields.test.js`; per la **nuova tabella** `wpqr_test_runs` adapter in `reprocessTableAdapters.js` + entry nel test `WRITE_WHITELISTS_BY_TABLE`. Nuovo campo in `aiExpectedSchema` ⇒ stessa chiave in `WPQR_MANUAL_EDITABLE_FIELDS` **e** nel form React (`manualEditCompletenessCheck.js`). La slice che aggiunge lo schema AI è **la stessa** che porta la voce di backfill.
- **Voce Rielaborazioni di tipo verifica** (sola lettura, nessuna AI, nessun file letto, nessuna scrittura): chiavi `verify_wpqr_15614_1`, `verify_wpqr_15614_2`, `verify_wpqr_14555`; candidato = ≥ 1 finding `warn` con `status = verificabile`; non entra in `total_candidates` (stesso comportamento delle voci `verify_9606_*`).
- **Asimmetria severità** (identica alle qualifiche): validità del certificato **più larga** della norma (`over_claim`) o dato **richiesto dalla norma** assente = `warn`; più stretta (`under_claim`), non essenziale, non verificabile = `info`. `warn` solo con `status = verificabile` e clausola citata.
- **Niente pioggia di avvisi sui record esistenti**: se una WPQR non ha **nessuna** passata archiviata, la verifica sulle passate produce **un solo** finding `info` `non_verificabile_dato_mancante` («dati di prova non archiviati») — non N `warn` di completezza. I `warn` sulle passate scattano solo quando almeno una passata è presente ma incompleta (D3).
- **Riuso delle funzioni pure** (gate Ponytail): `backend/src/data/weldingQualificationRules15614.js` (`computeQualifiedMaterialThicknessRangeLevel2`, `computeQualifiedFilletThroatThicknessRange`, `describeQualifiedPipeDiameterRangeLevel2`, `isDiameterEssentialVariable`, `describePlateCoversPipeDiameterLevel2`, `computeMinimumQualifiedThicknessWithImpactTest`), `weldingQualificationRules15614_2.js`, `weldingQualificationRules14555.js`. La verifica **non ricopia tabelle**. `checkWpqrPlausibility` e `checkThicknessRangeAgainstIso15614Level2` restano per i controlli non normativi; i doppioni si tolgono quando il pack li copre (come fatto per il gas nelle qualifiche, VQ-7).
- **Aggancio come VQ**: estrazione (staging) → `warnings` + oggetto `verification`; review → endpoint stateless al **blur**; commit → ricalcolo sui campi finali; DB esistente → Rielaborazioni `verify`. Nessun cambio di `status` dell'ingest.

## Gate norme (dichiarazione obbligatoria, 3 righe)

```text
Fonti Markdown:
- Coperte (testo leggibile, clausola verificata aprendo il Markdown il 07/10/2026): ISO 15614-1:2017+A1:2019 NORMA_00043 (§9 contenuto WPQR e Annex B modulo; §8.3.2/8.3.3 spessore e diametro; §8.4.1–8.4.11 variabili comuni; §8.5.6 backing gas; Tab. 1/2 prove; Tab. 3 durezza) · ISO 15614-2:2025 NORMA_00031 (§9, Annex A, §8.3.2, §8.4.4–8.4.9; §8.4.6 apporto termico +25 % / +15 % gruppo 23) · ISO 14555:2025 NORMA_00033 (§10.2.8.x range, §10.4 WPQR, Annex C moduli WPS/WPQR) · ISO 15613:2025 NORMA_00045 (§8 rinvio a Tabella 2, §10) · ISO 15609-1:2019 NORMA_00014 (§4.4.8–4.4.17, §4.5.1–4.5.5 elementi della WPS).
- Mancanti: ISO/TR 18491 e ISO/TR 17671-1 (calcolo e k-factor dell'apporto termico: citati da §8.4.7, non digitalizzati) · 15614-1 Tab. 7 colonna Level 1 (cifre iniziali troncate, 5 righe su 7: GAP già dichiarato in `ISO-15614-1-range-validita-WPQR.md`) e Tab. 7 Level 2 oltre 40 mm (non definito) · attribuzione L1/L2 della frase di §8.4.7 sul limite inferiore per durezza e note a/b/c di Tab. 3 (Markdown a colonne intercalate: verifica sul PDF) · 15614-1 Tab. 5/6 (matrici gruppi acciaio/nichel: leggibili ma non codificate, vedi estratto) · 14555 Tabella 1 (il Markdown in Git è quello corretto dall'HITL del 29/08; una nuova digitalizzazione con CLI la reintrodurrebbe invertita: **non** sostituire il file) · soglie 15613 (non ne ha: rinvia ai range 15614) · edizioni legacy (15614-1:2004+A2:2012, 15614-2:2005).
- Si parte su: completezza e correttezza **15614-1 Level 2 BW/FW** (§9 + Annex B + §8.3.2/8.3.3 con le funzioni già in `main`) e **archiviazione** passate per 15614-1/-2/14555 (Annex B/A/C); correttezza su apporto termico e preheat/interpass **dopo** HITL 1–2; 15614-2 e 14555 in seconda battuta sullo stesso contratto.
```

## Dati PROD

> **Fonte**: report di raccolta dati in **sola lettura** (solo `SELECT` / `INFORMATION_SCHEMA`), ambiente **PROD**, rilevazione del **07/10/2026**, 11:59 UTC. Solo aggregati anonimi: il report integrale resta **fuori da Git**. Nessun PDF letto, nessuna WPQR/azienda identificabile. **Dataset piccolo (13 WPQR)**: le percentuali sono ordini di grandezza, non statistica. TEST non interrogato.

**Volume e schema**

| Misura | PROD |
|--------|------|
| WPQR totali | **13** (2 organizzazioni: 11 + 2) |
| Approvate / bozza | 9 / 4 (rifiutate 0) |
| Con PDF conservato | **10** (9 approvate + 1 bozza, tutte nell'org. maggiore); le 3 senza PDF sono bozze |
| Norma | **15614-1** su 9 WPQR (tutte e 9 con PDF; 3 varianti di edizione 2012/2017/2019); `standard_reference` NULL su 4 (1 con PDF); **0** record 15614-2, **0** 14555, **0** Level 1, **0** tubo |
| Mig. 169 | **applicata** (`expiry_date` e `IX_wpqr_records_expiry` assenti su `wpqr_records`); mig. 143, 158, 159, 168 **presenti** |
| Tracking migrazioni | **non esiste** nessuna tabella: lo stato schema si legge solo dalle colonne |
| Qualifiche (confronto) | 151 righe, 146 con PDF; le 6 colonne di prova della mig. 168 sono **vuote ovunque** (backfill mai partito) |

**Compilazione di `wpqr_records` (N = 13)**

| Gruppo | Campi | Esito |
|--------|-------|-------|
| **Mai valorizzati (0/13)** | `test_date`, i 10 `*_result` (VT, RT, UT, MT, PT, trazione, piega, resilienza, durezza, macro), `diameter_max`, `qualifying_element`, `base_material_group_2`, `issuing_body`, `notes` | le chiavi dell'ingest AI non includono né `test_date` né gli esiti |
| **Parziali** | `shielding_gas` 69 %, `current_type` 69 %, `metal_transfer` 54 %, `heat_input_note` 62 %, `preheat_temp` 46 %, `interpass_temp` 31 %, `throat_test_mm` 31 %, `thickness_t1/t2_min` 46 % | grafie non normalizzate (`DC-EP`/`DCEP`; filler: 7 designazioni in 9 valori; gas con caratteri OCR anomali) |
| **Bit senza «non rilevato»** | `pwht` = 0 su 13/13; `rotated_position` 0 su 10 | non distinguono «falso» da «non letto» |

**Dati di prova strutturati: nessuno.** `heat_input_note` ha 8 righe brevi (media 43 caratteri) con soli **limiti/tolleranze percentuali** (6 con ±%): 0 con kJ/mm o J/mm, 0 con valori in A o V, 0 con velocità. Corrente, tensione, velocità e apporto termico per passata **non sono oggi in nessuna colonna**.

**Legame WPS ↔ WPQR**

| Misura | PROD |
|--------|------|
| `welding_procedures` (WPS) | **0 righe** (nessuna WPS salvata); 5 staging `wps` in attesa, mai confermate |
| `wpqr_records.wps_id` | 0 / 13 |
| `wpqr_records.wps_ref` (testo) | 9 / 13, nessun legame relazionale |
| Colonne `wpqr_ref` / `wpqr_id` su `welding_procedures` | **non esistono**: il legame è solo lato WPQR |

**Ingest WPQR (`ingest_staging`, 53 righe, 2026-07 → 2026-10)**

| Misura | Valore |
|--------|--------|
| Stato | 18 confermate, 9 in attesa, 26 rifiutate; 52/53 con almeno un warning; modello unico `gemini-2.5-flash` |
| Warning principali | «estrazione via OCR» (26) · range spessore dichiarato fuori dal range atteso 15614-1 Tab. # Level # (17) · designazione filler non riconosciuta come ISO 14341 (26, varie grafie) · rielaborazione automatica su record esistente (17) · range t1/t2 per FW non calcolabile con formula BW (4) · quota chiavi AI esaurita (1) |
| Rielaborazioni | **16 proposte su 4 WPQR, tutte rifiutate, senza motivo registrato** (campi: `product_type` 8, `preheat_temp` 4, `interpass_temp` 2, `throat_test_mm` 2, t1/t2 1) |
| Confermate orfane | 8 staging confermati puntano a WPQR **non più presenti** |
| Feedback utente | 1 accettato · 17 corretti · 26 rifiutati (senza motivo). Campi più corretti: `certificate_number`, `wpqr_code`, `product_type`, `thickness_test_mm`, `preheat_temp` |
| Non contabili | `duplicate` e `wrong_module` non sono persistiti (risposte API) |

**Coerenza (N = 13)**: `product_type` NULL 7 (2 con `diameter_*` valorizzato); FW 6, di cui 2 senza gola; `welding_process` mancante 3; `qualification_level` NULL 7; range spessore incoerenti 0.

**Non raccolto**: TEST; contenuto dei PDF (seconda pagina) ed esistenza dei file in `/uploads`; motivo dei rifiuti (non registrato); compilazione WPS (tabella vuota); ultima migrazione applicata (nessun tracking).

### Implicazioni per il piano

| # | Dato PROD | Effetto sul piano | Dove è recepito |
|---|-----------|-------------------|-----------------|
| a | Nessuna WPS salvata (0 righe) | WV-7 **non ha dati WPS da migrare**, ma **non ha nemmeno riscontro d'uso reale** del generatore: la bozza si valida con le WPQR reali in sola lettura | WV-7 (DoD: verifica con WPQR reali su TEST/PROD in sola lettura) |
| b | `wps_id` 0/13, `wps_ref` testo 9/13, nessuna colonna WPS→WPQR | Chiave esplicita WPS→WPQR: **D9 decisata 07/10/2026 (sì)**: tabella additiva `wps_wpqr_links`, schema in WV-3 (brief DATI); nessuna WPS legacy collegata d'ufficio | § 9 D9; WV-3 (brief DATI) |
| c | `test_date` e i 10 `*_result` mai valorizzati e non richiesti dall'AI | Entrano nello schema AI di **WV-4b** e nelle voci Rielaborazioni; **candidati al backfill: 10 WPQR** con PDF (9 approvate + 1 bozza). Le colonne **esistono già**: nessuna colonna nuova | § 2.3; WV-4b |
| d | Grafie diverse (`standard_reference` ×3, `current_type` DC-EP/DCEP, filler ×7) | Normalizzazione **solo in memoria** nella vista (WV-1) e finding `info` (WV-5a); **mai riscrittura del dato** | WV-1, WV-5a |
| e | 16 rielaborazioni rifiutate e 26 staging rifiutati senza motivo; esito suggerito/finale non loggato | **Motivo di rifiuto obbligatorio + log esito** (HITL 03/10, roadmap priorità 10): riga di backlog del piano, nessuna nuova slice | § 9 «Backlog del piano» |
| f | I 10 PDF conservati sono già sul VPS ma contengono dati di clienti | **Aggiornato 07/10/2026**: il committente conferma che i dati in chiaro dei certificati **possono essere usati per test tecnici**: i 10 PDF si leggono/estraggono **in sola lettura**. Restano i vincoli di § 4.1 (niente dati cliente in Git/chat/PR; fixture nel repo solo anonimizzate/sintetiche; report in chiaro solo in `/opt/cursor/artifacts`, non versionato) | HITL 1 (§ 4.1) |
| g | 17 warning «range spessore fuori tabella» (Level 1 / oltre 40 mm) | Mappano su `non_verificabile_fonte_mancante` (validità prevale; coerente col gate norme); il warning di plausibilità non si rimuove dove il pack non produce un finding verificabile | WV-5b, WV-5c |
| h | 13 WPQR, 0 di 15614-2/14555/tubo/Level 1; `pwht` sempre 0; `product_type` NULL 7/13; livello NULL 7/13 | Pack 15614-2/14555 **solo su fixture sintetiche** (nessun riscontro PROD): WV-5b li tratta come secondari; `pwht=0` e `product_type` NULL ⇒ `non_verificabile_dato_mancante`, mai `warn`; livello assente ⇒ Level 2 dichiarato come ipotesi | § 5; WV-5a, WV-5b |
| i | Mig. 169 applicata; nessuna tabella di tracking | `verify`/`rollback` della nuova migrazione si basano su **colonne e oggetti**, non su un registro; numero **NNN** sempre da `git fetch` | WV-3 |
| j | 8 staging confermati puntano a WPQR cancellate; una volta quota AI esaurita | Prima di promettere il backfill: **esistenza dei file in `/uploads`** e quota AI; 10 PDF = pochi run | WV-4b (DoD) |

Il dataset è piccolo (13 record): il campione di § 4.1 coincide di fatto con **quasi tutto il PROD**, quindi il gate «campione reale» sulle regole `warn` resta, ma va letto come «le 10 WPQR con PDF (lette in sola lettura; fixture nel repo solo anonimizzate/sintetiche)», non come un campione statistico.

---

## 1. Architettura

### 1.1 Cosa esiste già e cosa si riusa (gate Ponytail)

| Oggi | Dove | Riuso |
|------|------|-------|
| Motore di verifica + registry + pack + contratto `Finding` | `backend/src/services/qualificationVerify/` (`findingTypes`, `verifyRegistry`, `verifyEngine`, `registerDefaultPacks`, `packs/*.pack.js`, `moduleStructure.test.js`, `verifyReadOnly.test.js`) | **Un solo registry.** I pack WPQR si registrano accanto ai pack 9606 con `standardFamily` e profili distinti (`15614-1`, `15614-2`, `14555`); i codici dei finding sono unici globalmente → prefisso `WPQR15614_1.*`, `WPQR15614_2.*`, `WPQR14555.*`. L'engine oggi chiama `toRecordView` (qualifiche) e `verifyQualification`: va generalizzato (WV-1) senza cambiare il comportamento delle qualifiche (test esistenti invariati). |
| Funzioni pure range 15614 (spessore L2, gola, diametro L2, spessore minimo con impact) | `backend/src/data/weldingQualificationRules15614.js` | **Unica fonte dei numeri.** Il pack le importa. `calcThicknessRange` in `wpqrIngest.service.js` è una formula **generica disallineata** (commento TODO di consolidamento): non è fonte per la verifica; WV-4 ne gestisce la provenienza (§ 2.4). |
| 15614-2: spessore materiale, gola, diametro | `backend/src/data/weldingQualificationRules15614_2.js` | Idem per il profilo `15614-2`. |
| 14555: sezione stud, spessore, posizioni, protezione bagno, similari/dissimilari, through-deck | `backend/src/data/weldingQualificationRules14555.js` | Idem per `14555:SW`. **Non** applicare Tab. 7/8 15614 a uno stud (lo dicono l'estratto 14555 e `ISO-15613-qualifica-pre-produzione.md`). |
| Estrazione e commit WPQR | `backend/src/services/wpqrIngest.service.js` (`extractWPQRFromPdf`, `mapPipelineFieldsToReview`, `mapReviewFieldsToDb`, `commitWPQRFromFields`, `WPQR_REPROCESSABLE_FIELDS`, `checkWpqrPlausibility`) | Oggi cattura solo pag. 1 + `preheat_temp`, `interpass_temp`, `current_type`, `metal_transfer`, `heat_input_note`. Pag. 2 **non** letta. |
| Schema AI WPQR | `backend/src/data/documentTypeSchemas.js` (`wpqr`: `aiPrompt` + `aiExpectedSchema`) | Si estende con i campi di pag. 2 (WV-4). Lo schema `wps` ha `heat_input`, `current_range`, `voltage_range` (legacy, **non persistiti**). |
| CRUD WPQR + whitelist modifica manuale | `backend/src/controllers/welding.controller.js` (`WPQR_MANUAL_EDITABLE_FIELDS`, `createWPQR`, `updateWPQR`, `getWPQR`), `backend/src/routes/welding.routes.js` | Si estende (WV-4); le colonne `*_result` sono già nella whitelist ma l'ingest non le riempie. |
| Generatore WPS | `backend/src/services/wpsGenerator.service.js` (`buildWpsDraft`, `generateWpsFromWpqr`, `loadWpqrRecords`); `app/src/utils/wordExportWps.js` | `buildWpsDraft` copia solo processo, gruppo, filler, gas, posizioni, spessori. `wordExportWps` ha una tabella «5. Tabella passate» **vuota** (`emptyRunTable()`) e legge `wps.heat_input \|\| heat_input_note`, `wps.current_range \|\| current_type`, `wps.voltage_range`. |
| Registro Rielaborazioni | `backend/src/data/reprocessableFields.js` (backfill + `kind:'verify'`), `backend/src/data/reprocessTableAdapters.js` (adapter `qualifications`, `wpqr_records`), `backend/src/services/qualificationVerify/verifyReprocess.service.js`, `reprocessTasks.controller.js` | Estensione: voci `verify_wpqr_*` + generalizzazione `scanVerifyRecords` (campo `person_name` → etichetta record). |
| Pannello avvisi FE | `app/src/components/QualificationVerifyPanel.jsx` | Presentazionale sul `VerifyResult`: **riuso così com'è** nella pagina WPQR (nessuna copia). |
| Parser temperature | `backend/src/data/weldingTemperatures13916.js` | Esporta solo simboli/codici e la sezione prompt: **non** parsa «min 100 C». Il parsing numerico di preheat/interpass è lavoro nuovo (WV-5b), quando serve. |

### 1.2 Struttura prevista (nuovi file nella stessa cartella, nessun `if (norma)` nell'engine)

```text
backend/src/services/qualificationVerify/
  wpqrRecordView.js            (WV-1)  vista canonica da review-fields (ingest) o riga DB `wpqr_records` + `wpqr_test_runs`; risolve standard/edizione/livello/profilo
  verifyWpqr.js                (WV-1)  verifyWpqr(recordOrFields, { mode }) → VerifyResult (domain:'wpqr')
  verifyEngine.js              (WV-1)  M: estrae la pipeline condivisa; verifyQualification invariato nel comportamento
  registerDefaultPacks.js      (WV-1)  M: elenco ESPLICITO con i quattro stub WPQR
  packs/
    wpqrCompleteness.pack.js          (WV-5a)  famiglia «completezza»: 15614-1 BW/FW/UNKNOWN + 15614-2 + 14555
    wpqr15614_1Correctness.pack.js    (WV-5b)  15614-1 Level 2 (+ L1 solo dove leggibile)
    wpqr15614_2Correctness.pack.js    (WV-5b)  15614-2
    wpqr14555Correctness.pack.js      (WV-5b)  14555:SW
  wpqrVerifyLoader.js          (WV-5c)  SELECT tollerante alle colonne assenti (INFORMATION_SCHEMA) su wpqr_records + wpqr_test_runs
```

Come per VQ-1: **WV-1 crea i pack come stub (`rules: []`)** e li elenca in `registerDefaultPacks.js`: ogni slice successiva sovrascrive **solo il proprio pack**, nessuna tocca il registro condiviso. È ciò che rende parallela l'onda 2.

### 1.3 Contratto di output

**Invariato** rispetto a `PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md` § 1.3 (famiglia `completezza|correttezza`; severità `info|warn`; status `verificabile|non_verificabile_fonte_mancante|non_verificabile_dato_mancante`; `source.clause` obbligatoria se `verificabile`; `message_it` cita la clausola; `expected_value` informativo, mai scritto). Unica aggiunta al `VerifyResult`: `domain`. `engine_version` sale per tracciare il cambio di registry.

### 1.4 Due famiglie di regole per la WPQR

| Famiglia | Domanda | Base normativa | Regola di lettura |
|----------|---------|----------------|-------------------|
| **completezza** (`COMP`) | I dati che la norma pretende **sul certificato** ci sono? | 15614-1 §9 («gli elementi pertinenti elencati per la WPS in ISO 15609 **shall** be included» + «WPQR format … Annex B»); 15614-2 §9 + Annex A; 14555 §10.4 + Annex C; elementi della WPS: 15609-1 §4.4.8–4.4.17, §4.5.x | Mancanza di una variabile essenziale (§8.4.x, §8.3.x) o di un elemento 15609 richiesto = `warn`; riga marcata `*` in Annex B («if required») o parametro «se specificato» = `info`. |
| **correttezza** (`CORR`) | Dalla **prova** dichiarata, la validità ricalcolata coincide con quella scritta? E pag. 1 ↔ pag. 2 sono coerenti? | 15614-1 §8.3.2 Tab. 7/8, §8.3.3, §8.4.6, §8.5.2.3; 15614-2 §8.3.2.x, §8.4.6; 14555 §10.2.8.x; §9 («se non ci sono esiti inaccettabili, la WPQR è qualificata») | Certificato più largo della norma → `warn` (`over_claim`); più stretto → `info`; coerenza interna violata → `warn` solo se la clausola è citabile, altrimenti `info`. Input di prova assente → un solo `non_verificabile_dato_mancante`. |

### 1.5 Dove si aggancia

| Momento | Dove | Cosa succede | Non succede |
|---------|------|--------------|-------------|
| **Estrazione** (PDF → staging) | `extractWPQRFromPdf` in `wpqrIngest.service.js` (dopo `checkWpqrPlausibility`) | `verifyWpqr(reviewFields, {mode:'ingest'})` → `message_it` accodati ai `warnings` (già persistiti in `ingest_staging.warnings_json`) + oggetto `verification` nella risposta | Nessun cambio di `status`, nessun blocco |
| **Review** | `POST /welding/wpqr/verify` (nuovo controller `wpqrVerify.controller.js`, registrata **prima** delle rotte `:id`) — stateless, nessuna scrittura | `QualificationVerifyPanel` si aggiorna al **blur**; funziona identico in ingest, form manuale, coda Rielaborazioni | Mai a ogni tasto; offline = pannello nascosto |
| **Commit** | `commitWPQRFromFields` | Ricalcolo sui campi finali; avvisi nel riepilogo | Il commit non dipende dall'esito; nessun campo viene modificato |
| **DB esistente** | Rielaborazioni `kind:'verify'` | Report on-demand (sola lettura) | Nessuna scrittura |

Persistenza dei finding: **nessuna**. Stato migrazioni: **non assunto** — `wpqrVerifyLoader.js` legge `INFORMATION_SCHEMA.COLUMNS` (cache di processo) e costruisce la `SELECT` con le colonne esistenti; colonne/tabella di prova assenti → campi `null` → regole `non_verificabile_dato_mancante`, mai un errore SQL (stesso schema di `verifyRecordLoader.js`).

### 1.6 Perché `non_verificabile_*` conta (anche qui)

Le WPQR già in DB **non hanno** i dati di pag. 2: il report Rielaborazioni conterà separatamente verificabili e non verificabili, e la «copertura della verifica» sale man mano che i backfill AI (voci `wpqr_*`) popolano le passate. **Ordine d'uso consigliato al committente**: prima i backfill dei dati di prova, poi la verifica.

---

## 2. Modello dei dati di prova

### 2.1 Cosa dice il modulo (verificato sui Markdown)

**ISO 15614-1 Annex B** (`NORMA_00043`, pagg. 47–51): *pag. 1* — testata (n. WPQR, esaminatore, fabbricante, riferimento, norma/livello, data di saldatura) + due colonne «Test piece» / «Range of qualification»: forma prodotto, processi e **spessore di metallo depositato per processo**, tipo di giunto, gruppo materiale, spessore materiale, gola, mono/multi-passata, **diametro esterno**, **designazione, make e size del filler**, gas/flusso, **gas di protezione al rovescio**, **tipo corrente e polarità**, **modo di trasferimento**, **apporto termico**, posizioni, **preheat**, **interpass**, **post-heating**. *Pag. 2* «Record of weld test» — testata (pWPS, preparazione/pulizia, materiale base, spessore, nome saldatore/operatore, diametro, giunto, posizione, schizzo, sequenze) + **tabella passate**: *Run · Welding process · Size of filler material · Current A · Voltage V · Type of current/polarity · Wire feed speed · Travel speed\* · Heat input\* · Metal transfer* + designazione/make del filler + «Other information\*». *Pag. 3* esiti: VT, PT/MT\*, RT\*, UT\*, trazione (Re, Rm, A %, Z %, frattura), piega, macro, resilienza\*, durezza\*, altre prove. La nota **`*If required`** chiude l'Annex.
**ISO 15614-2 Annex A** (`NORMA_00031`): stessa struttura, con *Welding details* (Run, processo, size filler, corrente, tensione, tipo corrente/polarità, velocità filo, velocità di avanzamento\*, apporto termico) e riga «Post-weld heat treatment and/or ageing (time, temperature, method, heating and cooling rates)».
**ISO 14555 Annex C** (`NORMA_00033`): *nessuna tabella per passata*; WPQR stud = processo, diametro/lunghezza/materiale stud, spessore base, applicazione > 100 °C / ≤ 100 °C, protezione bagno, ferrule, gas e portata, posizione, sorgente, pistola/testa, preheat + due tabelle: **corrente (A) · tempo (ms) · sporgenza (mm) · alzata (mm)** e **capacità (mF) · tensione di carica (V) · gap/lift (mm) · forza molla / velocità d'impatto**.
**Base «shall»**: 15614-1 §9, 15614-2 §9, 14555 §10.4 (e 15613 §10) impongono di includere nella WPQR gli elementi pertinenti elencati per la WPS (15609-1 §4.4.9 corrente/polarità/intervallo corrente/tensione/velocità filo meccanizzata; §4.4.8 designazione-make-dimensioni dei consumabili; §4.4.17 apporto termico «se specificato»; §4.5.x processo-specifici). Annex B è l'**esempio di formato** («An example of WPQR format is shown in Annex B»).

### 2.2 Proposta di schema (migrazione additiva — WV-3)

**Tabella figlia `wpqr_test_runs`** (una riga per passata; per stud, 1–2 righe):

| Colonna (proposta) | Tipo | Annex / clausola | Note |
|--------------------|------|------------------|------|
| `id` PK, `organization_id` NOT NULL, `wpqr_id` NOT NULL | INT | — | FK `wpqr_id → wpqr_records(id)` in **statement separato**, **senza** `ON DELETE CASCADE` (la cancellazione WPQR elimina esplicitamente le passate nello stesso controller); indice `(organization_id, wpqr_id)` |
| `run_no` | INT | B pag. 2 «Run» | ordine; `NULL` ammesso per righe stud |
| `run_label` | NVARCHAR(20) | B «Run» | etichetta libera (es. `1`, `2-3`, `cap`) |
| `welding_process` | NVARCHAR(50) | B «Welding process» | per passata (consente 111+135 in futuro senza nuove colonne) |
| `filler_size` | NVARCHAR(50) | B «Size of filler material»; 15609-1 §4.4.8 | testo (es. `Ø 1,2`; `3,2/4,0`) |
| `filler_designation`, `filler_make` | NVARCHAR(100) | B «Filler material designation and make» | |
| `current_a_min`, `current_a_max` | DECIMAL(8,2) | B «Current A»; 15609-1 §4.4.9 | un valore singolo → min = max |
| `voltage_v_min`, `voltage_v_max` | DECIMAL(8,2) | B «Voltage V» | |
| `current_polarity` | NVARCHAR(40) | B «Type of current/polarity»; 15614-1 §8.4.6 | es. `DC+`, `AC` |
| `wire_feed_speed` | DECIMAL(8,2) + `wire_feed_unit` NVARCHAR(10) | B «Wire feed speed» | unità esplicita (m/min o mm/s): **non si converte in silenzio** |
| `travel_speed`, `travel_speed_unit` | DECIMAL(8,2), NVARCHAR(10) | B «Travel speed\*» (opzionale) | |
| `heat_input_kj_mm` | DECIMAL(8,3) | B «Heat input\*» (opzionale); 15614-1 §8.4.7 | **dichiarato** in passata; non ricalcolato |
| `metal_transfer` | NVARCHAR(40) | B «Metal transfer» | |
| `weld_time_ms`, `protrusion_mm`, `lift_mm` | DECIMAL | 14555 Annex C | solo righe stud |
| `capacitance_mf`, `charging_voltage_v`, `gap_lift_mm`, `spring_force_n` | DECIMAL | 14555 Annex C (2ª tabella) | solo scarica capacitiva |
| `remarks` | NVARCHAR(200) | B «Remarks» | |
| `source` | NVARCHAR(10) | — | `ai` \| `manual` (provenienza; non per bloccare) |
| `created_at`, `updated_at` | DATETIME2 | — | |

**Colonne di testata su `wpqr_records`** (tutte NULL; gruppo A = essenziali per verifica/WPS; gruppo B = opzionali):

| Gr. | Colonna (proposta) | Dato | Annex / clausola |
|-----|--------------------|------|------------------|
| A | `welding_position_test` NVARCHAR(40) | posizione di saldatura **della prova** (il certificato ha solo il range qualificato `welding_positions`) | B pag. 2 «Welding position»; 15614-1 §8.4.2 |
| A | `diameter_test_mm` DECIMAL(8,2) | diametro esterno **del provino** (oggi solo range `diameter_min/max`) | B pag. 2; §8.3.3 |
| A | `deposited_thickness_mm` DECIMAL(8,2) | spessore metallo depositato (processo principale) | B pag. 1; §8.3.2 Tab. 7 |
| A | `filler_make` NVARCHAR(100), `filler_size` NVARCHAR(50) | make e dimensione del filler (pag. 1) | B pag. 1; 15609-1 §4.4.8 |
| A | `backing_gas` NVARCHAR(100) | designazione gas al rovescio | B pag. 1; §8.5.6 |
| A | `heat_input_kind` NVARCHAR(20) | `heat_input` \| `arc_energy` | §8.4.7 («The kind of calculation … shall be documented») |
| A | `heat_input_range_min`, `heat_input_range_max` DECIMAL(8,3) | **intervallo qualificato** sul certificato (colonna «Range of qualification») | B pag. 1 «Heat input»; §8.4.7 |
| A | `post_heating` NVARCHAR(100) | post-riscaldo per rilascio idrogeno | B pag. 1; §8.4.10; 15609-1 §4.4.14 |
| A | `pwht_details` NVARCHAR(300) | trattamento termico dopo saldatura: temperatura/tempo/metodo | §8.4.11; 15614-2 Annex A; 15609-1 §4.4.15 |
| A | `pwps_ref` NVARCHAR(100) | n. pWPS | B pag. 2 |
| B | `shielding_gas_flow`, `nozzle_diameter_mm`, `contact_tube_distance_mm`, `tungsten_electrode` | parametri di processo | 15609-1 §4.5.2–4.5.5 — **non** in Annex B (solo «Other information\*») |
| B | `other_test_info` NVARCHAR(500) | testo libero «Other information\*» | B pag. 2 |
| (D4) | `preheat_temp_test`, `interpass_temp_test` | valore **di prova** accanto al testo esistente | B pag. 1 colonna «Test piece»; §8.4.8–8.4.9 — solo se il campione mostra l'ambiguità |

Esistono già (non si ricreano): `current_type`, `metal_transfer`, `heat_input_note`, `preheat_temp`, `interpass_temp`, `shielding_gas`, `single_multi_run`, `pwht` (BIT), `thickness_tested`, `throat_test_mm`, `qualification_level`, `standard_reference`, `wps_ref`, `*_result` (`OK/KO/NA`). Campi stud (`qualifying_element`, `base_material_group_2`, …, mig. 159) restano.

### 2.3 Tabella dato ↔ clausola ↔ UI ↔ API ↔ voce Rielaborazioni

| Dato | Clausola / fonte MD | UI | API / persistenza | Voce Rielaborazioni (stessa slice) |
|------|--------------------|----|-------------------|-------------------------------------|
| Passate (tutte le colonne di `wpqr_test_runs`) | 15614-1 Annex B pag. 2 + §9; 15614-2 Annex A; 15609-1 §4.4.9 | `WpqrTestRunsEditor` in modale WPQR + riga di revisione ingest (WV-6a/6b) | `GET/PUT /welding/wpqr/:id/test-runs`; INSERT in `commitWPQRFromFields` (WV-4) | `wpqr_test_runs` (nuovo adapter tabella, insert-if-empty) |
| Stud: corrente, tempo, sporgenza, alzata (+ capacitiva) | 14555 Annex C, §10.4 | stesso editor, variante stud | stessa tabella | stessa voce |
| `welding_position_test`, `diameter_test_mm`, `deposited_thickness_mm` | B pag. 1–2; §8.4.2, §8.3.3, §8.3.2 | form WPQR (blocco «Condizioni di prova») | `PUT /welding/wpqr/:id` (`WPQR_MANUAL_EDITABLE_FIELDS`) | `wpqr_welding_position_test`, `wpqr_diameter_test_mm`, `wpqr_deposited_thickness_mm` |
| `filler_make`, `filler_size`, `backing_gas`, `post_heating`, `pwht_details`, `pwps_ref` | B pag. 1–2; §8.4.4, §8.4.5, §8.5.6, §8.4.10, §8.4.11 | idem | idem | `wpqr_filler_make`, `wpqr_filler_size`, `wpqr_backing_gas`, `wpqr_post_heating`, `wpqr_pwht_details`, `wpqr_pwps_ref` |
| `heat_input_kind`, `heat_input_range_min/max` | §8.4.7 | idem | idem | `wpqr_heat_input_kind`, `wpqr_heat_input_range` (bundle min/max) |
| Gruppo B (gas flow, ugello, tungsteno, tubo di contatto) | 15609-1 §4.5.x (via §9) | idem (collassato) | idem | `wpqr_process_params` (bundle) — **solo dopo** campione (D3) |
| `*_result` (VT…macro) **già in DB, mai valorizzati in PROD (NULL 13/13)** e non richiesti dall'AI | B pag. 3; Tab. 1/2 | già nel form | già in whitelist (`WPQR_MANUAL_EDITABLE_FIELDS`); schema AI esteso e l'ingest li riempie (WV-4b) | `wpqr_test_results` (bundle dei 10 `*_result`, writeGuard `IS NULL OR = 'NA'`; **10 candidati**) |
| `test_date` **già in DB, mai valorizzata (0/13)** e non richiesta dall'AI | B pag. 1 «Date of welding» | già nel form | già in whitelist; schema AI esteso (WV-4b) | `wpqr_test_date` (writeGuard `IS NULL`; stessi 10 candidati) |
| Finding di verifica per record DB | come i singoli finding (§ 5) | tabella «Verifica WPQR vs norma» in Fatturazione → Rielaborazioni + CSV | `GET /admin/reprocess-tasks` (campo `kind`) · `POST /admin/reprocess-tasks/:key/run` (`kind:'verify'`) · nessuna persistenza | `verify_wpqr_15614_1`, `verify_wpqr_15614_2`, `verify_wpqr_14555` |

Eccezione dichiarata (nessuna voce): `heat_input_kj_mm` per passata e le altre colonne di passata **non** sono voci separate — vivono nella voce di tabella `wpqr_test_runs`. Il valore di `source` (`ai`/`manual`) non è estraibile.

### 2.4 Provenienza degli spessori calcolati (rischio già presente nel codice)

`resolveThicknessRange` in `wpqrIngest.service.js` scrive un range **calcolato** (formula generica `calcThicknessRange`, TODO di consolidamento) quando il certificato non lo riporta. Un record con range calcolato e uno con range **letto dal certificato** sono oggi indistinguibili in DB: la verifica di correttezza «certificato vs norma» perde senso sui primi (confronta il codice con se stesso). **Proposta**: euristica nel loader (range uguale a `calcThicknessRange(thickness_tested)` ⇒ `provenance = 'calcolato'`) → finding `non_verificabile_dato_mancante` («range non letto dal certificato») invece di un confronto; **colonna** opzionale `thickness_range_source` (`certificato`|`calcolato`) solo se il campione mostra troppi casi ambigui (D6). Un'eventuale pulizia/riscrittura dei range calcolati esistenti è **Alto** (modifica dati) e fuori da questo epic.

### 2.5 Fase B non pianificata: esiti quantitativi

Se un giorno servono Re/Rm/A %/KV/HV in modo strutturato: tabella `wpqr_test_results` (`wpqr_id`, `test_type`, `specimen_ref`, `value_numeric`, `unit`, `requirement_text`, `result`). Non serve a WPS né alla verifica corrente (D5).

---

## 3. Uso nella bozza WPS (generatore)

Oggi `buildWpsDraft` copia dalla WPQR: processo, gruppo, filler, gas, posizioni, spessori; la tabella passate del Word è vuota. Con i dati strutturati (WV-7, dopo WV-4):

| Elemento della bozza | Fonte | Regola |
|----------------------|-------|--------|
| Tabella «5. Tabella passate» del Word | `wpqr_test_runs` della WPQR scelta | Righe reali (processo, filler size, A, V, polarità, velocità filo/avanzamento, apporto termico, trasferimento) con etichetta **«da WPQR di prova»**; nessuna riga inventata se le passate non ci sono (resta la tabella vuota di oggi) |
| `current_range`, `voltage_range` della WPS | min/max delle passate della WPQR | **Intervalli di prova**, mostrati come tali; non vengono allargati. Se la WPQR non ha passate: come oggi (`current_type`) |
| `heat_input` della WPS | `heat_input_range_min/max` (certificato) o, in assenza, min/max di `heat_input_kj_mm` delle passate | Solo se **HITL 2 è chiuso** (regola ±25 % non codificata prima); con `heat_input_kind` esplicito (calore vs energia d'arco) |
| `preheat`, `interpass`, `post_heating`, `pwht_details`, `backing_gas` | colonne di testata | Copiati come dichiarati; i limiti di estensione (§8.4.8–8.4.11) restano alla verifica, non alla bozza |
| Stato della bozza (`ok/partial/not_possible/need_input`) | invariato | **Il modello AI non decide la copertura** (ADR-010). Dati di prova assenti → `need_input` sui campi di pag. 2, non un valore dedotto |
| Modi (a)/(b) 03/10 | — | Fuori epic: consumeranno `wpqr_test_runs` (filtro per corrente/tensione/apporto) quando verranno costruiti. Non toccare qui `generateWpsFromWpqr` oltre al caricamento delle passate |

Non si genera nulla per **multiprocesso** né per **stud lato operatore**.

---

## 4. Inventario norme (gate norm-touching)

Verificato aprendo i Markdown in `docs/Normative/` e gli estratti in `docs/reference/` (07/10/2026). Legenda: **coperta** = testo utilizzabile per regole con clausola · **parziale** = usabile con limiti dichiarati · **mancante** = niente da cui derivare una regola.

| Norma / clausole usate | Fonte in repo | Stato | Cosa permette | Cosa blocca esattamente |
|------------------------|---------------|-------|---------------|-------------------------|
| **15614-1:2017+A1:2019** §9 + Annex B (modulo) | `NORMA_00043` | **coperta** | Completezza di pag. 1–3; riga `*If required` = opzionale | — |
| 15614-1 §8.3.2 (Tab. 7/8), §8.3.3 (Tab. 9/diametro) Level 2 | `NORMA_00043` + `weldingQualificationRules15614.js` + `ISO-15614-1-range-validita-WPQR.md` | **coperta** (L2, fino a 40 mm in Tab. 7) | `CORR.THK`, `CORR.THROAT`, `CORR.DIAMETER` | Tab. 7 **oltre 40 mm** L2 «non definito in tabella»: non si calcola |
| 15614-1 Tab. 7 colonna **Level 1** (t > 3 mm) | idem | **mancante** (GAP: cifra «0,» troncata in 5 righe su 7) | — | Regola L1 `non_verificabile_fonte_mancante`; richiede verifica sul PDF (HITL 3) |
| 15614-1 §8.4.1–8.4.2, §8.4.4, §8.4.5 (processo, posizioni, filler, size) | `NORMA_00043` | **coperta** per completezza; correttezza **parziale** | Completezza; coerenza processo pag. 1 ↔ passate | §8.4.2: la copertura «tutte le posizioni» dipende dal **numero di provini** (impact + durezza in posizioni diverse): non modellato → `non_verificabile_dato_mancante` |
| 15614-1 §8.4.6 (tipo di corrente) | `NORMA_00043` | **coperta** | `CORR.CURRENT_TYPE` (es. AC qualifica DC per 111 senza impact) | Normalizzazione della stringa `current_type` (nuova, WV-5b) |
| 15614-1 §8.4.7 (apporto termico) | `NORMA_00043` | **parziale** | «kind documentato» (completezza); upper limit +25 % L2 con impact | **Frase sul limite inferiore per durezza e attribuzione L1/L2 incerte** (colonne intercalate) → **HITL 2**; ricalcolo da V·A·v: ISO/TR 18491 + 17671-1 mancanti → fonte mancante |
| 15614-1 §8.4.8/§8.4.9 (preheat −50 °C, interpass +50 °C) | `NORMA_00043` | **coperta** come testo | — | Dato: il record non distingue **prova** da **range qualificato** (D4/HITL 1); parsing numerico «min 100 C» da scrivere |
| 15614-1 §8.4.10 (post-heating L2: non ridurre), §8.4.11 (PWHT: ±20 °C L2) | `NORMA_00043` | **coperta** | Completezza di `post_heating`/`pwht_details`; `CORR.PWHT` (flag ↔ dettagli) | Confronto temperature richiede colonna numerica (non prevista) → `info` |
| 15614-1 §8.5.6 (backing gas) | `NORMA_00043` | **coperta** | Completezza (info) | Regola correttezza solo per gruppi 7.1 e 41–48 (testo leggibile ma regola complessa): fuori prima onda |
| 15614-1 Tab. 1/2 (estensione prove), Tab. 3 (durezza HV10) | `NORMA_00043` | Tab. 1/2 **coperta**; **note** di Tab. 2 e Tab. 3 **parziali** | `CORR.RESULTS_QUALIFIED` (§9) | Obbligatorietà di impact/durezza dipende da note e da requisiti di norma applicativa: **non** si impone «result ≠ NA» (HITL 3) |
| 15614-1 Tab. 5/6 (matrici materiale acciaio/nichel) | `NORMA_00043` + estratto | **parziale** (leggibili, non codificate) | — | Nessuna regola di copertura gruppo in questa epic |
| **15614-2:2025** §8.3.2.x, §8.4.4–8.4.9, §9 + Annex A | `NORMA_00031` + `weldingQualificationRules15614_2.js` | **coperta** | `CORR.THK/THROAT/DIAMETER`; apporto termico **+25 % (+15 % gruppo 23)** letto direttamente (§8.4.6) | Gruppi Al 21–26 (ISO/TR 15608 integrale mancante, già nel backlog): sottogruppi `info` |
| **14555:2025** §10.2.8.x, §10.4 + Annex C | `NORMA_00033` + `weldingQualificationRules14555.js` + estratto | **coperta** (Tabella 1: MD corretto da HITL 29/08, non ridigitalizzare) | Completezza stud; `CORR` su sezione/posizioni/similari | Non applicare Tab. 7/8 15614; mappa 783–786 ↔ range: «vietato dedurlo» (riunione 03/10) |
| **15613:2025** §8, §10 | `NORMA_00045` + estratto | **coperta** (nessuna soglia propria) | Rinvio alla parte 15614 della Tabella 2 | — |
| **15609-1:2019** §4.4.8–4.4.17, §4.5.1–4.5.5 | `NORMA_00014` + `ISO-15609-WPS-contenuto.md` | **coperta** | Elenco degli elementi che §9 richiede nella WPQR | — |
| **ISO/TR 18491**, **ISO/TR 17671-1** | assenti | **mancante** | — | Ricalcolo apporto termico / k-factor (HITL 4) |
| 15614-1:2004+A2:2012, 15614-2:2005 (legacy) | assenti | **mancante** | — | `non_verificabile_fonte_mancante` (D7) |

### 4.1 Richieste al committente (blocchi HITL, in ordine di priorità)

```markdown
## Richiesta dati (HITL) — 1 di 4 (non è una norma)

- **Cosa**: le WPQR reali (PDF o dati; **dal 07/10/2026 non serve anonimizzarle a monte**: il committente ha confermato l'uso dei dati in chiaro per test tecnici; in PROD ce ne sono **10 con PDF conservato**, quindi il campione coincide con quasi tutto il dataset; le altre WPQR sono bozze senza PDF) già validate da un coordinatore: copertura 15614-1 BW e FW, P e T, almeno una con prove di resilienza e durezza, almeno una GMAW (131/135) e una TIG (141), una 15614-2 (alluminio), una 14555 (stud, anche a scarica capacitiva); idealmente 2–3 con un errore noto
- **Serve a**: (1) misurare falsi positivi/negativi delle regole `warn` prima di dichiarare «pronta»; (2) chiarire se `preheat_temp`/`interpass_temp` oggi contengono il valore di prova o il range qualificato (D4); (3) capire quali righe di pag. 2 sono davvero compilate (corrente/tensione sempre? velocità? apporto termico?) e se i parametri del gruppo B compaiono; (4) tarare la tolleranza
- **Perimetro su cui si parte comunque**: fixture sintetiche costruite da Annex B e dalle tabelle (valori ai bordi 3/12 mm, 25 mm …); archiviazione passate e completezza
- **Riservatezza (aggiornata 07/10/2026)**: il committente ha confermato che i **dati in chiaro dei certificati possono essere usati per test tecnici**: i 10 PDF conservati in PROD (`/uploads`) si possono **leggere/estrarre in sola lettura** (nessuna scrittura su PROD, nessun re-ingest). **Vincoli che restano**: (1) nessun dato cliente (nomi, numeri certificato, aziende) **committato in Git** né **incollato in chat/PR**; (2) le **fixture di test nel repo** sono **solo anonimizzate/sintetiche**; (3) i **report con dati in chiaro** vivono solo in `/opt/cursor/artifacts` (non versionato). Prima di contare sui file va verificata la loro esistenza su disco (non verificata)
- **Gate**: senza campione la PR dei pack normativi **non** passa a «pronta»
```

```markdown
## Richiesta norma (HITL) — 2 di 4 (conferma sul PDF)

- **Codice / titolo**: ISO 15614-1:2017+A1:2019, **§8.4.7 Heat input (arc energy)** e **Tabella 3** (note a/b/c)
- **Serve a**: stabilire quale limite si applica a quale livello nella frase «upper limit of heat input qualified … 25 % greater» (impact) e «lower limit … 25 % lower» (hardness); stesso dubbio per le note di Tab. 3
- **Cosa c'è già in repo**: `NORMA_00043` — testo ma con le colonne Level 1 / Level 2 **intercalate** nel Markdown
- **Cosa NON inventiamo**: né il ±25 % per livello, né la regola sul limite inferiore per durezza
- **Perimetro su cui si parte comunque**: «kind documentato» (§8.4.7, frase non ambigua) e regole 15614-2 §8.4.6 (testo lineare)
- **Formato utile**: foto/PDF delle sole pagine, o conferma testuale della frase per livello
```

```markdown
## Richiesta norma (HITL) — 3 di 4

- **Codice / titolo**: ISO 15614-1:2017+A1:2019 **Tabella 7, colonna Level 1** (t > 3 mm) e Tabella 2 **note d/e/f** (quando resilienza/durezza sono richieste)
- **Serve a**: abilitare le regole Level 1 sullo spessore e la completezza degli esiti di prova
- **Cosa c'è già in repo**: `ISO-15614-1-range-validita-WPQR.md` (GAP dichiarato); `NORMA_00043`
- **Cosa NON inventiamo**: le cifre troncate («0,5 t» vs «5»), né l'obbligatorietà di impact/durezza per condizione
- **Perimetro su cui si parte comunque**: Level 2 (default se il livello non è dichiarato)
- **Formato utile**: PDF (preferito) o foto delle due tabelle
```

```markdown
## Richiesta norma (HITL) — 4 di 4 (P2, condizionata)

- **Codice / titolo**: ISO/TR 18491 (energia di saldatura) e ISO/TR 17671-1 (k-factor)
- **Serve a**: ricalcolare l'apporto termico da V·A/velocità e confrontarlo con il valore dichiarato in passata
- **Prima di chiedere**: il committente conferma che il ricalcolo serve; se l'apporto è sempre dichiarato in passata, la richiesta cade
- **Cosa NON inventiamo**: formula e coefficienti k per processo
- **Perimetro su cui si parte comunque**: coerenza dei valori dichiarati (min ≤ max, unità presenti) senza ricalcolo
```

Righe di backlog aggiunte in [`NORME_MANCANTI_BACKLOG.md`](../reference/NORME_MANCANTI_BACKLOG.md) (07/10/2026): campione WPQR reali; 15614-1 §8.4.7/Tab. 3/Tab. 7 L1 (PDF); ISO/TR 18491 + 17671-1; edizioni legacy 15614.

---

## 5. Cosa verifica la prima onda dei pack — checklist dato ↔ clausola ↔ UI ↔ API

Codici stabili, mai rinominati. Ogni finding passa `validateFinding`. Soglie: **solo** quelle già in funzioni di `main` o lette nei testi sopra.

### 5.1 Completezza (pack `wpqrCompleteness`, WV-5a)

| Codice | Dato | Clausola | Severità | UI/API |
|--------|------|----------|----------|--------|
| `WPQR15614_1.COMP.PROCESS` / `…POSITIONS` / `…FILLER` / `…MATERIAL_GROUP` / `…THICKNESS` | processo, posizioni, filler (designazione), gruppo, spessore (pag. 1) | §8.4.1, §8.4.2, §8.4.4, §8.3.1, §8.3.2 + §9 | `warn` se assente (variabile essenziale) | pannello di verifica |
| `…COMP.DIAMETER` | diametro per tubi/derivazioni (L2); non richiesto su piastra e su Level 1 | §8.3.3 (`isDiameterEssentialVariable`) | `warn` solo se prodotto = tubo e L2; `product_type` NULL (7/13 in PROD) ⇒ `non_verificabile_dato_mancante` | idem |
| `…COMP.CURRENT_TYPE` | tipo di corrente e polarità | §8.4.6 + 15609-1 §4.4.9 | `warn` per processi ad arco | idem |
| `…COMP.PREHEAT` / `…INTERPASS` | preheat, interpass dichiarati | §8.4.8, §8.4.9 | `warn` se assente (o «nessuno» esplicito accettato) | idem |
| `…COMP.HEAT_INPUT_KIND` | heat input presente ma tipo (calore/energia d'arco) non indicato | §8.4.7 («shall be documented») | `warn` | idem |
| `…COMP.LEVEL` | livello 1/2 non dichiarato (7/13 in PROD) | National foreword `NORMA_00043` («when no level is specified … Level 2 should be applied») | `info`: «livello non dichiarato, applicato Level 2» | idem |
| `…COMP.NORMALIZATION` | grafia non canonica di `standard_reference` (edizione), `current_type` (DC-EP/DCEP), designazione filler | §8.4.6 (tipi di corrente), §8.4.4 (designazione secondo la norma internazionale); edizione 2012 ⇒ fonte mancante (legacy) | `info`; **solo segnalazione**: il valore canonico è usato dalla vista per il confronto, **il dato non viene riscritto** | idem |
| `…COMP.BACKING_GAS`, `…COMP.POST_HEATING`, `…COMP.PWHT_DETAILS` | gas al rovescio, post-heating, PWHT con `pwht=1` senza dettagli | §8.5.6, §8.4.10, §8.4.11 | `info` (PWHT senza dettagli: `warn` **solo se `pwht` è dichiarato vero**; `pwht = 0` non distingue «no» da «non letto» — 13/13 in PROD — ⇒ nessun avviso) | idem |
| `…COMP.RUNS_PRESENT` | nessuna passata archiviata | §9 + Annex B pag. 2 | **un solo** `info` `non_verificabile_dato_mancante` | idem; rimanda alla voce di backfill |
| `…COMP.RUN_FIELDS` | passata con corrente, tensione, polarità, processo, size filler (processi ad arco) | §9 + 15609-1 §4.4.9, §4.4.8; Annex B riga passata | `warn` per campo mancante in passata presente; `travel_speed`/`heat_input` (`*`) `info` | idem |
| `WPQR15614_2.COMP.*` | stesso schema su Annex A + §8.4.4–8.4.9 + riga PWHT/ageing | §9, Annex A | come sopra | idem |
| `WPQR14555.COMP.*` | stud: processo, diametro/materiale stud, spessore, protezione bagno, ferrule, gas+portata, posizione, preheat, corrente/tempo/sporgenza/alzata | §10.4 + Annex C | `warn` essenziali (§10.2.8.x), `info` altri | idem |

### 5.2 Correttezza (pack per norma, WV-5b)

| Codice | Controllo | Clausola | Severità |
|--------|-----------|----------|----------|
| `…CORR.THK_BW` / `…THK_FW` | range di spessore del certificato vs Tab. 7 / Tab. 8 L2 da `thickness_tested`/`throat_test_mm` (stessa tolleranza: arrotondamento 0,01 mm) | §8.3.2 Tab. 7/8 | `warn` over_claim, `info` under_claim; L1 / oltre 40 mm → `non_verificabile_fonte_mancante` (sono i casi dei 17 warning PROD «range spessore fuori tabella»: la validità del certificato prevale, nessun valore atteso inventato) |
| `…CORR.DIAMETER` | range diametro vs §8.3.3 da `diameter_test_mm`; piastra → tubo (`describePlateCoversPipeDiameterLevel2`) | §8.3.3 | `warn` / `info` |
| `…CORR.THK_RANGE_PROVENANCE` | range non letto dal certificato (calcolato) | § 2.4 | `info` `non_verificabile_dato_mancante` |
| `…CORR.CURRENT_TYPE` | tipo di corrente validato vs tipo di corrente nelle passate | §8.4.6 | `warn` se il certificato dichiara **più** tipi di quelli provati (AC→DC solo per 111 senza impact) |
| `…CORR.PROCESS_RUNS` | processi in pag. 1 vs processi delle passate | §8.4.1 | `warn` se una passata usa un processo non dichiarato; altrimenti `info` |
| `…CORR.TRANSFER_MODE` | modo di trasferimento pag. 1 vs passate (GMAW 13) | §8.5.2.3 | `info` |
| `…CORR.HEAT_INPUT_KIND_UNITS` | valori heat input con unità/tipo coerenti; min ≤ max | §8.4.7 | `info` (coerenza interna, senza soglie) |
| `WPQR15614_2.CORR.HEAT_INPUT_UPPER` | limite superiore qualificato dichiarato > test max × 1,25 (× 1,15 gruppo 23) | 15614-2 §8.4.6 | `warn` over_claim **dopo** conferma del gruppo materiale |
| `…CORR.PWHT` | `pwht` (flag) ↔ `pwht_details`; aggiunta/cancellazione PWHT non ammessa | §8.4.11 | `info` (dato testo); `pwht = 0` senza dettagli ⇒ `non_verificabile_dato_mancante` (bit NOT NULL default 0) |
| `…CORR.RESULTS_QUALIFIED` | esito `KO` su una prova mentre la WPQR è approvata/attiva | §9 («qualified» solo se nessun esito inaccettabile) | `warn`; esiti NULL/`NA` (oggi 13/13 NULL) ⇒ `non_verificabile_dato_mancante` |
| `WPQR14555.CORR.*` | sezione stud, spessore, posizione, protezione bagno, similari/dissimilari (funzioni 14555 già in `main`) | §10.2.8.4–§10.2.8.10 | come funzioni |
| **Non codificate** | `CORR.PREHEAT_MIN`/`INTERPASS_MAX` (−50/+50 °C), `CORR.HEAT_INPUT_LOWER`, `CORR.HEAT_INPUT_UPPER` di 15614-1, `CORR.POSITIONS` (provini multipli) | §8.4.8, §8.4.9, §8.4.7, §8.4.2 | `non_verificabile_*` finché non chiudono HITL 1–3 |

---

## 6. Mappa slice

**Tipo**: AFK = chiudibile dal deputy da solo · HITL = serve decisione/dato del committente. **Contesto**: tutti **default/basso** (non 1M).

| Slice | Tema | Dipende da | Onda | Rischio | Tipo |
|-------|------|------------|------|---------|------|
| WV-0 | Charting: questo piano + 4 brief + righe backlog | — | 0 | Basso (solo doc) | questa PR |
| WV-1 | Core: dominio `wpqr` nell'engine (`wpqrRecordView`, `verifyWpqr`, estrazione pipeline), stub pack, manifest, bussola | contratto (nel piano) | 1 | Medio (BE additivo, non agganciato) | AFK |
| WV-2 | Estratto operativo «dati di prova WPQR» (Annex B/A/C ↔ clausole ↔ colonne) + stati backlog | — | 1 | Basso (solo doc) | AFK |
| WV-3 | Migrazioni additive (`wpqr_test_runs` + colonne di testata; `wps_wpqr_links`) + verify/rollback + **runner VPS** + `DATABASE.md` | — | 1 | Medio (additiva, nullable; applicazione PROD = HITL) | AFK |
| WV-4 | Persistenza + ingest pag. 2 + Rielaborazioni backfill (BE) — vedi sotto-slice | WV-3 | 2 | Medio (percorso ingest critico) | AFK |
| WV-5a | Pack completezza (15614-1/-2/14555) | WV-1, WV-2 | 2 | Medio* | AFK |
| WV-5b | Pack correttezza (15614-1, 15614-2, 14555) + funzioni pure/parser nuovi | WV-1, WV-2 | 2 | Medio* | AFK (HITL 1–3 per le regole non codificate) |
| WV-5c | Aggancio verifica: ingest + `POST /welding/wpqr/verify` + loader DB + voci `verify_wpqr_*` | WV-1, WV-4, WV-5a, WV-5b | 3 | Medio | AFK |
| WV-6a | `WpqrTestRunsEditor` FE presentazionale + `apiService` (3 metodi) | contratto API (nel piano) | 1 | Basso | AFK |
| WV-6b | Integrazione FE: modale WPQR (passate + testata + pannello avvisi), revisione ingest, riga Rielaborazioni | WV-4, WV-5c, WV-6a | 4 | Medio | AFK |
| WV-7 | Bozza WPS da passate (BE `buildWpsDraft`/loader + `wordExportWps`) | WV-4 (+ WV-6b se tocca la pagina), HITL 2 per l'apporto termico | 5 | Medio | AFK (HITL 2) |
| WV-8 | Smoke E2E su TEST + chiusura documentale (GUIDA, roadmap, `DATABASE.md`, bussola) | WV-6b, WV-7 | 6 | Basso | AFK |

\* **Livello rischio normativo.** Stessa lettura dell'epic qualifiche: una «logica di compliance con impatto qualità non validata» sarebbe **Alto** per `sgq-git-autonomy.mdc`; qui gli esiti sono solo avvisi non bloccanti → **Medio con gate rafforzato** (CI + Bugbot + Security Review + secondo giro sulla tabella regola ↔ clausola + campione reale). Se il committente preferisce trattarli come Alto (D6), ogni merge dei pack richiede il suo consenso.

**Sotto-slice di WV-4** (stessi file in sequenza, **mai in parallelo**): **WV-4a** = API persistenza (nuovo `wpqrTestRuns.service.js`, rotte `GET/PUT /welding/wpqr/:id/test-runs`, `WPQR_MANUAL_EDITABLE_FIELDS` con le nuove colonne di testata, `getWPQR` con le passate, cancellazione esplicita delle passate in `deleteWPQR`); **WV-4b** = ingest pag. 2 (schema AI, `mapPipelineFieldsToReview`/`mapReviewFieldsToDb`, `commitWPQRFromFields` che inserisce le passate, `applyFieldReprocessUpdate`, `WPQR_REPROCESSABLE_FIELDS`, voci registro `wpqr_*` + adapter `wpqr_test_runs`). 4a prima di 4b (la whitelist manuale deve già contenere le chiavi quando 4b estende `aiExpectedSchema`: vincolo `manualEditCompletenessCheck`). Se il deputy chiude WV-4 in una sola sessione va bene; se non chiude, **handoff** nel brief e si riparte da 4b.

### 6.1 DAG

```text
Onda 1 (parallelo, nessuna dipendenza tra loro)
  WV-1 ─────────────┬──► WV-5a ─┐
  WV-2 ─────────────┤           │
                    └──► WV-5b ─┤
  WV-3 ───► WV-4 (4a→4b) ───────┼──► WV-5c ──► WV-6b ──► WV-7 ──► WV-8
  WV-6a ────────────────────────┴───────────────┘
Onda 2 (dopo il merge di WV-1/WV-2/WV-3): WV-4, WV-5a, WV-5b
Onda 3: WV-5c (dopo WV-4 + WV-5a + WV-5b: stessi file ingest/registro)
Onda 4: WV-6b (dopo WV-4 + WV-5c + WV-6a)
Onda 5: WV-7 (dopo WV-4, e dopo WV-6b se tocca WeldingProceduresPage.jsx)
Onda 6: WV-8
```

Regola operativa: una slice si lancia solo quando le sue dipendenze sono **su `origin/main`** (non solo in PR) e il suo brief è `APERTO` su `main` (gate DEPUTYTASK).

### 6.2 File previsti / Cosa NON toccare — **disgiunti per onda**

Convenzione: un file compare come «previsto» in **una sola** slice della stessa onda. Eccezione ammessa: `backend/scripts/deploy-manifest.json` (ogni slice aggiunge **solo le proprie righe**). I runner `backend/scripts/run-migration-<NNN>-vps.js` / `<NNN+1>` e il loro test appartengono **solo a WV-3**: nessun altro brief della prima onda (WV-1, WV-2, WV-6a) elenca file in `backend/scripts/` salvo WV-1 per le righe di `deploy-manifest.json`; nelle onde successive solo WV-4/WV-5b/WV-5c (manifest) e WV-8 (smoke) toccano `backend/scripts/`, quindi nessuna sovrapposizione (verificato con `grep backend/scripts` sui quattro brief).

**Onda 1**

| Slice | File previsti (nuovi *N*, modificati *M*) | Cosa NON toccare |
|-------|-------------------------------------------|------------------|
| WV-1 | *N* `backend/src/services/qualificationVerify/{wpqrRecordView,verifyWpqr}.js` + `*.test.js` · *M* `…/verifyEngine.js` (solo estrazione della pipeline condivisa; comportamento invariato) · *M* `…/registerDefaultPacks.js` · *M* `…/index.js` · *N (stub, `rules: []`)* `…/packs/{wpqrCompleteness,wpqr15614_1Correctness,wpqr15614_2Correctness,wpqr14555Correctness}.pack.js` · *M* `backend/scripts/deploy-manifest.json` · *M* `PROJECT_CONTEXT.md` (una riga bussola) | `wpqrIngest.service.js`, `ingestPlausibilityChecks.js`, controller/route, Rielaborazioni, `weldingQualificationRules*`, pack 9606/14732, qualsiasi FE, `database/migrations/**` |
| WV-2 | *N* `docs/reference/WPQR-dati-prova-pagina-2-estratto.md` · *M* `docs/reference/NORME_MANCANTI_BACKLOG.md` (solo stati/note delle righe WPQR) | qualsiasi `.js/.jsx/.json`, `docs/Normative/**`, altri `docs/reference/*`, `PLAN_*`, GUIDA, ROADMAP |
| WV-3 | *N* `database/migrations/<NNN>_wpqr_test_data.sql`, `<NNN>_verify.sql`, `<NNN>_rollback.sql` (NNN dichiarato dopo `git fetch`; oggi 170) · *N* `database/migrations/<NNN+1>_wps_wpqr_links.sql`, `<NNN+1>_verify.sql`, `<NNN+1>_rollback.sql` (D9; oggi 171) · *N* **runner VPS** `backend/scripts/run-migration-<NNN>-vps.js` e `run-migration-<NNN+1>-vps.js` (modello `run-migration-158/159-vps.js` + `169`) + test L1 `backend/scripts/runMigration<NNN>_<NNN+1>.test.js` (modello `runMigrationHardening158159.test.js`) · *M* `docs/reference/DATABASE.md` (righe migrazioni, tabelle e colonne) | qualsiasi BE/FE (`backend/src/**`, `app/**`), `reprocessableFields.js`, migrazioni e runner esistenti, `database/migrations/ci/**`, `backend/scripts/deploy-manifest.json` (i runner non sono in `backend/src/`: manifest non coinvolto, verificato) |
| WV-6a | *N* `app/src/components/WpqrTestRunsEditor.jsx` + `.css` · *N* `app/src/tests/wpqrTestRunsEditor.test.jsx` · *M* `app/src/services/apiService.js` (solo 3 metodi WPQR) · *M* `docs/reference/LIBRERIA_UI_SGQ.md` (una riga) | `WeldingProceduresPage.jsx`, `IngestReviewDialog.jsx`, `WpqrUploadButton.jsx`, `BillingDashboardPage.*`, `QualificationVerifyPanel.*`, qualsiasi BE |

*Disgiunzione onda 1*: WV-1 è l'unico BE/manifest/bussola; WV-2 l'unico `docs/reference` (+ backlog); WV-3 l'unico `database/migrations` e `DATABASE.md`; WV-6a l'unico FE/`apiService`/`LIBRERIA_UI_SGQ.md`.

**Onda 2** (dopo il merge dell'onda 1)

| Slice | File previsti | Cosa NON toccare |
|-------|---------------|------------------|
| WV-4 | *N* `backend/src/services/wpqrTestRuns.service.js` + test · *M* `backend/src/controllers/welding.controller.js` + test · *M* `backend/src/routes/welding.routes.js` · *M* `backend/src/data/documentTypeSchemas.js` · *M* `backend/src/services/wpqrIngest.service.js` + test · *M* `backend/src/data/reprocessableFields.js` + `reprocessableFields.test.js` · *M* `backend/src/data/reprocessTableAdapters.js` · *M* `deploy-manifest.json` | `qualificationVerify/**`, pack, `weldingQualificationRules*`, `ingestStaging.service.js` (salvo evidenza contraria nel brief), FE, migrazioni |
| WV-5a | *M* `…/qualificationVerify/packs/wpqrCompleteness.pack.js` + `.test.js` | registry/engine, altri pack, ingest, `jointTypeProfiles.js`, FE |
| WV-5b | *M* `…/packs/{wpqr15614_1Correctness,wpqr15614_2Correctness,wpqr14555Correctness}.pack.js` + test · *N* `backend/src/utils/wpqrParamParse.js` + test (parser corrente/temperature/unità; solo se serve) · *M* `backend/src/data/weldingQualificationRules15614.js`/`…15614_2.js`/`…14555.js` + test (solo funzioni nuove, nessuna modifica di quelle esistenti) · *M* `deploy-manifest.json` | registry/engine, pack completezza, ingest, controller, FE |

*Disgiunzione onda 2*: WV-4 è l'unico su ingest/controller/schema/registro; WV-5a e WV-5b su file pack distinti; WV-5b l'unico sulle funzioni di regola.

**Onda 3**

| Slice | File previsti | Cosa NON toccare |
|-------|---------------|------------------|
| WV-5c | *M* `wpqrIngest.service.js` + test (aggancio estrazione/commit; rimozione doppioni) · *N* `backend/src/controllers/wpqrVerify.controller.js` + test · *M* `backend/src/routes/welding.routes.js` (rotta `POST /welding/wpqr/verify` **prima** delle `:id`) · *N* `…/qualificationVerify/wpqrVerifyLoader.js` + test · *M* `…/verifyReprocess.service.js` + test (dominio WPQR; etichetta record) · *M* `backend/src/controllers/reprocessTasks.controller.js` + test · *M* `reprocessableFields.js` + test (voci `verify_wpqr_*`) · *M* `backend/scripts/reprocess-qualifications.js` (rifiuto chiavi verify, se serve) · *M* `deploy-manifest.json` | pack, registry/engine, schema AI, `WPQR_MANUAL_EDITABLE_FIELDS`, FE |

**Onda 4**

| Slice | File previsti | Cosa NON toccare |
|-------|---------------|------------------|
| WV-6b | *M* `app/src/pages/WeldingProceduresPage.jsx` + test · *M* `app/src/components/IngestReviewDialog.jsx` + test · *M* `app/src/components/WpqrUploadButton.jsx` + test · *M* `app/src/pages/BillingDashboardPage.jsx` (+ `.css`, test) solo se la tabella `items` della verifica non mostra l'etichetta WPQR | `WpqrTestRunsEditor.*`, `QualificationVerifyPanel.*` (solo import), `apiService.js` (metodi già in WV-6a), BE |

**Onda 5**: WV-7 → *M* `backend/src/services/wpsGenerator.service.js` + test · *M* `app/src/utils/wordExportWps.js` + test · *M* `WeldingProceduresPage.jsx` **solo** se serve mostrare le passate nell'anteprima (dopo WV-6b).
**Onda 6**: WV-8 → nuovo `backend/scripts/smoke-wpqr-verifica-test.js`, GUIDA §, `PROJECT_ROADMAP.md`, `DATABASE.md`, questo PLAN.

### 6.3 Dettaglio slice (obiettivo verificabile · DoD · test L1)

Comandi di riferimento: BE `cd backend && npx jest <percorso>` · FE `cd app && NODE_ENV=test npx vitest run <file>` + `npm run build` · repo `node backend/scripts/check-harness-boot.js` e `node backend/scripts/check-utf8-encoding.js`.

**WV-1 — Core.** *Obiettivo*: `verifyWpqr({...}, {mode})` esiste, è puro e restituisce un `VerifyResult` valido (`domain:'wpqr'`) anche con i pack stub vuoti: profilo risolto (`15614-1:BW/FW/UNKNOWN`, `15614-2:BW/FW`, `14555:SW`), `summary` a zero, edizione/norma non coperta → un solo `non_verificabile_fonte_mancante`; 15613 → informativo (§ decisioni). *DoD*: `wpqrRecordView` converte review-fields (ingest) e riga DB (`wpqr_records` + `wpqr_test_runs`, anche assenti) con test di parità; livello default 2; **normalizzazione in memoria** (non persistita) di edizione di `standard_reference`, `current_type` (DC-EP ≡ DCEP) e designazione filler, con test sulle grafie viste in PROD e nessun accesso in scrittura al record; **test di non regressione**: i test esistenti di `verifyEngine`/`verifyRegistry`/pack 9606 verdi **senza modifiche**; il test «pack ⇄ `registerDefaultPacks` ⇄ `deploy-manifest`» copre i nuovi stub; test strutturale nessun import DB/`fs`; riga bussola e `check-harness-boot` verde. *Test*: `npx jest src/services/qualificationVerify`.

**WV-2 — Doc norme.** *Obiettivo*: un estratto che per ogni norma (15614-1 Annex B, 15614-2 Annex A, 14555 Annex C) elenca le righe del modulo, la clausola «shall» che le richiede (§9/§10.4 + 15609-1 §4.x), il campo previsto (§ 2.2–2.3) e i GAP; sistema nel backlog gli stati delle righe aggiunte da WV-0. *DoD*: ogni clausola citata verificata aprendo il Markdown; nessuna soglia inventata; GAP dichiarati (§8.4.7 L1/L2, Tab. 3, Tab. 7 L1, ISO/TR 18491); UTF-8; `check-utf8-encoding` verde.

**WV-3 — Migrazione.** *Obiettivo*: schema di § 2.2 applicabile e reversibile. *Deliverable per **ciascuna** delle due migrazioni (oggi 170 e 171, il deputy ricontrolla dopo `git fetch`)*: `<N>_*.sql` + `<N>_verify.sql` + `<N>_rollback.sql` + **runner `backend/scripts/run-migration-<N>-vps.js`** (modello: `run-migration-158-vps.js`/`159` per l'hardening — `SGQ_MIGRATION_TARGET=test|prod` obbligatoria, guard DB, `CHECK_ONLY=1` — e `169` per il flusso SCP + verify; guida: `docs/how-to/database-migrations.md`) + test L1 dei runner (modello `runMigrationHardening158159.test.js`). `deploy-manifest.json` **non** coinvolto (runner fuori da `backend/src/`). *DoD*: intestazione `-- TYPE: additive`, `-- BACKFILL: none`, `-- VERIFY`, `-- ROLLBACK`; idempotente (`COL_LENGTH`/`OBJECT_ID`), **tabella `wpqr_records` assente → no-op** (CI su DB vuoto, come la 169); FK in **statement separato**, niente `ON DELETE CASCADE`; companion `NNN_verify.sql` (colonne/tabella presenti, FK) e `NNN_rollback.sql` (drop **solo** degli oggetti creati dalla 170, ordinato); `DATABASE.md` aggiornato (ultimo `NNN`, tabella, colonne). **Nessuna applicazione né su TEST né in PROD** (HITL: **sì esplicito** del committente per l'esecuzione dei runner via SCP + SSH); il deputy annota nel body PR cosa serve per applicarle. Stato PROD (07/10/2026): mig. 169 applicata, **nessuna tabella di tracking** → `NNN_verify.sql` controlla **colonne/oggetti**, non un registro. Chiave WPS↔WPQR: **D9 decisata «sì» (07/10/2026)** → secondo file `NNN+1_wps_wpqr_links.sql` con propri verify/rollback (`welding_procedures` è vuota in PROD: momento a costo minimo); solo schema, nessun backfill, nessun codice. Se per quadrare serve toccare colonne esistenti → **Alto**, stop.

**WV-4 — Persistenza + ingest pag. 2.** *Obiettivo*: dalla WPQR 15614 con tabella passate, l'ingest produce passate e condizioni di prova; l'utente le corregge a mano; i record esistenti si completano da Rielaborazioni. *DoD 4a*: **D9 recepita solo se risolta** (chiave WPS→WPQR; altrimenti nessuna modifica a `wps_id`/`wps_ref`); `GET/PUT /welding/wpqr/:id/test-runs` (replace-set in transazione, `organization_id` rispettato, audit event come le altre scritture WPQR); nuove colonne di testata in `WPQR_MANUAL_EDITABLE_FIELDS`; `getWPQR` restituisce le passate; `deleteWPQR` elimina le passate esplicitamente; test controller. *DoD 4b*: `aiExpectedSchema.wpqr` esteso (`test_runs[]` + gruppo A **+ `test_date` e i 10 `*_result`**, oggi mai richiesti all'AI; gruppo B solo dopo campione); **candidati al backfill in PROD: 10 WPQR con PDF** (tutte nell'org. maggiore) — prima di promettere il backfill il deputy verifica l'**esistenza dei file in `/uploads`** (non verificata nel report; 8 staging confermati puntano a WPQR cancellate) e la quota AI (già esaurita una volta); `commitWPQRFromFields` inserisce le passate **solo se non ci sono già** (mai sovrascrive passate manuali); l'ingest riempie `vt_result…macro_result` quando leggibili (altrimenti lascia `NULL`/`NA`, mai un esito dedotto); voci registro `wpqr_*` + `WPQR_REPROCESSABLE_FIELDS` + adapter `wpqr_test_runs` (insert-if-empty) + `reprocessableFields.test.js` e `WRITE_WHITELISTS_BY_TABLE` verdi; `manualEditCompletenessCheck` verde; **round-trip a sentinella** dell'ingest invariato per i campi esistenti. *Test*: `npx jest src/services/wpqrIngest src/controllers/welding src/data/reprocessableFields src/services/wpqrTestRuns`. Percorso ingest critico: smoke in WV-8.

**WV-5a — Completezza.** *Obiettivo*: le righe di § 5.1. *DoD*: test per profilo BW/FW/UNKNOWN, piastra vs tubo (e `product_type` NULL), L1 vs L2 (diametro non essenziale in L1; livello assente ⇒ L2 con `COMP.LEVEL`), con e senza passate (un solo `info` se assenti), arco vs stud; finding `COMP.NORMALIZATION` sulle grafie PROD senza modificare il dato; `pwht = 0` senza avvisi; severità come tabella; ogni finding passa `validateFinding`. *Test*: `npx jest src/services/qualificationVerify/packs/wpqrCompleteness`.

**WV-5b — Correttezza.** *Obiettivo*: le righe di § 5.2 **esclusa** la lista «Non codificate». *DoD*: **15614-1 prioritario** (9 WPQR su 9 con norma in PROD); 15614-2 e 14555 solo su fixture sintetiche (0 record in PROD), possono restare stub se il tempo non basta (dichiararlo nel body PR); test ai bordi (t = 3/12 mm, D = 25 mm, 40 mm, 14555 sezioni stud); over_claim vs under_claim; mai `warn` su dato non verificabile; L1 e >40 mm → fonte mancante (casi dei warning PROD «range spessore fuori tabella»); le funzioni nuove hanno test dedicati e **non modificano** quelle esistenti; se HITL 1–3 sono chiusi nel frattempo si codifica la regola corrispondente citando la clausola confermata, altrimenti resta `non_verificabile_*`.

**WV-5c — Aggancio.** *Obiettivo*: § 1.5. *DoD*: `extractWPQRFromPdf` accoda `message_it` ai `warnings` e aggiunge `verification` **senza cambiare `status`**; `commitWPQRFromFields` idem; `POST /welding/wpqr/verify` (stessa autorizzazione delle rotte WPQR, nessuna scrittura); `wpqrVerifyLoader` tollerante alle colonne assenti (test con `INFORMATION_SCHEMA` simulato); `GET /admin/reprocess-tasks` espone `verify_wpqr_*`; ramo verify **prima** del ramo backfill; test strutturale «nessuna scrittura» esteso; i duplicati di `checkWpqrPlausibility` sul range di spessore rimossi **solo dove il pack produce un finding `verificabile`**; dove il pack risponde `non_verificabile_fonte_mancante` (Level 1, oltre 40 mm) il warning di plausibilità resta (17 casi PROD), con test di non regressione.

**WV-6a — Editor FE.** *Obiettivo*: `WpqrTestRunsEditor` (controlled: `value`, `onChange`, `readOnly`, `standardFamily`) mostra/modifica la tabella passate (colonne di § 2.2; variante stud 14555), con aggiunta/rimozione riga, unità esplicite, validazione al **blur** (min ≤ max), pulsanti sempre visibili con `disabled`+`title`. `apiService.getWpqrTestRuns/saveWpqrTestRuns/verifyWpqr` secondo il contratto del piano (come VQ-2 prima della rotta). *DoD*: DNA UI (copia della schermata, classi esistenti), accenti, nessun `fetch` diretto, riga in `LIBRERIA_UI_SGQ.md`. *Test*: `vitest run src/tests/wpqrTestRunsEditor.test.jsx` + build.

**WV-6b — Integrazione FE.** *Obiettivo*: nella modale WPQR e nella revisione ingest: blocco «Condizioni di prova», editor passate, `QualificationVerifyPanel` che si aggiorna al blur con debounce; offline → nascosto; mai bloccante; riga Rielaborazioni «Verifica WPQR vs norma». *DoD*: regola «URL: query ≠ pagina» (nessun link nuovo; se serve, `routerContext.match.test.js` verde); pulsanti operativi sempre visibili; i test esistenti di `WeldingProceduresPage`/`IngestReviewDialog`/`WpqrUploadButton` non regrediscono.

**WV-7 — Bozza WPS.** *Obiettivo*: § 3. *DoD*: `buildWpsDraft` e Word usano le passate quando ci sono; nessun valore dedotto; apporto termico solo dopo HITL 2; test sul Word (tabella passate popolata/vuota); nessuna modifica dei modi (a)/(b). **In PROD non esiste nessuna WPS salvata** (0 righe): nessun dato WPS da migrare, ma anche **nessun riscontro d'uso reale** del generatore → verifica obbligatoria **con le WPQR reali su TEST/PROD in sola lettura** (generazione di bozza e Word senza salvarli; esito nel body PR).

**WV-8 — Smoke + chiusura.** *Obiettivo*: percorso su TEST (upload WPQR PDF → passate + `verification` presenti, `status` invariato; `POST /welding/wpqr/verify`; report `verify_wpqr_15614_1` senza modifiche ai record), GUIDA (lezione), roadmap, `DATABASE.md`, bussola, spunte nel piano.

---

## 7. Piano di verifica end-to-end

| Livello | Cosa | Quando |
|---------|------|--------|
| **L1 BE** | `npx jest` mirato per slice; contratto su tutti i pack; test «nessuna scrittura»; sync registro ↔ whitelist (per kind); `manualEditCompletenessCheck` | Ogni slice BE |
| **L1 FE** | `NODE_ENV=test npx vitest run` mirato + `npm run build` | Ogni slice FE |
| **Repo** | `check-harness-boot.js`, `check-utf8-encoding.js` | Ogni slice |
| **Migrazione** | apply su DB vuoto (CI «Apply da 169»), verify, rollback; test L1 dei runner `run-migration-<N>-vps.js` (target obbligatorio, `CHECK_ONLY` senza scritture); mai applicata (TEST/PROD) senza sì esplicito | WV-3 |
| **Fixture** | 3–4 WPQR sintetiche complete (15614-1 BW/P con GMAW, FW, 15614-2, 14555 stud) + valori ai bordi | WV-5a/5b |
| **Campione reale** | WPQR reali lette in sola lettura, report non versionato (HITL 1): tasso di `warn` su WPQR note corrette = 0 atteso | Prima di «pronta» per WV-5a/5b |
| **Smoke su TEST** | `SGQ_APP_EMAIL/PASSWORD` → nuovo `smoke-wpqr-verifica-test.js` (accanto a `smoke-ingest-e2e-test.js`) | WV-8 |
| **Smoke ingest esistente** | `node backend/scripts/smoke-ingest-e2e-test.js` invariato verde | WV-4, WV-5c, WV-8 |
| **Smoke post-deploy** | `SGQ_SMOKE_PATHS=login,wps node backend/scripts/smoke-percorsi-critici.mjs` (percorso toccato: WPQR + ingest) | Dopo il deploy di WV-6b e WV-8 |
| **Deploy** | `deploy-manifest.json` per **ogni** `.js` nuovo in `backend/src/`; migrazione via SCP + `run-migration-<N>-vps.js` (i runner nascono in WV-3, l'esecuzione è HITL; `deploy-manifest.json` non li riguarda); restart con verifica **MainPID** | Con il deploy, mai prima |

**HITL che restano**: sì esplicito per qualsiasi migrazione in PROD; risposta alle richieste § 4.1; decisioni D1–D8; consenso se i pack normativi diventano livello **Alto** (D6).

## 8. Rischi aperti

1. **Falsi positivi** sulle WPQR reali (convenzioni dei laboratori, unità, formato dei range): asimmetria `warn`/`info`, `warn` solo con `verificabile`, campione reale, nessun blocco.
2. **WPQR esistenti senza pag. 2**: in PROD **13/13** senza dati di prova strutturati; la verifica sulle passate è muta (un solo `info`) finché non si fanno i backfill (10 candidati con PDF) — ordine d'uso al committente (§ 1.6).
3. **Lettura AI della tabella passate** (celle unite, unità, due colonne «Test piece / Range»): errore plausibile; mitigazioni: revisione umana obbligatoria in ingest, `source = ai` visibile, round-trip a sentinella.
4. **Percorso ingest critico** (`wpqrIngest.service.js`): modifica additiva ma smoke obbligatorio; conflitti serializzati (WV-4 → WV-5c).
5. **Provenienza spessori calcolati** (§ 2.4): un confronto «certificato vs norma» sui range calcolati confronta il codice con sé stesso → regola di provenienza prima di dichiarare `warn`.
6. **Doppia fonte** tra `checkWpqrPlausibility` e pack: gestita in WV-5c (un solo avviso).
7. **Registro Rielaborazioni condiviso con le Qualifiche**: nomi di chiave con prefisso `wpqr_`; `reprocessableFields.js` serializzato (WV-4 → WV-5c).
8. **Nuova tabella nell'adapter**: la rielaborazione oggi aggiorna solo colonne di `wpqr_records` («MAI una INSERT»); l'inserimento delle passate è **insert-if-empty** con test dedicato — se richiede modifiche a `ingestStaging.service.js`, il brief di WV-4 lo dichiara e resta Medio solo se additivo.
9. **Unità e conversioni** (`m/min` vs `mm/s`, `kJ/mm` vs `J/mm`): unità sempre esplicite, nessuna conversione silenziosa.
10. **Contratto congelato troppo presto**: il dominio WPQR è la prova di estensibilità; se serve cambiare `Finding`, stop e handoff.

## 9. Decisioni che spettano al committente

| # | Decisione | Default del piano |
|---|-----------|-------------------|
| D1 | Stesso motore e stesso contratto per la WPQR (dominio `wpqr`), invece di un engine separato | Sì |
| D2 | Tolleranza del confronto validità (solo arrotondamento 0,01 mm; `warn` solo su over_claim) | Sì; da rivedere sul campione |
| D3 | Colonne gruppo B (portata gas, ugello, tungsteno, tubo di contatto) e severità dei `warn` sulle passate incomplete | Colonne nella migrazione, **ingest dopo il campione**; `warn` solo con passata presente |
| D4 | Aggiungere `preheat_temp_test`/`interpass_temp_test` (prova vs range) | No finché il campione non mostra l'ambiguità |
| D5 | Esiti quantitativi di prova (tabella `wpqr_test_results`) | No |
| D6 | Pack normativi: Medio con gate rafforzato o Alto (consenso per ogni merge); colonna `thickness_range_source` | Medio rafforzato + campione reale; colonna no |
| D7 | Edizioni legacy 15614 rilevanti? | Nessuna azione finché non risponde |
| D8 | Usare gli esiti nei semafori di copertura / nei candidati WPS | No (fuori epic) |
| **D9 (DECISA 07/10/2026)** | Chiave esplicita **WPS↔WPQR**: oggi esistono solo `wpqr_records.wps_id` (FK lato WPQR, 0/13 in PROD) e `wpqr_records.wps_ref` (testo, 9/13); `welding_procedures` non ha `wpqr_ref`/`wpqr_id` ed è **vuota** in PROD | **Il committente ha confermato (07/10/2026) che serve una chiave esplicita tra WPS e WPQR.** Forma: tabella di legame additiva **`wps_wpqr_links`** (`id`, `organization_id`, `wps_id`, `wpqr_id`, `role` nullable, `created_at`, `created_by` nullable), **unique `(wps_id, wpqr_id)`**, indice `(organization_id, wpqr_id)`, **FK in statement separati** verso `welding_procedures(id)` e `wpqr_records(id)`, **nessun `ON DELETE CASCADE`**; migrazione additiva con numero dichiarato dal deputy dopo `git fetch origin main` (oggi ultimo **169**: **170** per `wpqr_test_data`, **171** per i legami; il deputy ricontrolla). Perché tabella e non colonna: una WPQR qualifica più WPS e una WPS può poggiare su più WPQR. **Legacy**: le WPS già generate/esistenti e `wps_ref` (testo) restano **senza link** finché l'utente non conferma un collegamento; **nessun backfill, nessuna risoluzione automatica** di `wps_ref`; `wpqr_records.wps_id` non si tocca. **Scelta di slice**: rientra in **WV-3 come secondo file di migrazione separato** (stesso brief DATI, rollback indipendente dalla migrazione dei dati di prova): i file restano nel perimetro `database/migrations/**` + `DATABASE.md` già del brief DATI, quindi **nessun altro brief cambia lista file**. Lettura/scrittura dei link (API, UI, salvataggio dal generatore) **non** è in WV-3: spetta a WV-7 o a una slice dedicata da aprire dopo il merge |

### Backlog del piano (voci collaterali, nessuna nuova slice)

| Voce | Dato PROD | Dove si aggancia | Nota |
|------|-----------|------------------|------|
| **Motivo di rifiuto obbligatorio + log esito suggerito/finale** per ingest e rielaborazioni WPQR (e qualifiche) | 26 staging rifiutati, 16 rielaborazioni rifiutate (4 WPQR) e 26 feedback `rejected` **senza motivo**; esito reale non tracciato | Già in roadmap (priorità 10 «Ingest: raccolta etichette mancanti», analisi HITL 03/10, #694); file: `ingestStaging.service.js`, controller staging, `IngestReviewDialog.jsx` — **fuori** dai file della prima onda e di WV-4 | Raccomandato **prima** del backfill AI di WV-4b: senza motivo non si misura se le nuove voci `wpqr_*` migliorano o peggiorano. Non crea una slice di questo piano; si lancia con il proprio brief |
| Staging confermati orfani (8 puntano a WPQR cancellate) | 8 su 18 | Rielaborazioni WV-4b / WV-5c | Il loader ignora i target non più esistenti; nessuna pulizia automatica |

## Bozza per hub dopo merge

*(da riportare in GUIDA/roadmap solo dopo il merge di questa PR; non toccare ora quei file)*

1. **Roadmap § Stato**: nuova epic «Verifica e archiviazione dati di prova WPQR» — piano `PLAN_VERIFICA_WPQR_SLICES.md`, WV-1…WV-8; prima onda (CORE, NORME_DOC, DATI, EDITOR_FE) lanciabile dopo il merge del charting.
2. **GUIDA § Verifica qualifiche** (nuova sottosezione «Estensione a WPQR»): stesso engine/registry, dominio `wpqr`, contratto `Finding` invariato; la WPQR non ha dati di pag. 2 → report «non verificabile» finché non si fanno i backfill.
3. **GUIDA § WPS**: la bozza WPS usa le passate di prova solo quando archiviate; apporto termico ±25 % solo dopo conferma del PDF (§8.4.7); i modi (a)/(b) restano un epic separato che consuma `wpqr_test_runs`.
4. **Backlog norme**: richieste HITL 1–4 (campione WPQR, §8.4.7/Tab. 3/Tab. 7 L1, ISO/TR 18491 + 17671-1, legacy).
5. **`DATABASE.md`**: oggi stantio (168/169); allineare con WV-3 (ultimo `NNN`), tabella `wpqr_test_runs` e colonne di testata.

## Esito sessione di charting (07/10/2026)

- Piano e quattro brief di prima onda scritti; righe di backlog norme aggiunte; sezione «Dati PROD» integrata il 07/10/2026 con il report di raccolta dati in sola lettura (aggregati anonimi; report integrale fuori da Git) e relative implicazioni. **Nessuna** slice eseguita, nessun codice, nessuna migrazione.
- Spunte DoD: da compilare slice per slice (WV-1 … WV-8) nelle sessioni di esecuzione.
