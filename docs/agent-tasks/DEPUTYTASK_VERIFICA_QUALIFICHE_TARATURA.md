# DEPUTYTASK_VERIFICA_QUALIFICHE_TARATURA — VQ-TUNE: taratura delle regole 9606-1 sulla misura dei dati reali

**Stato:** CHIUSO — TEST OK (06/10/2026)  
**Aperto:** 06/10/2026  
**Piano:** [`PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md`](PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md) § 1.3 (contratto), § 4.1 (completezza), § 4.2 (correttezza)  
**Fonte della misura:** [`docs/reference/VERIFICA_QUALIFICHE_CAMPIONE_DB_2026-10-06.md`](../reference/VERIFICA_QUALIFICHE_CAMPIONE_DB_2026-10-06.md) (PR #726, solo aggregati anonimi)  
**Dipende da:** VQ-5 (pack completezza) e VQ-6 (pack correttezza) già su `main`  
**Rischio:** **Medio** — solo BE, nessuna migrazione, nessuna route, nessun deploy. Le modifiche **abbassano** la severità (`warn` → `info`) o leggono un campo in più; nessuna nuova regola normativa, nessuna soglia nuova.  
**Stream:** `DEPUTYTASK_VERIFICA_QUALIFICHE_*.md`  
**Branch:** `cursor/vq-tune-b8ef`  
**Contesto consigliato:** default/basso (non 1M)

---

## Obiettivo (una slice = un risultato verificabile)

Tarare le regole 9606-1 già su `main` **solo dove la misura sul tenant reale (143 record) lo ha dimostrato**: ridurre i falsi positivi di `COMP.THK_VALIDITY`, non emettere `warn` su interpretazioni non esplicite (Tab. 7 su cordoni d'angolo), non emettere `warn` su regole senza base empirica o circolari (`PROCESS`, `DESIGNATION`), e chiudere il caso dei simboli di posizione che la tabella non riconosce. I `warn` veri (date di conferma, filler FM inesistente o assente, spessore/diametro BW/posizioni oltre la norma) restano `warn`.

## Gate norme (dichiarato)

- **Coperte:** ISO 9606-1:2017 (`NORMA_00018`) §5.2, §5.7 (Tab. 6/7/8), §5.8 (Tab. 9/10), §11; estratto [`ISO-9606-1-range-validita-patentino.md`](../reference/ISO-9606-1-range-validita-patentino.md).
- **Mancanti:** nessun testo nuovo richiesto. Non si codificano clausole né soglie nuove: ogni modifica è una **riduzione di severità** o una lettura di un campo già in tabella (`thickness_range`).
- **Si parte su:** la misura del 06/10/2026 (rapporto in `docs/reference/`).
- **GAP dichiarato (HITL):** significato del token **«PH-L045»** — vedi § GAP.

## Checklist dato ↔ norma ↔ UI ↔ API

| Dato | Clausola / fonte MD | UI | API / persistenza |
|------|---------------------|----|-------------------|
| `thickness_range` (testo legacy) letto dalla vista | §5.7 Tab. 6/8 (la validità resta quella dichiarata; il testo è solo ripiego di lettura) | nessuna (pannello VQ-2 mostra i finding) | nessuna: colonna già esistente, aggiunta alla `SELECT` del loader (sola lettura) |
| Simbolo di posizione `HL045` / `H_L045` / `H–L045` | §5.8 Tab. 9 (`H-L045`, `J-L045`) | nessuna | nessuna |
| Severità `PIPE_DIAMETER` FW, `PROCESS`, `DESIGNATION` circolare | §5.7 Tab. 7 (FW: interpretazione), §5.2, §11 | nessuna (cambia solo `severity`) | nessuna |

## File toccati

- `backend/src/services/qualificationVerify/packs/welder9606Completeness.pack.js` + `.test.js`
- `backend/src/services/qualificationVerify/packs/welder9606Correctness.pack.js` + `.test.js`
- `backend/src/data/weldingQualificationRules9606.js` + `.test.js` e mirror `app/src/data/weldingQualificationRules9606.js` + `app/src/tests/weldingQualificationRules9606.test.js`
- `backend/src/services/qualificationVerify/qualificationRecordView.js` + `.test.js` (**una sola riga**: `thickness_range` tra i campi testo della vista)
- `backend/src/services/qualificationVerify/verifyRecordLoader.js` + `.test.js` (**una sola riga**: `thickness_range` tra le colonne opzionali della `SELECT`; vedi § Deviazione dal perimetro)
- *Nuovo* `backend/src/services/qualificationVerify/verifyRealPatterns.test.js` (le 22 fixture sintetiche del documento + varianti di taratura)
- *Nuovo* questo brief

## Cosa NON toccare

`IngestReviewDialog`, `QualificationForm`, `QualificationsPage`, `QualificationUploadButton` (VQ-9); `weldingQualificationRules9606Part2.js`, `welder9606Part2.pack.js`, `jointTypeProfiles.js` ×2, `reprocessableFields.js` (VQ-10); `weldingDesignation.js` ×2, `qualificationIngest.service.js` (VQ-BW-S); migrazioni, auth/sync/JWT, PLAN, GUIDA, roadmap.

## Cosa è stato fatto (per punto)

### 1. `COMP.THK_VALIDITY` (5 FP su 22 `warn`, tutti «t≥3» senza flag)

Scelta: **lettura del campo legacy `thickness_range` + declassamento del solo massimo mancante**, senza inferire nulla nelle colonne.

- La vista (`qualificationRecordView.js`) espone `thickness_range` come testo. Il loader lo include nella `SELECT` (senza questa riga, in modalità `db` l'inferenza non vedrebbe mai il testo: la misura l'ha usato, il prodotto no).
- Il pack interpreta il testo con un parser stretto (`parseLegacyThicknessRange`): «3-18 mm», «3 – 12.6 mm», «t≥3», «t>=3», «≥ 3 mm», «da 3 mm», «min 3», «3-…», «3 - ...», «3 mm -», «3 mm senza limite», «fino a 18 mm». Testo non interpretabile → nessuna inferenza.
- Regola finale (limite **minimo** = dato senza convenzione di ripiego; **massimo** mancante = convenzione «da X, senza limite superiore», Tab. 6 s ≥ 12 / Tab. 8 t ≥ 3):

| Colonne | Testo legacy | Esito |
|---|---|---|
| min e max (o «senza limite») | — | nessun finding |
| solo min | «t≥3», «≥ 3 mm», «3-…» (limite aperto) | **info** («testo legacy lo esprime: senza limite superiore») |
| solo min | «3-18 mm» (massimo nel testo) | **info** («presente solo nel testo legacy») |
| solo min | assente / non interpretabile | **info** («solo minimo: convenzione normale, verificare il flag») |
| min e max vuoti | interpretabile («3-12.6 mm», «≥3») | **info** |
| min e max vuoti | assente / non interpretabile | **warn** (manca davvero l'informazione) |
| min vuoto, max presente | non restituisce il minimo | **warn** (nessuna convenzione per il minimo) |

- Perché non propagare l'inferenza al flag `thickness_max_unlimited` della vista: la correttezza (`THK_BW`/`THK_FW`) giudicherebbe «senza limite» come claim e potrebbe emettere `warn` da un campo di testo libero. Meglio un `info` in completezza e nessuna modifica semantica alla vista.
- Effetto atteso sul tenant misurato: classi C (5 FP) → `info`; classi A+B (11) → `info` se `thickness_range` è valorizzato; classe D (3, vero buco) → `warn`. Warn `THK_VALIDITY`: 19 → **3** (stima del documento § 5.1).

### 2. `CORR.PIPE_DIAMETER` sui giunti d'angolo (FW)

Il Markdown `NORMA_00018` §5.7 dà per i cordoni d'angolo la sola Tab. 8 sugli spessori; la Tab. 7 è presentata per i giunti di testa. Per `joint_type = FW`: **mai `warn`**, al massimo `info` con nota «Interpretazione, non clausola esplicita…». BW invariato (warn se il minimo/massimo è più largo di Tab. 7). Il caso «diametro di prova assente» resta `non_verificabile_dato_mancante`. (La completezza `COMP.PIPE_DIAMETER` non è stata toccata: la misura non l'ha fatta scattare.)

### 3. Alias di posizione (`PH-L045`) — **parzialmente applicato, con GAP**

Letto `NORMA_00018` §5.8 (righe 664–686) e `ISO-9606-1-range-validita-patentino.md`: la norma definisce **solo** `PH`, `PJ` (tubo), `H-L045`, `J-L045` come righe di Tab. 9; descrive «PH + PC» come copertura di `H-L045` ma **non** definisce mai la forma composta `PH-L045`. Il significato non è certo dal testo → **NON mappato** (regola di slice). Applicata solo la normalizzazione **grafica** certa dello stesso simbolo (`normalizeWeldingPositionSymbol`, BE + mirror FE): maiuscole, trattini tipografici, underscore e trattino assente → `HL045`, `h_l045`, `H–L045` = `H-L045` (idem `J-L045`). `PH-L045` / `PJ-L045` restano non riconosciuti → `non_verificabile_dato_mancante`, mai `warn` (test dedicati).

### 4. `PROCESS` e `DESIGNATION`

- `CORR.PROCESS`: scarto di processo oltre §5.2 → **`info`** (costante `PROCESS_OVER_CLAIM_SEVERITY`, una riga da riportare a `warn` dopo il backfill e una nuova misura). Validità assente → nessun finding (invariato: mai `warn`); processo di prova assente/multiplo con validità presente → `non_verificabile_dato_mancante` (invariato). Test: nessuna combinazione produce `warn` di correttezza su `PROCESS`.
- `CORR.DESIGNATION`: **circolare** se la designazione contiene token di range di validità (`t≥3`, `t3-18`, `D≥60,3`, `D25-50`) o coincide con quella ricostruita da `buildWelderQualificationDesignation` sulle colonne di validità del record. In quel caso `info` con nota «controllo circolare»; designazione stampata sul certificato (non circolare) → `warn` come prima.
- `COMP.CONFIRMATION_INTERVAL` / `CORR.CONFIRMATION_INTERVAL` e `FILLER_GROUP` (completezza e correttezza): **invariati, restano `warn`**.

### 5. Test di regressione

`verifyRealPatterns.test.js`: le **22 fixture sintetiche** del documento § 10 (S01–S22) più varianti di taratura (S02b/c, S03b, S12b), eseguite sul motore completo (`mode: 'db'`), con elenco **esatto** dei `warn` attesi, validazione di ogni finding e verifica dei `info` attesi. Nessun dato reale. Test dei due pack aggiornati/estesi (parser legacy, FW, PROCESS, DESIGNATION, posizioni).

## Effetto sui numeri (fixture sintetiche, prima → dopo)

Calcolato eseguendo le stesse fixture sul codice di `main` (972ded5a) e su questo branch:

| Fixture | Prima | Dopo |
|---|---|---|
| S02 «t≥3» (max vuoto, nessun testo) | `COMP.THK_VALIDITY` warn | info |
| S02b / S02c (testo «3-18 mm» / «≥ 3 mm») | warn | info |
| S03b (colonne vuote, testo «3-12.6 mm») | warn | info |
| S12b (FW tubo, minimo più largo di Tab. 7) | `CORR.PIPE_DIAMETER` warn | info |
| S19 (prova 141, validità «141, 135») | `CORR.PROCESS` warn | info |
| S03, S04, S05, S06, S08, S10, S13, S16, S17, S18 | warn | **warn (invariati)** |
| S01, S07, S09, S11, S12, S14, S15, S20, S21, S22 | nessun warn | nessun warn |

Sulle **22 fixture del documento**: `warn` 12 → **10** (S02 e S19 declassati). Con le 4 varianti di taratura: 16 → 10.

## Deviazione dal perimetro (dichiarata)

`verifyRecordLoader.js` non era nell'elenco dei file consentiti: una riga (`'thickness_range'` in `OPTIONAL_COLUMNS`) è **indispensabile** perché l'inferenza del punto 1 funzioni nella modalità `db` (Rielaborazioni, misura). Il file non è toccato da VQ-9/VQ-10/VQ-BW-S; la colonna è già presente su `qualifications` e il loader resta tollerante se manca. Se la scelta non è gradita, basta annullare quella riga: il pack ricade sul declassamento «solo minimo → info» (i 5 FP restano risolti; le classi A/B perdono solo il testo di spiegazione).

## GAP e HITL

- **`PH-L045`** (17 record BW/T, 12% del corpus): significato non definito in `NORMA_00018` né nell'estratto. Ipotesi plausibile («P» prefisso + `H-L045`) **non verificata**. HITL: guardare 2–3 certificati con quel token (PDF/Annex A del modulo dell'ente) e dire se è `H-L045`; poi alias di una riga in `normalizeWeldingPositionSymbol` (BE + FE) + test.
- **`THK_BW` con «BRANCH»** (S18): il documento propone `info`; **non applicato** (fuori dall'elenco della slice). Resta `warn`, documentato nella fixture S18.
- **Rumore da `info` `COMP.*_TEST`** (96% dei record fino al backfill): non toccato (suggerimento del documento: aggregazione in UI).
- **Regole di plausibilità non normative** (conferma < esame; prossima conferma > scadenza): non implementate (nuove regole, fuori slice).

## Rischi

- Le classi A/B restano `info` anche se il certificato dichiarasse un massimo diverso dal flag: la validità del certificato prevale, ma un vero errore di estrazione sul massimo non genera più `warn`. Mitigazione: il messaggio `info` riporta il testo legacy e l'utente lo vede nel pannello.
- `PROCESS` e `DESIGNATION` a `info` allargano la tolleranza: da rivalutare dopo il backfill delle colonne `*_test` e una nuova misura.
- Il parser legacy è volutamente stretto: testi non previsti (es. «3÷18») non vengono interpretati e ricadono nel `warn` solo se mancano entrambi i limiti.

## Test L1 eseguiti

- `cd backend && npx jest src/services/qualificationVerify src/data/weldingQualificationRules9606` — verdi tutti i test della slice; restano **4 fallimenti preesistenti su `main`** in `verifyReprocess.service.test.js` (fixture con record scheletro che ora ricevono i `warn` di completezza dei pack VQ-5/6; non toccati da questa slice, nessuna regressione rispetto a `main`).
- `cd app && NODE_ENV=test npx vitest run src/tests/weldingQualificationRules9606.test.js` + `npm run build`
- `node backend/scripts/check-harness-boot.js` · `node backend/scripts/check-utf8-encoding.js`

## Rielaborazioni (Registro)

**Esenzione dichiarata:** nessun nuovo campo AI-estraibile, nessuna colonna, nessun valore persistito. `thickness_range` è un campo legacy già esistente, solo letto.

## DoD

- [x] `THK_VALIDITY`: «t≥3» e testo legacy interpretabile non producono più `warn`; `warn` solo se manca il minimo (o entrambi i limiti) senza testo utile
- [x] `PIPE_DIAMETER` FW: mai `warn`, nota «interpretazione, non clausola esplicita»
- [x] Alias posizione: normalizzazione grafica certa; `PH-L045` non mappato, GAP segnalato
- [x] `PROCESS` e `DESIGNATION` circolare a `info`; `CONFIRMATION_INTERVAL` e `FILLER_GROUP` invariati
- [x] 22 fixture sintetiche come test; `warn` veri invariati
- [x] Nessuna migrazione, nessun deploy, nessun accesso DB/VPS, nessun file di VQ-9/VQ-10/VQ-BW-S
- [x] Branch allineato a `origin/main` prima di ogni push; `bugbot run` una sola volta a slice chiusa

## Comando di avvio

`Leggi docs/agent-tasks/DEPUTYTASK_VERIFICA_QUALIFICHE_TARATURA.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Handoff

_(vuoto — slice chiusa; seguito: misura post-backfill delle colonne `*_test` e HITL su `PH-L045`)_
