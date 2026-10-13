# Piano slice — Verifica qualifiche vs norma (completezza + correttezza)

> **Destinazione**: mentre si legge un certificato di qualifica (saldatore ISO 9606-1/-2, operatore ISO 14732) il sistema confronta i dati con la norma in **entrambi i versi** — *completezza* (i campi che la norma pretende sul certificato ci sono?) e *correttezza* (dalla prova dichiarata, la validità ricalcolata dalla norma coincide con quella scritta sul certificato?) — e mostra **avvisi non bloccanti con la clausola citata**. La conferma resta sempre umana. Lo **stesso controllo** gira sui record già nel DB da Fatturazione → Rielaborazioni, in sola lettura.
> **Principio guida**: *la validità scritta sul certificato prevale*. Il ricalcolo serve a segnalare, mai a sostituire né a riscrivere un dato.
> **Spec / ADR**: [`PLAN_RIUNIONE_2026-10-03.md`](PLAN_RIUNIONE_2026-10-03.md) § 1 · [`ISO-9606-1-range-validita-patentino.md`](../reference/ISO-9606-1-range-validita-patentino.md) · [`ISO-14732-operatori-saldatura.md`](../reference/ISO-14732-operatori-saldatura.md) · [`AUDIT_NORME_QUALIFICHE_PDF_2026-10-04.md`](../reference/AUDIT_NORME_QUALIFICHE_PDF_2026-10-04.md) · [`PLAN_COPERTURA_SCALABILE_SLICES.md`](PLAN_COPERTURA_SCALABILE_SLICES.md) (stesso spirito registry)
> **Brief attivi**: nessuno. Tutti i brief `DEPUTYTASK_VERIFICA_QUALIFICHE_*` esistenti (VQ-1…VQ-10, VQ-TUNE, VQ-BW-S) sono **CHIUSI** su `main`, compresi i quattro della prima onda ([`CORE`](DEPUTYTASK_VERIFICA_QUALIFICHE_CORE.md) #718, [`PANEL_FE`](DEPUTYTASK_VERIFICA_QUALIFICHE_PANEL_FE.md) #716, [`NORME_DOC`](DEPUTYTASK_VERIFICA_QUALIFICHE_NORME_DOC.md) #719, [`RIELAB_FE`](DEPUTYTASK_VERIFICA_QUALIFICHE_RIELAB_FE.md) #715). Restano senza brief VQ-11 (14732: pack ancora stub) e VQ-12 (smoke + chiusura). Gli unici `DEPUTYTASK*` APERTI sono i quattro `DEPUTYTASK_VERIFICA_WPQR_*` (epic separato, vedi [`PLAN_VERIFICA_WPQR_SLICES.md`](PLAN_VERIFICA_WPQR_SLICES.md)).
> **Tipo di sessione**: charting (Lead). Nessun codice di prodotto, nessuna migrazione, in questa PR.

## Fuori scope

- Blocchi, rifiuti o correzioni automatiche di un certificato: gli esiti sono **sempre** avvisi (`info` / `warn`), mai errori che impediscono il salvataggio.
- Sostituire o riscrivere `qualification_designation`, `thickness_min_mm`, `pipe_diameter_*`, `welding_positions` con il valore ricalcolato (validità batte designazione, validità batte ricalcolo).
- Verifica WPQR/WPS (ISO 15614-x, 15613, 14555): **epic separato**; il registry è progettato per ospitare un dominio `wpqr_*` più avanti, ma non si fa qui. `checkThicknessRangeAgainstIso15614Level2` resta dov'è.
- ISO 9606-3/-4/-5 (rame, nichel, titanio), ISO 9712 (CND): fuori; nel registry compaiono come `non_verificabile_fonte_mancante` informativo, non come regole.
- Modifica dei semafori di copertura (`welder9606.adapter`, `wpsWelderCoverage`): la verifica **non** li altera (vedi «Non ancora specificato»).
- Nuove colonne per campi Annex A oggi non modellati (corrente/polarità, job knowledge, riferimento WPS, prove eseguite, metodo di rivalidazione, prova d'angolo supplementare): decisione D7.
- Regole applicative 78x (prigionieri, ISO 4063:2023): appartengono a 14555, non a 9606.
- Acrobat, JEV, classificatore locale, scheduler automatico (ogni lancio resta manuale).

## Non ancora specificato

- Persistenza di una «presa visione» degli avvisi (audit trail): serve solo se il committente la vuole → D3 (eventuale migrazione, Alto).
- Tolleranza numerica del confronto validità certificato ↔ tabella: la norma (§5.7) dice che spessori e diametri «non vanno misurati con precisione»; il piano usa **nessuna tolleranza oltre l'arrotondamento a 0,01 mm** e segnala `warn` solo per **eccesso** (certificato più largo della norma). Da rivedere sui campioni reali (D2).
- Uso degli esiti nei semafori di copertura commessa (es. degradare `match` → `partial` se il certificato dichiara più della norma): fuori da questa epic, decisione committente.
- Certificati multi-processo (111+135, Tab. 1 ISO 9606-1): oggi `welding_process_test` è singolo; la regola è `non_verificabile_dato_mancante` (modello), non codificata.
- Verifica del requisito «≥ 3 passate» per `s ≥ 12 mm` (Tab. 6 nota e): non c'è un dato strutturato dei passaggi → sempre `info` non verificabile.
- Ordine di rilascio 14732: parte A su estratto (severità massima `info`), parte B su testo integrale dopo HITL (vedi § 3, richiesta 1).

## Decisioni già prese (charting 06/10/2026)

- **Modulo puro a registry**, nuova cartella `backend/src/services/qualificationVerify/` — stesso schema di `capabilityCoverage/` (registry + engine + adapter/pack), nessun `if (9606) else` nell'engine.
- **Nessuna migrazione, nessuna persistenza dei finding**: sono derivati deterministici dalle colonne del record + edizione norma; ricalcolati a ogni richiesta (ingest, review, DB). Se in futuro serve la «presa visione» → D3.
- **Aggancio ingest** (vedi § 1.5): al momento della **estrazione** (staging) e al **commit** i finding diventano (a) stringhe in `warnings` (già persistite in `ingest_staging.warnings_json`, nessuno schema nuovo) e (b) oggetto strutturato `verification` nella risposta API; durante la **review** la UI chiama l'endpoint stateless `POST /qualifications/verify` a ogni **blur** (mai a ogni tasto).
- **Voce Rielaborazioni di tipo `verify`**: sola lettura, nessuna chiamata AI, nessun file letto da disco, nessuna scrittura (§ 2).
- **Asimmetria severità**: certificato **più largo** della norma (over-claim) o campo **richiesto dalla norma** assente = `warn`; certificato **più stretto** (under-claim), campo non essenziale, dato non verificabile = `info`.
- **Tre stati** di verificabilità (estensione al contratto richiesto, D1): `verificabile` · `non_verificabile_fonte_mancante` (testo norma assente/non digitalizzato/edizione non coperta) · `non_verificabile_dato_mancante` (il record non ha l'input per ricalcolare, o la combinazione non è modellata).
- **Profili** (chiavi registry): `9606-1:BW`, `9606-1:FW`, `9606-1:UNKNOWN` (giunto non letto: solo regole comuni), `9606-2:BW`, `9606-2:FW`, `14732`. Edizioni 9606-1 coperte: 2017, 2013, 2012 (stesso testo: la EN ISO 9606-1:2017 è ISO 9606-1:2012+Cor 1+Cor 2 «senza modifiche», NORMA_00018 «European foreword»). Altre edizioni/norme → `non_verificabile_fonte_mancante` (es. EN 287-1).
- **Contratto-primo**: il contratto `Finding` sotto è **congelato nel piano**; ogni slice produce/consuma oggetti semplici conformi, la conformità è verificata da `validateFinding` (slice VQ-1) su tutti i pack registrati.

## Gate norme (dichiarazione obbligatoria, 3 righe)

```text
Fonti Markdown:
- Coperte: ISO 9606-1:2017 (NORMA_00018 + estratto; Tab. 6/8/9/10 ricostruite da glifi, Tab. 7 leggibile; §5.1, §5.2, §5.3, §5.4, §9, §10, §11, Annex A leggibili) · ISO 9606-2:2004 (NORMA_00032, tabelle 2-8 + §9 + Annex A leggibili, NESSUN estratto in docs/reference) · ISO 4063:2023 (NORMA_00044) · ISO 14175:2008 (NORMA_00012) · ISO 14732:2013 solo come estratto OCR · ISO/TR 15608 e ISO 6947 solo come estratto sintetico.
- Mancanti (non bloccano la prima onda): testo integrale 14732 (blocca solo la parte B 14732) · EN 287-1 / 9606-1:2004 (certificati legacy) · 9606-1 Tab. 3/4/5/11/12 con celle «×» da confermare a livello di glifo · TR 15608 integrale / CR ISO 15608 (gruppi Al 21–26) · ISO 6947 integrale · 9606-3/-4/-5.
- Si parte su: ISO 9606-1:2017 BW/FW (completezza §5.1/§10/Annex A + ricalcolo Tab. 6/7/8/9/10 + §5.2 + §5.3) come prima onda; 9606-2:2004 in terza onda (norma già in repo, serve solo l'estratto operativo); 14732 parte A su estratto.
```

---

## 1. Architettura

### 1.1 Cosa esiste già e cosa si riusa (gate Ponytail)

| Oggi | Dove | Riuso nella verifica |
|------|------|----------------------|
| Tabelle 6/7/8/9/10 come funzioni pure | `backend/src/data/weldingQualificationRules9606.js` (`computeQualifiedThicknessRangeButtWeld`, `computeQualifiedFilletThicknessRange`, `computeQualifiedPipeDiameterRange`, `computeQualifiedWeldingPositions`, `isWeldingPositionQualified`, `getApplicableWelderFields`, `CONTINUOUS_WIRE_ARC_PROCESSES`) | **Unica fonte dei numeri.** Oggi usate solo dal prompt AI (`buildWelderQualificationRulesPromptSection`) e dal form. La verifica le importa; **non** ricopia tabelle. Manca la funzione per le **equivalenze di processo** (§5.2): esiste solo come prosa nel prompt → si aggiunge in questo file (VQ-6) e il prompt la richiama, così prompt e verifica non divergono. |
| Quali campi sono visibili/applicabili per BW/FW, P/T | `backend/src/data/jointTypeProfiles.js` (+ copia FE) — `getVisibleFieldKeys`, `isPipeDiameterApplicable`, `uses9606DimensionalBlock` | Le regole di completezza partono da `getVisibleFieldKeys({jointType, productType, qualificationType}).keys` e **filtrano** su ciò che la norma pretende: niente seconda lista «campi per profilo». Per 9606-2 serve una variante per norma (BW usa `t` del materiale, non `s` depositato): VQ-10. |
| Parser designazione stampata | `backend/src/utils/weldingDesignation.js` (`parseWelderQualificationDesignation`) | Regola di coerenza designazione ↔ colonne di **prova**. |
| Controlli di plausibilità | `backend/src/utils/ingestPlausibilityChecks.js` (ordine date, range invertiti, gas 14175, filler 14341, 15614 Level 2) | Restano per i controlli **non normativi di tabella** (date incoerenti, range invertiti). `checkShieldingGasKnown` viene **richiamato dal registry** (regola gas) e tolto da `checkQualificationPlausibility` per non avere due avvisi uguali (VQ-7). |
| Catalogo gas / processi / gruppi / posizioni | `shieldingGases14175.js`, `weldingProcesses4063.js`, `materialGroups15608.js`, `weldingPositions6947.js` (backend `src/data/`) | Validazione codici. |
| Adapter copertura `welder9606` | `capabilityCoverage/adapters/welder9606.adapter.js` | **Non** viene chiamato né modificato: risolve un altro problema (requisito commessa ⇄ capacità). Condivide solo le funzioni di regola e i profili sopra. |
| Registro Rielaborazioni | `reprocessableFields.js`, `reprocessTableAdapters.js`, `qualificationReprocess.service.js`, `reprocessTasks.controller.js` | Estensione minima `kind: 'verify'` (§ 2). |

### 1.2 Struttura del modulo (nuova cartella, nessun `if (norma)` nell'engine)

```text
backend/src/services/qualificationVerify/
  findingTypes.js            costanti + validateFinding + makeFinding
  qualificationRecordView.js vista canonica da review-fields (ingest) o riga DB; risolve standard/edizione/profilo
  verifyRegistry.js          registerRulePack / listRulePacks / resolveProfileKey
  verifyEngine.js            verifyQualification(recordOrFields, opts) → result
  registerDefaultPacks.js    elenco ESPLICITO dei pack (come registerDefaultAdapters.js di capabilityCoverage)
  index.js
  packs/
    welder9606Completeness.pack.js    (VQ-5)  famiglia «completezza» 9606-1 BW/FW/UNKNOWN
    welder9606Correctness.pack.js     (VQ-6)  famiglia «correttezza» 9606-1 BW/FW
    welder9606Part2.pack.js           (VQ-10) 9606-2 BW/FW (completezza + correttezza)
    operator14732.pack.js             (VQ-11) 14732
  verifyRecordLoader.js      (VQ-8)  SELECT dal DB con colonne tolleranti (migrazione 168 non assunta)
  verifyReprocess.service.js (VQ-8)  conteggio candidati + report per Rielaborazioni
```

`verifyEngine` e il registry **non importano** `config/database`, `fs`, né servizi con DB. Solo `verifyRecordLoader.js` e `verifyReprocess.service.js` toccano il DB (sola `SELECT`); un test strutturale lo impone (nessun `UPDATE|INSERT|DELETE|MERGE` nel modulo, nessun import `createStagingRecord`).

`VQ-1` crea **anche i quattro file pack come stub** (`rules: []`) e l'elenco in `registerDefaultPacks.js`: ogni slice successiva sovrascrive **solo il proprio pack**, nessuna tocca il registro condiviso. È ciò che rende le onde 2–3 parallele.

### 1.3 Contratto di output (congelato)

```text
Finding = {
  code:          string   // stabile, mai rinominato: '<NORMA>.<famiglia>.<NOME>' es. 'WQ9606_1.CORR.THK_BW'
  family:        'completezza' | 'correttezza'
  severity:      'info' | 'warn'          // nessun valore 'error': nessun blocco
  status:        'verificabile' | 'non_verificabile_fonte_mancante' | 'non_verificabile_dato_mancante'
  field:         string                    // chiave colonna/review (es. 'thickness_max_mm'); se più campi: il principale
  fields:        string[]                  // opzionale, tutti i campi coinvolti
  direction:     'missing' | 'over_claim' | 'under_claim' | 'mismatch' | null
  read_value:    any                       // valore letto sul certificato/record (null se assente)
  expected_value:any                       // valore atteso dalla norma (null se non calcolabile)
  source: {
    norm:        'ISO 9606-1' ...
    edition:     '2017' ...
    clause:      '§5.7 Tab. 6'             // OBBLIGATORIA se status = verificabile
    text_status: 'md_integrale' | 'estratto' | 'estratto_ocr' | 'assente'
    ref:         'docs/Normative/… NORMA_00018 …' oppure 'docs/reference/…md'
  }
  message_it:    string                    // frase pronta per UI/warnings, con clausola citata, accenti corretti
}

VerifyResult = {
  profile:        '9606-1:BW' | … | null   // null = norma/edizione non coperta
  standard:       { family: '9606-1'|'9606-2'|'14732'|null, edition: string|null }
  findings:       Finding[]                // ordinati: warn prima di info; completezza prima di correttezza
  summary:        { warn: n, info: n, verificabili: n, non_verificabili: n }
  engine_version: string
  mode:           'ingest' | 'review' | 'db'
}
```

Invarianti verificati da `validateFinding` (test su **tutti** i pack registrati, anche quelli futuri):
1. nessun finding ha `blocking`/`error`; 2. `status = verificabile` ⇒ `source.clause` valorizzata e `text_status ≠ assente`; 3. `status ≠ verificabile` ⇒ `severity = info`; 4. `expected_value` mai usato per scrivere (il modulo non esporta funzioni di scrittura); 5. `message_it` contiene la clausola quando `verificabile`; 6. `code` unico nel registry; 7. nessuna regola lancia: un'eccezione in una regola diventa un finding `info` `…ENGINE.RULE_ERROR` (l'ingest non si rompe mai).

### 1.4 Due famiglie di regole + principio «validità prevale»

| Famiglia | Domanda | Esempi (codici) | Regola di lettura |
|----------|---------|-----------------|-------------------|
| **completezza** (`COMP`) | I campi che la norma richiede sul certificato sono presenti? | `WQ9606_1.COMP.MATERIAL_GROUP`, `…COMP.THK_VALIDITY`, `…COMP.POSITIONS`, `…COMP.SHIELDING_GAS` | Derivata da §5.1 (variabili essenziali), §9.1, §10 (non essenziali: corrente/polarità, gruppo materiale, gas), §11 (designazione), Annex A. Mancanza di un essenziale = `warn`; non essenziale/prova = `info`. |
| **correttezza** (`CORR`) | Dalla **prova** dichiarata, la **validità** attesa dalla norma coincide con quella scritta? | `…CORR.THK_BW`, `…CORR.THK_FW`, `…CORR.PIPE_DIAMETER`, `…CORR.POSITIONS`, `…CORR.PROCESS`, `…CORR.DESIGNATION`, `…CORR.CONFIRMATION_INTERVAL` | Se il certificato è **più largo** della norma → `warn` (`over_claim`); più stretto → `info` (`under_claim`: il rilascio può restringere); uguale → nessun finding. Se manca l'input di prova → un solo finding `non_verificabile_dato_mancante` (non una pioggia). |

**Validità prevale:** l'engine non restituisce mai un «valore corretto da applicare». `expected_value` è informativo, mostrato come «la norma darebbe…». I campi validità (`thickness_min/max`, `pipe_diameter_min/max`, `welding_positions`, `welding_processes_validity`) restano quelli del certificato; il ricalcolo parte **solo** dalle colonne di *prova* (`thickness_s_test_mm`, `thickness_t_test_mm`, `pipe_diameter_test_mm`, `welding_position_test`, `welding_process_test`) introdotte dalla fetta 05/10.

### 1.5 Dove si aggancia (staging / review / commit / DB)

| Momento | Dove | Cosa succede | Non succede |
|---------|------|--------------|-------------|
| **Estrazione** (PDF → staging) | `extractQualificationFromPdf` in `qualificationIngest.service.js`, subito dopo `checkQualificationPlausibility` | `verifyQualification(reviewFields, {mode:'ingest'})` → `message_it` accodati a `warnings` (finiscono in `warnings_json` come oggi) + `verification` nell'oggetto restituito (e quindi nella risposta di `uploadBatch`) | Nessun cambio di `status` (`pending_review`/`duplicate`/`wrong_module`), nessun blocco |
| **Review** (utente modifica i campi) | `POST /qualifications/verify` (nuovo controller `qualificationVerify.controller.js`, route accanto a `coverage/verify`, **prima** delle rotte `:id`) — stateless, nessuna scrittura | Pannello `QualificationVerifyPanel` si aggiorna al **blur**; funziona identico per modulo ingest, form manuale, coda Rielaborazioni | Nessun tasto-per-tasto; offline = pannello nascosto con messaggio, il salvataggio non dipende da esso |
| **Commit** (conferma umana) | `commitQualificationFromFields` | Ricalcolo sui campi finali; `message_it` nei `warnings` di ritorno (toast/riepilogo) | Il commit **non** dipende dall'esito; nessun campo viene modificato dal verificatore |
| **DB esistente** | Rielaborazioni `kind: 'verify'` (§ 2) | Report on-demand | Nessuna scrittura |

Persistenza finding: **nessuna** (vedi decisioni). Nessuna migrazione in questo piano. Verificato l'ultimo numero: `database/migrations/` arriva a **169** (`169_wpqr_drop_expiry_date.sql` + companion); [`DATABASE.md`](../reference/DATABASE.md) § Migrazioni dice ancora «168 / prossimo 169» (stantio, da allineare in VQ-12). Se D3 (presa visione) venisse approvata il numero **non** si riserva ora: il deputy lo dichiara nel brief dopo `git fetch` (oggi sarebbe **170**) con intestazione e companion `170_verify.sql`/`170_rollback.sql` (policy ≥169), livello **Alto** con consenso esplicito. Applicazione in PROD: HITL (sì esplicito).

**Stato migrazione 168 al VPS: non assunto.** `verifyRecordLoader.js` legge `INFORMATION_SCHEMA.COLUMNS` (una volta, cache di processo) e costruisce la `SELECT` con le sole colonne esistenti; le colonne di prova assenti = campo `null` → i ricalcoli diventano `non_verificabile_dato_mancante`, non un errore SQL.

### 1.6 Perché `non_verificabile_*` conta

Un registro che tace quando non sa dà falsa sicurezza. Ogni profilo/regola dichiara cosa **non** sa verificare (norma o edizione fuori libreria, input di prova assente, combinazione non modellata) e lo espone come `info`. Il report Rielaborazioni conta separatamente verificabili e non verificabili: la «copertura della verifica» è una metrica visibile, e ogni norma consegnata dal committente la fa salire senza toccare l'engine.

---

## 2. Voce Rielaborazioni di tipo verifica

### 2.1 Come funziona oggi il registro (verificato sul codice)

- `REPROCESSABLE_FIELD_REGISTRY` (`backend/src/data/reprocessableFields.js`): ogni voce = **campo AI-estraibile** di una tabella (`qualifications` | `wpqr_records`) con `candidateWhere` (default `col IS NULL`) e filtri (`qualTypeLike`, `jointTypeWhitelist`, …). Whitelist di scrittura separate per tabella (`REPROCESSABLE_FIELDS` in `qualificationIngest.service.js`, `WPQR_REPROCESSABLE_FIELDS` in `wpqrIngest.service.js`); `reprocessableFields.test.js` impone che registro e whitelist coincidano (stessa colonna).
- `qualificationReprocess.service.js`: `countReprocessCandidates` = SELECT + filtri JS (+ esclusione record con proposta `pending`); `runReprocessForField` rilegge il **PDF su disco**, chiama l'**AI**, crea una **proposta in `ingest_staging`** (`field_scope`, `target_qualification_id`) — mai scrive sul record.
- `GET /admin/reprocess-tasks` (conteggi) e `POST /admin/reprocess-tasks/:key/run` (superadmin, cross-tenant, `organization_id` opzionale); FE `BillingDashboardPage.jsx` mostra **solo le voci con `candidate_count > 0`** e un alert globale «N record possono essere aggiornati con dati AI mancanti».
- **Il registro non supporta una voce solo-verifica**: `selectReprocessCandidates` lancia `Campo non rielaborabile` se la chiave non è in whitelist; `runReprocessForField` presuppone file + AI + staging.

### 2.2 Estensione minima proposta

| Aspetto | Decisione |
|---------|-----------|
| Registro | Nuovo attributo `kind: 'verify'` (assente = `'backfill'`, retrocompatibile). Voci: `verify_9606_1`, `verify_9606_2`, `verify_14732` (una per profilo/famiglia, così il conteggio e l'attivazione crescono con i pack). Campi: `key`, `label`, `module: 'qualifiche'`, `table: 'qualifications'`, `qualTypeLike`, `verifyFamily` (chiave nel registry di verifica). **Nessuna** `column`/`candidateWhere`/whitelist di scrittura. La prima onda registra solo `verify_9606_1`. |
| **Candidato** | Un record `qualifications` (non `revocata`, `qualification_type LIKE` della famiglia, nessun filtro su PDF/`certificate_file_url`) per cui l'engine in `mode:'db'` produce **≥ 1 finding `warn` con `status = verificabile`**. I record che hanno solo `info` o solo non verificabili **non** sono candidati (rumore) ma sono contati nel report. |
| Cosa produce | **Report**, non proposte: `POST …/run` per una voce `verify` risponde `{ success, kind:'verify', field, recordsChecked, recordsWithWarnings, findingsByCode:{code:n}, notVerifiable:{dato_mancante:n, fonte_mancante:n}, items:[{id, organization_id, person_name, certificate_number, findings:[…]}], hasMore }` (tetto `items` e `recordsChecked` per run, `hasMore` come l'attuale `DEFAULT_RUN_LIMIT`). La UI mostra la tabella e il pulsante «Scarica CSV» (client-side). |
| Scrive? | **No.** Nessun `UPDATE`, nessuna riga in `ingest_staging`, nessuna AI, nessun accesso a `/uploads`. Costo zero. Il ramo `verify` in `runReprocessForField`/`countReprocessCandidates` esce **prima** della logica backfill. |
| Sicurezza (dati confermati) | (1) il codice del ramo verify non importa whitelist né `createStagingRecord`; (2) test: nessuna chiave `kind:'verify'` compare in alcuna whitelist di scrittura, e ogni chiave `backfill` sì (l'attuale test di sincronia viene **estratto per kind**, non indebolito); (3) test strutturale: nessun statement di scrittura nel modulo; (4) route invariate (superadmin); (5) `organization_id` rispettato; (6) il report non cambia alcun valore, quindi non può sovrascrivere dati confermati — la correzione resta il normale «Modifica» in Qualifiche. |
| Contatore e alert | `candidate_count` per le voci `verify` = candidati come sopra, **ma** non entra in `total_candidates` (il banner «dati AI mancanti» resta vero) e ha una riga/etichetta propria («record con avvisi norma»). Dopo «Esegui verifica» il numero **non scende** (è uno stato, non un backlog): si azzera correggendo i record. Testo UI esplicito per non confonderlo con le proposte in coda. |
| Candidati > 0 (regola Rielaborazioni) | Soddisfatta: la voce compare quando almeno un record ha un `warn` verificabile. Con DB pulito la riga sparisce (come ogni altra voce a 0). |
| Script CLI | `backend/scripts/reprocess-qualifications.js` rifiuta le chiavi `kind:'verify'` con messaggio chiaro (non sono backfill). |
| Dipendenza dati | Quasi tutti i record **già in DB** non hanno le colonne di *prova* (migrazione 168, fetta 05/10): i ricalcoli saranno `non_verificabile_dato_mancante` finché non si fanno i backfill AI già esistenti (`thickness_s_test_mm`, `thickness_t_test_mm`, `pipe_diameter_test_mm`, `welding_position_test`, `welding_process_test`). Il report lo dice e rimanda a quelle voci; **ordine consigliato al committente**: prima i backfill di prova, poi la verifica. |
| Test sync registro ↔ whitelist | `reprocessableFields.test.js` esteso: (a) i test esistenti operano sulle voci `backfill`; (b) nuovo: ogni voce `verify` ha `verifyFamily` presente in `listRulePacks()` e **non** ha whitelist; (c) nessuna chiave duplicata tra kind. |

### 2.3 Checklist dato ↔ norma ↔ UI ↔ API (Rielaborazioni)

| Dato | Clausola | UI | API / persistenza |
|------|----------|----|-------------------|
| Finding di verifica per record DB | come i singoli finding (§ 4) | tabella «Verifica qualifiche vs norma» in Fatturazione → Rielaborazioni + CSV | `GET /admin/reprocess-tasks` (campo `kind`) · `POST /admin/reprocess-tasks/:key/run` (risposta `kind:'verify'`) · **nessuna persistenza** |

---

## 3. Inventario norme (gate norm-touching)

Verificato aprendo i Markdown in `docs/Normative/` e gli estratti in `docs/reference/` (06/10/2026). Legenda: **coperta** = testo utilizzabile per regole con clausola · **parziale** = usabile con limiti dichiarati · **mancante** = niente da cui derivare una regola.

| Norma / clausole usate | Fonte in repo | Stato | Cosa permette | Cosa blocca esattamente |
|------------------------|---------------|-------|---------------|-------------------------|
| **ISO 9606-1:2017** §5.1 (variabili essenziali), §5.3 (piastra/tubo), §5.4 (BW/FW), §5.7 Tab. 6/7/8, §5.8 Tab. 9/10, §9.1–9.2, §10, §11, Annex A | `NORMA_00018` MD (font anti-copia; Tab. 6/8/9/10 ricostruite da glifi SymbolMT il 26/07) + `ISO-9606-1-range-validita-patentino.md` + `weldingQualificationRules9606.js` | **coperta** | Tutta la prima onda: completezza (§5.1/§10/Annex A) e ricalcolo spessori, diametro, posizioni | — |
| ISO 9606-1 §5.2 equivalenze di processo | `NORMA_00018` §5.2 | **coperta, ma estratto discordante** | Regola `CORR.PROCESS` | Il MD dice «welding with 141, 143 or 145 qualifies for 141, **142**, 143 and 145, but 142 only qualifies for 142»; l'estratto repo e il prompt (`buildWelderQualificationRulesPromptSection`) dicono «141/143/145 tra loro (142 solo 142)», cioè **omettono** la copertura di 142. Da allineare **prima** di codificare la regola (VQ-3 sistema l'estratto, VQ-6 il prompt) |
| ISO 9606-1 Tab. 1 (multi-processo, `s = s1+s2`) | `NORMA_00018` (leggibile) | **parziale** | — | Non è un problema di fonte: `welding_process_test` è singolo, non esiste un dato per la combinazione → `non_verificabile_dato_mancante`. Decisione prodotto già in `PLAN_RIUNIONE` («multiprocesso: dopo») |
| ISO 9606-1 Tab. 2 (gruppi FM1–FM6) | `NORMA_00018` (leggibile) | **coperta** | Regola `COMP/CORR` sul gruppo FM valido | — |
| ISO 9606-1 **Tab. 3, 4, 5, 11, 12** (validità filler FM, tipo rivestimento, tipo filo, dettagli giunto backing, tecnica strati) | `NORMA_00018` MD: le celle «×» sono vuote (stesso difetto SymbolMT di Tab. 6/9/10, **non** ancora riletto a livello di glifo); dalla struttura (FM1→FM1-2, … FM5→FM5, FM6→FM5-6) la lettura è plausibile ma **non verificata** | **parziale** | Niente in prima/seconda onda | Verifica della **validità** di filler/rivestimento/dettagli: oltre al testo mancano le **colonne** (il record ha solo la prova `filler_material`, non l'estensione). Per usarle servono: conferma glifo (HITL 4) + decisione schema (D7) |
| ISO 9606-1 §9.3 (rivalidazione a/b/c), §9.2 (conferma 6 mesi) | `NORMA_00018` §9 (leggibile) | **coperta** | `CORR.CONFIRMATION_INTERVAL`, plausibilità `expiry − exam` | Il **metodo** scelto (a/b/c, «shall be stated on the certificate», §9.1) non ha colonna → non verificabile (D7) |
| ISO 9606-1 Annex A (campi certificato) | `NORMA_00018` Annex A (leggibile) | **coperta** | Elenco campi per completezza | 8 voci Annex A **senza colonna/schema**: corrente e polarità, ausiliari, job knowledge, riferimento WPS, prove eseguite, prova d'angolo supplementare (§5.4 e/§10), metodo di rivalidazione, luogo/data di nascita → fuori dalla verifica finché D7 non decide |
| ISO 9606-1 edizioni 2012/2013/2017 | `NORMA_00018` («taken over without modification») | **coperta** | Regole identiche | — |
| **EN 287-1** / ISO 9606-1:2004 (certificati legacy) | **assente** | **mancante** | — | Un certificato che cita EN 287-1 non può essere verificato con le tabelle 2017 (struttura diversa: spessore materiale `t`, niente transfer mode). Resta `non_verificabile_fonte_mancante` finché non c'è il testo (HITL 3, solo se esistono certificati legacy) |
| **ISO 9606-2:2004** (alluminio) | `NORMA_00032` MD **leggibile** (Tab. 2 gruppi 21–26, Tab. 3 spessore `t`, Tab. 4 diametro, Tab. 5 angolo, Tab. 6 posizioni, §9 validità 2 anni + conferma 6 mesi + prolungamento, Annex A) | **coperta (testo) / mancante (estratto operativo + codice)** | Terza onda | Non esiste `docs/reference/ISO-9606-2-…md` né funzioni JS: se ne occupano VQ-3 (estratto) e VQ-10 (regole). Differenze note da 9606-1: spessore su **`t` del materiale** anche per BW (non `s` depositato), 5.4 b) BW qualifica FW, validità 2 anni, matrice posizioni a 10 colonne. **9606-2:2004 è un'edizione unica** |
| ISO 9606-2 Tab. 2 gruppi Al | `NORMA_00032` + `materialGroups15608.js` (manca il gruppo `26`) | **parziale** | — | Il catalogo non ha `26` e i sottogruppi 23.x/24.x non sono verificati sulla CR ISO 15608 → regola gruppo Al solo `info` fino a HITL 5 |
| **ISO 14732:2025** §4 (metodi), §5.1/5.2 (variabili essenziali), §6 (validità/conferma/rivalidazione), §7 e Annex C (campi certificato), Annex A | **`NORMA_00046` Rev. 1** (BS EN ISO 14732:2025 **integrale**, 06/10/2026: HITL 1 **chiuso**) + `ISO-14732-operatori-saldatura.md` riscritto sulla 2025 | **coperta (2025)** / mancante (2013 integrale) | Parte A: completezza da Annex C (campi 2025 in estratto) e «tabelle 9606 non applicabili». Parte B: regole `warn` con clausola 2025 codificabili (§5.1/5.2, §6.1-6.3, §4.1 conoscenza funzionale; vedi estratto § Differenze 2013 → 2025) | Edizione 2013 integrale non in repo: certificati emessi sotto la 2013 si leggono con la tabella di concordanza dell'estratto. «Norma applicativa» di 6.3 b)/c) e categoria PED (Annex ZA) non sono dati del certificato → GAP |
| ISO 15614-1/-2, 15613, 14555 | `NORMA_00019/00031/00043/00045/00033` + estratti | **non rilevante qui** | — | Sono norme **WPQR**: epic separato. Per 14732 compaiono solo come valore dell'enum `qualification_method` (nessuna regola) |
| **ISO 4063:2023** (codici processo) | `NORMA_00044` + `weldingProcesses4063.js` | **coperta** | Il codice di `welding_process_test`/`validity` è nel catalogo | I processi 78x (prigionieri) riguardano 14555, non 9606: fuori |
| **ISO 14175:2008** (gas) | `NORMA_00012` + `shieldingGases14175.js` + check esistente | **coperta** | Regola gas (migrazione del check esistente nel registry) | — |
| **ISO/TR 15608** (gruppi materiale 1–11 per 9606-1 §5.5.1) | **solo** `ISO-TR-15608-gruppi-materiali.md` (sintesi) + `materialGroups15608.js`; nessun `NORMA_00xxx` | **parziale** | Regola «gruppo registrato» (§5.1/§10: lo dice la 9606-1) e «gruppo in 1–11» (§5.5.1, scritto nella 9606-1 stessa) | Validare **sottogruppi** (es. `1.2`) contro la norma richiede il TR integrale: ora solo contro il catalogo → `info` (HITL 5) |
| **ISO 6947** (posizioni) | **solo** `ISO-6947-posizioni-saldatura.md` (sintesi) + `weldingPositions6947.js` | **parziale** | Le posizioni qualificate sono nelle Tab. 9/10 della 9606-1 stessa | Non blocca nulla ora; il testo integrale serve solo se si vuole validare la geometria/angoli (HITL 6, P3) |
| ISO 9606-3 / -4 / -5 | **assenti** | **mancante** | — | Fuori perimetro (`non_verificabile_fonte_mancante` informativo se il certificato le cita). Su richiesta |

### 3.1 Richieste al committente (blocchi HITL, in ordine di priorità)

**Richiesta 1 di 6 — CHIUSA 06/10/2026**: il committente ha fornito il testo integrale **BS EN ISO 14732:2025** (34 pag.), digitalizzato come `docs/Normative/Normative NORMA_00046_ BS EN ISO 14732_2025 Rev. 1.md/.json`. L'edizione disponibile è la **2025**, non la 2013 qui sotto indicata: il blocco seguente resta come scontrino della richiesta.

```markdown
## Richiesta norma (HITL) — 1 di 6

- **Codice / titolo**: ISO 14732:2013 (Qualificazione di operatori e preparatori di saldatura automatica/meccanizzata) — testo integrale
- **Edizione desiderata**: 2013 (UNI EN ISO 14732:2013)
- **Serve a**: VQ-11 parte B — regole 14732 con clausola verificata su testo ufficiale (§4.2.2/§4.2.3 variabili essenziali, §5 validità e rivalidazione 6/3 anni, Annex A e Annex C contenuto del certificato)
- **Cosa c'è già in repo**: `docs/reference/ISO-14732-operatori-saldatura.md` (OCR, sintesi); nessun `NORMA_00xxx`
- **Cosa NON inventiamo senza PDF**: quali voci di Annex C sono «shall» e quali raccomandate; soglie di rivalidazione citate per clausola; qualsiasi regola di posizione/giunto per l'automatica
- **Perimetro su cui si parte comunque**: parte A su estratto con severità massima `info` (completezza dei campi già in `qualifica_14732` + «tabelle 9606 non applicabili» come da riunione 03/10)
- **Formato utile**: PDF (preferito) → digitalizzazione con skill `pdf-to-json`
- **Dopo digitalizzazione**: backlog → `digitalizzata`; nuova edizione Markdown → nessun seed SGQ (non è norma a clausole SGQ)
```

```markdown
## Richiesta dati (HITL) — 2 di 6 (non è una norma)

- **Cosa**: 8–12 certificati reali **anonimizzati** (PDF o dati) già validati da un coordinatore: copertura BW e FW, P e T, almeno un 311 o 141/142/143, almeno un 9606-2, almeno un 14732; idealmente 2–3 con un errore noto
- **Serve a**: misurare falsi positivi/negativi delle regole `warn` prima di dichiarare «pronta» (la correttezza normativa non si valida con i soli test sintetici). Senza campione la severità `warn` sulla correttezza resta, per cautela, il default ma la PR non passa a «pronta» (D6)
- **Perimetro su cui si parte comunque**: fixture sintetiche costruite dalle tabelle (valori esatti ai bordi 3/12 mm, 25 mm, 311)
```

```markdown
## Richiesta norma (HITL) — 3 di 6 (condizionata)

- **Codice / titolo**: EN 287-1:2011 (e, se presenti, ISO 9606-1:2004) — saldatori, acciai
- **Serve a**: verificare i certificati legacy ancora in corso di validità; oggi `non_verificabile_fonte_mancante`
- **Cosa c'è già in repo**: assente
- **Cosa NON inventiamo senza PDF**: ranges di spessore/diametro/posizioni dell'edizione precedente
- **Perimetro su cui si parte comunque**: 9606-1:2017/2013/2012
- **Prima di chiedere**: il committente dice se nei propri clienti circolano ancora certificati EN 287-1 (se no, la richiesta cade)
```

```markdown
## Richiesta norma (HITL) — 4 di 6

- **Codice / titolo**: ISO 9606-1:2017 Tabelle 3, 4, 5, 11, 12 — conferma delle celle «×» (qualificato) a livello di glifo (stesso metodo del 26/07/2026 per Tab. 6/9/10)
- **Serve a**: validità del materiale d'apporto (FM, tipo rivestimento, tipo filo) e dei dettagli di giunto (backing, strati) — solo se D7 aggiunge le colonne di validità
- **Cosa c'è già in repo**: NORMA_00018 MD con celle vuote; lettura plausibile ma non verificata
- **Cosa NON inventiamo senza PDF**: ogni «×» delle Tab. 3/4/5/11/12
- **Perimetro su cui si parte comunque**: tutto il resto della 9606-1
- **Formato utile**: il PDF originale `BS EN ISO 9606-1_2017.pdf` (già indicato in `SOURCE_PDF_INDEX.md`, non in Git); l'agente può rileggere i glifi in locale se il file è disponibile sulla VM
```

```markdown
## Richiesta norma (HITL) — 5 di 6

- **Codice / titolo**: ISO/TR 15608:2013 integrale + CR ISO 15608 (gruppi alluminio 21–26)
- **Serve a**: validare sottogruppi (`1.2`, `8.1`, …) e la Tab. 2 di ISO 9606-2 (gruppi Al; nel catalogo manca il `26`)
- **Cosa c'è già in repo**: `ISO-TR-15608-gruppi-materiali.md` (sintesi) + catalogo JS
- **Cosa NON inventiamo senza PDF**: composizione dei sottogruppi, gruppo 26
- **Perimetro su cui si parte comunque**: «gruppo registrato» e «gruppo in 1–11» (testo nella 9606-1)
```

```markdown
## Richiesta norma (HITL) — 6 di 6 (P3, non bloccante)

- **Codice / titolo**: ISO 6947 integrale (posizioni); ISO 9606-3/-4/-5 solo su richiesta esplicita
- **Serve a**: validazione geometrica delle posizioni (non necessaria: le matrici qualificate sono nella 9606-1/-2); copertura di rame/nichel/titanio
- **Perimetro su cui si parte comunque**: matrici Tab. 9/10 (9606-1) e Tab. 6 (9606-2)
```

Il backlog globale è aggiornato in [`NORME_MANCANTI_BACKLOG.md`](../reference/NORME_MANCANTI_BACKLOG.md) (righe 14732, 9606-1 Tab. 3/4/5/11/12 + §5.2, EN 287-1, TR 15608/CR 15608, ISO 6947, 9606-3/-4/-5).

---

## 4. Cosa verifica la prima onda — checklist dato ↔ clausola ↔ UI ↔ API

Fonte clausole: `NORMA_00018` (ISO 9606-1:2017) salvo indicazione. Tutte le regole sono su colonne **già esistenti** (nessuna migrazione).

### 4.1 Completezza 9606-1 (pack `welder9606Completeness`, VQ-5)

| Dato (colonna / review) | Clausola | Severità se manca | UI | API |
|-------------------------|----------|-------------------|----|-----|
| `welding_process` / `welding_process_test` | §5.1, §5.2, §10, Annex A «Welding process(es)» | `warn` | pannello avvisi + highlight campo | `verification.findings[]` |
| `product_type` (P/T) | §5.1, §5.3, §11 pt 2 | `warn` | idem | idem |
| `joint_type` (BW/FW) | §5.1, §5.4, §11 pt 3 | `warn` (e profilo = `9606-1:UNKNOWN`: si applicano solo le regole comuni) | idem | idem |
| `filler_material` (FM1–FM6; per 142/311 senza apporto: `material_group`) | §5.5, Tab. 2, §11 pt 4 | `warn` | idem | idem |
| Validità spessore (`thickness_min/max_mm` o `thickness_max_unlimited`) | §5.7 Tab. 6 (BW) / Tab. 8 (FW), Annex A «Deposited/Material thickness» | `warn` | idem | idem |
| Spessore di prova (`thickness_s_test_mm` BW / `thickness_t_test_mm` FW) | §5.7, §11 pt 6 | `info` (abilita il ricalcolo) | idem | idem |
| Diametro (solo T): validità `pipe_diameter_min/max_mm`, prova `pipe_diameter_test_mm` | §5.7 Tab. 7, Annex A «Outside pipe diameter» | `warn` validità · `info` prova | idem | idem |
| Posizioni: `welding_positions`/`position_range`, prova `welding_position_test` | §5.8 Tab. 9/10, §11 pt 7 | `warn` validità · `info` prova | idem | idem |
| `weld_details` | §5.9, §11 pt 8, Annex A | `warn` | idem | idem |
| `transfer_mode` se processo ∈ 131/135/136/138 | §5.2 (ultimo punto), Annex A «Transfer mode» | `info` | idem | idem |
| `material_group` | §5.1 (ultima frase), §10 (non essenziale «shall be recorded») | `warn` | idem | idem |
| `shielding_gas` (processi a gas; applicabilità da catalogo 4063 in VQ-5) | §10 (non essenziale «shall be recorded»), Annex A | `info` | idem | idem |
| `exam_date`, `certificate_number`, `issuing_body`/`examiner_body` | §9.1, §10 («issued under the sole responsibility of the examiner»), Annex A | `warn` | idem | idem |
| `standard_reference` | Annex A «Code/testing standard» | `info` | idem | idem |

### 4.2 Correttezza 9606-1 (pack `welder9606Correctness`, VQ-6)

| Verifica | Input (prova) → atteso | Confronto con | Clausola | Severità |
|----------|------------------------|---------------|----------|----------|
| `CORR.THK_BW` | `thickness_s_test_mm` (+ processo 311) → `computeQualifiedThicknessRangeButtWeld` | `thickness_min/max_mm`, `thickness_max_unlimited` | Tab. 6 note c/d (311); nota e (≥3 passate) **non verificabile** → `info` fisso per s ≥ 12 | over_claim `warn`, under_claim `info` |
| `CORR.THK_FW` | `thickness_t_test_mm` → `computeQualifiedFilletThicknessRange` | idem | Tab. 8 | idem |
| `CORR.PIPE_DIAMETER` | `pipe_diameter_test_mm` (solo T) → `computeQualifiedPipeDiameterRange` | `pipe_diameter_min/max_mm` | Tab. 7 (+ §5.3 per piastra→tubo: informativo) | idem |
| `CORR.POSITIONS` | `welding_position_test` + BW/FW → `computeQualifiedWeldingPositions` | `welding_positions` (insieme) | Tab. 9 (BW) / Tab. 10 (FW) | posizione dichiarata non qualificata = `warn`; posizione qualificata non dichiarata = `info` |
| `CORR.PROCESS` | `welding_process_test` → equivalenze §5.2 (nuova funzione in `weldingQualificationRules9606.js`) | `welding_processes_validity` | §5.2 (135↔138, 121↔125, 141/143/145→141/142/143/145, 142→142) | processo oltre equivalenza `warn` |
| `CORR.TRANSFER_MODE` | processo | `transfer_mode` presente su processo fuori da 131/135/136/138 | §5.2 / Annex A | `info` |
| `CORR.DESIGNATION` | `parseWelderQualificationDesignation(qualification_designation)` | colonne di **prova** (processo, P/T, BW/FW, FM, spessore, posizione) | §11 (la designazione descrive la prova) | `warn` su discordanza di token; **mai** confrontata con la validità |
| `CORR.GAS_14175` | `shielding_gas` | catalogo ISO 14175 (migra `checkShieldingGasKnown`) | ISO 14175 | `info` |
| `CORR.MATERIAL_GROUP` | `material_group` | catalogo TR 15608; per 9606-1 gruppi 1–11 | §5.5.1 («should» → solo `info`) | `info` |
| `CORR.FILLER_GROUP` | `filler_material` | FM1–FM6 | Tab. 2 | `warn` se fuori elenco |
| `CORR.CONFIRMATION_INTERVAL` | `exam_date`, `last_confirmation_date`, `next_confirmation_due` | intervallo ≤ 6 mesi | §9.1, §9.2 | `warn` se > 6 mesi; `info` se `expiry_date − exam_date` > 3 anni (non vincolante: opzioni b/c §9.3) |
| `SRC.EDITION_NOT_COVERED` | `standard_reference` (EN 287-1, ISO 9606-1:2004, …) | edizioni coperte | — | `info`, `non_verificabile_fonte_mancante`, **unico** finding per record |
| `*.DATA_MISSING` | input di prova assente | — | — | `info`, `non_verificabile_dato_mancante`, uno per verifica |

Esiti sul terzo asse (UI): `QualificationVerifyPanel` raggruppa per severità, mostra «Letto / Atteso dalla norma / Clausola», con le `info` ripiegate di default, nessun blocco, testo «Gli avvisi non impediscono il salvataggio. Il campo di validità del certificato resta quello letto».

---

## 5. Raccomandazione: norme prima o scalabilità prima?

**Scegliere la scalabilità con partenza immediata sul perimetro già coperto** (ISO 9606-1:2017), senza aspettare nessun PDF.

1. **Il perimetro coperto è quello che pesa.** ISO 9606-1:2017 ha testo (NORMA_00018), estratto, funzioni Tab. 6/7/8/9/10 e profili BW/FW già in `main`: è il caso reale della grande maggioranza dei patentini. Le lacune (14732 integrale, Tab. 3/4/5/11/12, EN 287-1, TR 15608) riguardano il **margine**.
2. **Il registry rende le lacune economiche.** Una norma mancante diventa `non_verificabile_fonte_mancante`: visibile, conteggiata, informativa. Quando il committente consegna un testo, si aggiunge un pack + test + riga di backlog; engine, API, UI e Rielaborazioni non cambiano. Il costo del «dopo» è basso e **prevedibile**.
3. **Rischio di rework opposto.** Aspettare tutte le norme blocca anche ciò che è pronto e rimanda l'apprendimento sui campioni reali; costruire senza registry (regole sparse) obbligherebbe a rifare l'aggancio a ogni norma. Il rework vero è quello del **contratto**: per questo si congela nel piano e si valida con un secondo profilo (9606-2, onda 3) *prima* di dichiarare l'epic chiusa.
4. **Parallelismo.** Con contratto congelato e pack in file separati, onda 1 (4 slice) e onda 2 (4 slice) girano in parallelo; le richieste HITL sono indipendenti e arrivano in parallelo ai lavori.
5. **Ordine delle richieste al committente** (cosa sblocca): (1) PDF integrale **14732** → parte B operatori; (2) **campione di certificati reali** → misura dei falsi positivi, gate per dichiarare «pronta» (non è una norma ma pesa quanto una); (3) conferma **EN 287-1** serve davvero? → legacy; (4) **Tab. 3/4/5/11/12** → validità filler/dettagli (solo con D7); (5) **TR 15608/CR 15608** → sottogruppi + 9606-2 Tab. 2; (6) ISO 6947 / 9606-3/-4/-5 → su richiesta.
6. **Guardrail che rendono sicura la scelta**: severità `warn` solo con `status = verificabile` e clausola citata; mai blocco; il report Rielaborazioni espone la copertura di verifica; la PR dei pack normativi non passa a «pronta» senza campione reale (D6).

---

## 6. Mappa slice

**Tipo**: AFK = chiudibile dal deputy da solo · HITL = serve decisione/dato del committente prima o durante. **Contesto**: tutti **default/basso** (non 1M).

| Slice | Tema | Dipende da | Onda | Rischio | Tipo |
|-------|------|------------|------|---------|------|
| VQ-1 | Contratto + registry + engine + vista record + stub dei pack + manifest + bussola | — | 1 | Medio (BE additivo, non agganciato) | AFK |
| VQ-2 | `QualificationVerifyPanel` FE (presentazionale) + `apiService.verifyQualification` | contratto (nel piano) | 1 | Basso | AFK |
| VQ-3 | Estratto operativo ISO 9606-2 + allineamento estratto 9606-1 (§5.2, Annex A) + backlog | — | 1 | Basso (solo doc) | AFK |
| VQ-4 | Riga «Verifica» in Rielaborazioni (FE, `BillingDashboardPage`) | contratto API (nel piano) | 1 | Medio (superadmin, solo FE) | AFK |
| VQ-5 | Pack completezza 9606-1 (BW/FW/UNKNOWN) | VQ-1 | 2 | Medio* | AFK |
| VQ-6 | Pack correttezza 9606-1 + equivalenze §5.2 in `weldingQualificationRules9606.js` (+ prompt, mirror FE) | VQ-1, VQ-3 (estratto §5.2 corretto) | 2 | Medio* | AFK |
| VQ-7 | Aggancio ingest (estrazione/commit) + endpoint `POST /qualifications/verify` + migrazione del check gas | VQ-1 | 2 | Medio | AFK |
| VQ-8 | Rielaborazioni BE `kind:'verify'` + loader DB tollerante + voce `verify_9606_1` + test sync | VQ-1 | 2 | Medio | AFK |
| VQ-9 | Integrazione FE: ingest review + form + badge in lista | VQ-2, VQ-7 (VQ-5/6 per vedere esiti reali) | 3 | Medio | AFK |
| VQ-10 | 9606-2: funzioni regole + profili per norma + pack + voce `verify_9606_2` | VQ-3, VQ-5, VQ-6, VQ-8 | 3 | Medio* | AFK (HITL 5 per gruppi Al) |
| VQ-11 | 14732: parte A (estratto, max `info`) + voce `verify_14732`; parte B dopo HITL 1 | VQ-8, VQ-10 (serializzare `reprocessableFields.js`) | 4 | Medio* | A: AFK · B: HITL |
| VQ-12 | Smoke E2E su TEST + chiusura documentale (GUIDA, roadmap, `DATABASE.md`, bussola) | VQ-9, VQ-10 (VQ-11 se pronto) | 4 | Basso | AFK |
| VQ-ACK | «Presa visione» avvisi (migrazione) — **solo se D3 = sì** | VQ-9 | — | **Alto** (migrazione, consenso esplicito) | HITL |

\* **Livello rischio normativo.** Per `sgq-git-autonomy.mdc` una «logica di compliance con impatto qualità non ancora validata» è **Alto**. Qui gli esiti sono solo avvisi non bloccanti, quindi il piano le classifica **Medio con gate rafforzato** (CI + Bugbot + Security Review + secondo giro sulla tabella regole ↔ clausola + campione reale se disponibile). Se il committente preferisce trattarle come Alto, ogni merge dei pack richiede il suo consenso esplicito (D6).

### 6.1 DAG

```text
Onda 1 (parallelo, nessuna dipendenza tra loro; VQ-2/VQ-4 usano il contratto del piano)
  VQ-1 ─────────────┬──► VQ-5 ─┐
                    ├──► VQ-6 ─┤
  VQ-3 ─────────────┘          ├──► VQ-9 ─┐
  VQ-2 ─────────────────► (VQ-7)┘          ├──► VQ-12
  VQ-4 (indipendente)                      │
                    ├──► VQ-7 ──► VQ-9      │
                    └──► VQ-8 ──► VQ-10 ──► VQ-11 ─┘
                         VQ-3, VQ-5, VQ-6 ──► VQ-10
Onda 2 (parallelo dopo il merge di VQ-1): VQ-5, VQ-6 (dopo VQ-3), VQ-7, VQ-8
Onda 3 (parallelo): VQ-9 (dopo VQ-2+VQ-7), VQ-10 (dopo VQ-3+VQ-5+VQ-6+VQ-8)
Onda 4: VQ-11 (dopo VQ-10: stesso file `reprocessableFields.js`), poi VQ-12
```

Regola operativa: una slice si lancia solo quando le sue dipendenze sono **su `origin/main`** (non solo in PR) e il suo brief è `APERTO` su `main` (gate DEPUTYTASK).

### 6.2 File previsti / Cosa NON toccare — **disgiunti per onda**

Convenzione: un file compare come «previsto» in **una sola** slice della stessa onda. Unica eccezione ammessa: `backend/scripts/deploy-manifest.json` (ogni slice aggiunge **solo le proprie righe**; in merge si tengono tutte).

**Onda 1**

| Slice | File previsti (nuovi *N*, modificati *M*) | Cosa NON toccare |
|-------|-------------------------------------------|------------------|
| VQ-1 | *N* `backend/src/services/qualificationVerify/{findingTypes,qualificationRecordView,verifyRegistry,verifyEngine,registerDefaultPacks,index}.js` + `*.test.js` · *N* `…/packs/{welder9606Completeness,welder9606Correctness,welder9606Part2,operator14732}.pack.js` (stub `rules: []`) · *M* `backend/scripts/deploy-manifest.json` · *M* `PROJECT_CONTEXT.md` (riga bussola «Qualifiche») | `qualificationIngest.service.js`, `ingestPlausibilityChecks.js`, controller/route, `weldingQualificationRules9606.js`, `jointTypeProfiles.js`, `capabilityCoverage/**`, Rielaborazioni, qualsiasi FE, `database/migrations/**` |
| VQ-2 | *N* `app/src/components/QualificationVerifyPanel.jsx` + `.css` · *N* `app/src/tests/qualificationVerifyPanel.test.jsx` · *M* `app/src/services/apiService.js` (solo il metodo `verifyQualification`) · *M* `docs/reference/LIBRERIA_UI_SGQ.md` (una riga) | `IngestReviewDialog.jsx`, `QualificationForm.jsx`, `QualificationsPage.jsx`, `BillingDashboardPage.jsx`, `CoverageVerifyPanel.*`, qualsiasi BE |
| VQ-3 | *N* `docs/reference/ISO-9606-2-range-validita-patentino.md` · *M* `docs/reference/ISO-9606-1-range-validita-patentino.md` (§5.2, tabella campi Annex A, stato Tab. 3/4/5/11/12) · *M* `docs/reference/NORME_MANCANTI_BACKLOG.md` (solo stati/note) | Qualsiasi `.js/.jsx/.json`, `docs/Normative/**`, `PLAN_*`, GUIDA, ROADMAP |
| VQ-4 | *M* `app/src/pages/BillingDashboardPage.jsx` · *M* `app/src/pages/BillingDashboardPage.css` · *M* `app/src/tests/billingDashboardReprocess.test.jsx` | `apiService.js` (usa i metodi esistenti `getReprocessTasks`/`runReprocessTask`), `ReprocessQueueBanner.*`, qualsiasi BE |

*Disgiunzione onda 1*: nessun file in comune (VQ-2 è l'unico che tocca `apiService.js`; VQ-3 l'unico `docs/reference`; VQ-4 l'unico `BillingDashboardPage`; VQ-1 l'unico BE/manifest/bussola).

**Onda 2** (tutte dopo VQ-1 su `main`; VQ-6 anche dopo VQ-3)

| Slice | File previsti | Cosa NON toccare |
|-------|---------------|------------------|
| VQ-5 | *M* `…/qualificationVerify/packs/welder9606Completeness.pack.js` + `.test.js` | registry/engine/altri pack, `jointTypeProfiles.js` (solo import), ingest, FE |
| VQ-6 | *M* `…/packs/welder9606Correctness.pack.js` + `.test.js` · *M* `backend/src/data/weldingQualificationRules9606.js` + `.test.js` · *M* `app/src/data/weldingQualificationRules9606.js` (mirror) · *M* `app/src/tests/weldingQualificationRules9606.test.js` | altri pack, registry/engine, ingest, FE oltre il mirror, `jointTypeProfiles.js` |
| VQ-7 | *M* `backend/src/services/qualificationIngest.service.js` + `.test.js` · *M* `backend/src/utils/ingestPlausibilityChecks.js` + test · *N* `backend/src/controllers/qualificationVerify.controller.js` + test · *M* `backend/src/routes/qualifications.routes.js` · *M* `deploy-manifest.json` (riga controller) | `qualifications.controller.js`, pack, registry, Rielaborazioni, FE, `capabilityCoverage/**` |
| VQ-8 | *M* `backend/src/data/reprocessableFields.js` + `reprocessableFields.test.js` · *M* `backend/src/services/qualificationReprocess.service.js` + test · *M* `backend/src/controllers/reprocessTasks.controller.js` + test · *N* `…/qualificationVerify/{verifyRecordLoader,verifyReprocess.service}.js` + test · *M* `backend/scripts/reprocess-qualifications.js` · *M* `deploy-manifest.json` (righe loader/service) | ingest, pack, registry/engine, `reprocessTableAdapters.js`, whitelist di scrittura, FE, `ingest_staging` |

*Disgiunzione onda 2*: VQ-5 e VQ-6 hanno file pack distinti (stub creati da VQ-1); VQ-6 è l'unico che tocca `weldingQualificationRules9606.js` e il suo mirror; VQ-7 l'unico su ingest/route; VQ-8 l'unico sui file di Rielaborazioni.

**Onda 3**

| Slice | File previsti | Cosa NON toccare |
|-------|---------------|------------------|
| VQ-9 | *M* `app/src/components/IngestReviewDialog.jsx` · *M* `app/src/pages/QualificationForm.jsx` · *M* `app/src/pages/QualificationsPage.jsx` · *M* `app/src/components/QualificationUploadButton.jsx` (riepilogo avvisi) + test relativi | `QualificationVerifyPanel.*` (VQ-2, solo import), `jointTypeProfiles.js`, BE, `BillingDashboardPage` |
| VQ-10 | *N* `backend/src/data/weldingQualificationRules9606Part2.js` + test · *M* `…/packs/welder9606Part2.pack.js` + test · *M* `backend/src/data/jointTypeProfiles.js` + `app/src/data/jointTypeProfiles.js` + `app/src/tests/jointTypeProfiles.test.js` (variante per norma) · *M* `reprocessableFields.js` + test (voce `verify_9606_2`) · *M* `deploy-manifest.json` | `QualificationForm.jsx`/`IngestReviewDialog.jsx` (VQ-9), pack 9606-1, ingest |

*Disgiunzione onda 3*: VQ-9 è solo FE sui tre file; VQ-10 solo dati/pack/registro. Il form legge `jointTypeProfiles` ma VQ-10 cambia solo i **dati** del profilo 9606-2 (nessun cambio di comportamento per 9606-1, test di non regressione obbligatorio).

**Onda 4**: VQ-11 (`operator14732.pack.js`, `reprocessableFields.js` + test, voce `verify_14732`) dopo VQ-10; VQ-12 (nuovo `backend/scripts/smoke-qualifica-verifica-test.js`, `docs/GUIDA_CONSOLIDATA.md` §, `docs/PROJECT_ROADMAP.md`, `docs/reference/DATABASE.md` riga migrazioni, questo PLAN) dopo il merge delle altre.

### 6.3 Dettaglio slice (obiettivo verificabile · DoD · test L1)

Comandi di riferimento: BE `cd backend && npx jest <percorso>` · FE `cd app && NODE_ENV=test npx vitest run <file>` + `npm run build` · repo `node backend/scripts/check-harness-boot.js` e `node backend/scripts/check-utf8-encoding.js`.

**VQ-1 — Core.** *Obiettivo*: `verifyQualification({...}, {mode})` esiste, è puro e restituisce `VerifyResult` valido anche con i pack vuoti (profilo risolto, `summary` a zero, edizione non coperta → un finding `non_verificabile_fonte_mancante`). *DoD*: `validateFinding` + test di contratto che itera i pack registrati; `qualificationRecordView` converte sia review-fields (ingest: `welding_positions`/`welding_position`, `pipe_diameter_min/max`) sia riga DB (`position_range`, …) con test di parità; risoluzione profilo con parità di test rispetto a `uses9606DimensionalBlock` su una tabella di `qualification_type`; un test fa fallire il build se un `*.pack.js` non è in `registerDefaultPacks.js` **e** in `deploy-manifest.json`; test strutturale «nessun import di DB/fs nel modulo puro»; riga bussola in `PROJECT_CONTEXT.md` (`check-harness-boot` verde). *Test*: `npx jest src/services/qualificationVerify`. *Contesto*: default.

**VQ-2 — Pannello FE.** *Obiettivo*: `QualificationVerifyPanel` mostra `VerifyResult` (gruppi `warn`/`info`, colonne Letto / Atteso dalla norma / Clausola, stato non verificabile con motivo, vuoto «Nessun avviso»), senza blocchi. *DoD*: DNA UI (copia schermata dalla libreria, classi esistenti, nessun look nuovo; `AiDisclaimer` non necessario: non è AI), `aria`, pulsanti sempre visibili con `disabled`+`title`, testi con accenti, `apiService.verifyQualification(fields, {qualificationType})` → `POST /qualifications/verify`; riga in `LIBRERIA_UI_SGQ.md`. *Test*: `vitest run src/tests/qualificationVerifyPanel.test.jsx` (fixture di `VerifyResult` del contratto) + build. Rischio Basso.

**VQ-3 — Doc norme.** *Obiettivo*: estratto operativo 9606-2 sul modello di quello 9606-1 (Tab. 2–8, §9, Annex A, differenze da 9606-1; **solo** quanto leggibile in `NORMA_00032`; ogni dubbio dichiarato come GAP); allineare l'estratto 9606-1 al §5.2 (141/143/145→142) e aggiungere la tabella «campi Annex A: modellati / non modellati»; aggiornare stati nel backlog. *DoD*: UTF-8, accenti, nessuna soglia inventata, `check-utf8-encoding` verde.

**VQ-4 — Riga Rielaborazioni FE.** *Obiettivo*: le voci con `kind:'verify'` compaiono (candidati > 0) in una sotto-sezione «Verifica qualifiche vs norma», fuori dal totale «dati AI mancanti», con pulsante «Esegui verifica» e tabella esiti (`items[].findings`) + CSV; le voci senza `kind` si comportano esattamente come oggi. *DoD*: testo esplicito «sola lettura: nessuna modifica ai record, nessuna AI»; dopo l'esecuzione il conteggio **non** scende (messaggio); pulsanti disabilitati in corso; estende i test esistenti **senza modificarli**. *Test*: `vitest run src/tests/billingDashboardReprocess.test.jsx` + build.

**VQ-5 — Completezza.** *Obiettivo*: le righe della §4.1 come regole del pack, derivando i campi applicabili da `getVisibleFieldKeys`. *DoD*: test per profilo BW, FW, UNKNOWN; P vs T (diametro non richiesto su P); processo 142/311 (materiale base al posto di FM); `info`/`warn` come tabella; ogni finding passa `validateFinding`. *Test*: `npx jest src/services/qualificationVerify/packs/welder9606Completeness`.

**VQ-6 — Correttezza.** *Obiettivo*: le righe della §4.2; nuova `computeQualifiedWeldingProcesses({testProcess})` in `weldingQualificationRules9606.js` (+ mirror FE) usata sia dal pack sia dal prompt (che viene corretto su 142). *DoD*: test ai bordi (s = 2,99/3/11,99/12 mm; t = 2,99/3; D = 25/25,01; 311: 1,5s); over_claim vs under_claim; mai `warn` su dato non verificabile; test di parità prompt ↔ funzione; `weldingQualificationRules9606.test.js` BE+FE verdi. *Test*: `npx jest src/services/qualificationVerify/packs/welder9606Correctness src/data/weldingQualificationRules9606` + vitest mirror.

**VQ-7 — Aggancio ingest + endpoint.** *Obiettivo*: §1.5 righe «Estrazione», «Review», «Commit». *DoD*: `extractQualificationFromPdf` aggiunge i `message_it` a `warnings` e `verification` al risultato **senza cambiare `status`**; `commitQualificationFromFields` idem; `POST /qualifications/verify` registrata prima delle rotte `:id`, stessa autorizzazione delle altre rotte qualifiche, payload `{fields, qualification_type}`, nessuna scrittura; `checkShieldingGasKnown` tolto da `checkQualificationPlausibility` (nessun duplicato, test); test esistenti di `qualificationIngest.service.test.js` invariati; `deploy-manifest.json`. *Test*: `npx jest src/services/qualificationIngest src/utils/ingestPlausibilityChecks src/controllers/qualificationVerify`. Rischio Medio (percorso ingest critico: smoke obbligatorio in VQ-12).

**VQ-8 — Rielaborazioni BE.** *Obiettivo*: § 2.2. *DoD*: `kind` esposto da `GET /admin/reprocess-tasks`; ramo verify in `countReprocessCandidates`/`runReprocessForField` prima del ramo backfill; `verifyRecordLoader` tollerante alle colonne assenti (test con `INFORMATION_SCHEMA` simulato); voce `verify_9606_1`; test sync esteso (a/b/c); test strutturale «nessuna scrittura»; CLI rifiuta le chiavi verify. *Test*: `npx jest src/data/reprocessableFields src/services/qualificationReprocess src/controllers/reprocessTasks src/services/qualificationVerify`.

**VQ-9 — Integrazione FE.** *Obiettivo*: in `IngestReviewDialog` (e coda Rielaborazioni se condivide il dialog), `QualificationForm` e `QualificationsPage` (badge «avvisi norma» sul dettaglio, non sulla lista intera in questa slice) il pannello si aggiorna al blur con debounce; offline → nascosto; mai bloccante. *DoD*: nessun nuovo `fetch` (solo Axios via `apiService`); regola «URL: query ≠ pagina» rispettata (nessun link nuovo; se ne serve uno, `routerContext.match.test.js` verde); pulsanti operativi sempre visibili. *Test*: vitest mirato sui tre file + `qualificationUploadButton.test.jsx`, `qualificationFormConditionalFields.test.jsx` (non regredire) + build.

**VQ-10 — 9606-2.** *Obiettivo*: secondo profilo che **valida l'estensibilità** del contratto. *DoD*: funzioni Tab. 3/4/5/6 (`t ≤ 6: 0,5t–2t; t > 6: ≥ 6`, `t < 3: t–3; t ≥ 3: ≥ 3`, matrice posizioni a 10 colonne) in `weldingQualificationRules9606Part2.js` codificate **solo dopo** l'estratto VQ-3; profilo BW 9606-2 usa `thickness_t_test_mm`; validità 2 anni + conferma 6 mesi + prolungamento (§9); gruppi Al solo `info` (HITL 5); voce `verify_9606_2`; **regressione** 9606-1 invariata. Se il contratto richiede modifiche → stop, handoff, aggiornare il piano (contract review).

**VQ-11 — 14732.** *Obiettivo*: parte A: completezza da Annex C (estratto) e finding `info` «tabelle 9606 non applicabili» per i campi dimensionali presenti su un record 14732; severità massima `info`, `text_status: 'estratto_ocr'`. Parte B (dopo HITL 1): rivede clausole su NORMA_00xxx e abilita `warn`. *DoD A*: voce `verify_14732`; nessuna regola copiata da 9606-1.

**VQ-12 — Smoke + chiusura.** *Obiettivo*: § 7. *DoD*: nuovo smoke su TEST, GUIDA (lezione), roadmap, `DATABASE.md` allineato (ultimo `NNN` = 169), bussola, spunte nel piano.

### 6.4 Brief

I quattro brief della **prima onda** sono creati in questa PR: [`DEPUTYTASK_VERIFICA_QUALIFICHE_CORE.md`](DEPUTYTASK_VERIFICA_QUALIFICHE_CORE.md) (VQ-1), [`…_PANEL_FE.md`](DEPUTYTASK_VERIFICA_QUALIFICHE_PANEL_FE.md) (VQ-2), [`…_NORME_DOC.md`](DEPUTYTASK_VERIFICA_QUALIFICHE_NORME_DOC.md) (VQ-3), [`…_RIELAB_FE.md`](DEPUTYTASK_VERIFICA_QUALIFICHE_RIELAB_FE.md) (VQ-4). Le onde 2–4 sono **solo righe di questo piano**: ogni brief nasce quando le dipendenze sono su `main` (nome `DEPUTYTASK_VERIFICA_QUALIFICHE_<SLICE>.md`, file elencati in § 6.2). Convenzione stream: questi file non vanno riusati per altri epic.

---

## 7. Piano di verifica end-to-end

| Livello | Cosa | Quando |
|---------|------|--------|
| **L1 BE** | `npx jest` mirato per slice (percorsi in § 6.3); contratto su tutti i pack; test «nessuna scrittura»; test sync registro ↔ whitelist esteso | Ogni slice BE |
| **L1 FE** | `NODE_ENV=test npx vitest run` mirato + `npm run build` | Ogni slice FE |
| **Repo** | `check-harness-boot.js` (path in backtick), `check-utf8-encoding.js`, test `manualEditCompletenessCheck` non toccato (nessun campo `aiExpectedSchema` nuovo) | Ogni slice |
| **Fixture** | Valori ai bordi delle tabelle (§ 6.3, VQ-6) + 3–4 certificati sintetici completi (BW/P, FW/P, BW/T, 311) | VQ-5/6/7 |
| **Campione reale** | Certificati anonimizzati del committente (HITL 2): tasso di `warn` su certificati noti corretti = 0 atteso; ogni `warn` atteso su errori noti | Prima di «pronta» per VQ-5/6/10 |
| **Smoke su TEST** | `SGQ_APP_EMAIL/PASSWORD` → nuovo `backend/scripts/smoke-qualifica-verifica-test.js` (accanto a `smoke-ingest-e2e-test.js`, ambiente `https://sistemi.fr-busato.it:8443/test-api/api/v1`): upload di un PDF campione → `verification` presente e `status` invariato; `POST /qualifications/verify` con campi noti; `GET/POST /admin/reprocess-tasks/verify_9606_1` → report senza modifiche (conteggio record `qualifications` invariato prima/dopo) | VQ-12 (dopo deploy su TEST) |
| **Smoke ingest esistente** | `node backend/scripts/smoke-ingest-e2e-test.js` invariato verde | VQ-7, VQ-12 |
| **Smoke post-deploy** | `SGQ_SMOKE_PATHS=login,qualifiche node backend/scripts/smoke-percorsi-critici.mjs` (percorso toccato: Qualifiche + ingest) | Dopo il deploy di VQ-9 e VQ-12 |
| **Deploy** | `deploy-manifest.json` aggiornato per **ogni** `.js` nuovo in `backend/src/` (test VQ-1); restart con verifica **MainPID** prima/dopo | Con il deploy, mai prima |

**HITL che restano**: sì esplicito per qualsiasi migrazione in PROD (VQ-ACK, solo se D3) e per l'eventuale applicazione della 168 sul VPS (se non già fatta: stato non assunto); risposta alle richieste § 3.1; decisioni D1–D7; consenso se si decide che i pack normativi sono livello **Alto** (D6).

## 8. Rischi aperti

1. **Falsi positivi** sui certificati reali (tolleranze, prassi dell'ente): mitigati da asimmetria `warn`/`info`, `warn` solo con `verificabile`, campione reale, nessun blocco.
2. **Dati di prova assenti nei record esistenti** (colonne 168 vuote, migrazione forse non applicata): il report dirà «non verificabile» per la maggior parte finché non si fanno i backfill AI già esistenti → ordine d'uso al committente.
3. **Estratto 9606-1 discordante dal testo ufficiale su §5.2** (142): corretto in VQ-3/VQ-6 *prima* della regola; segnala che anche altri punti dell'estratto potrebbero divergere → VQ-3 rilegge Annex A e §9.
4. **9606-2 BW usa `t`, il form oggi tratta BW 9606-* con `s` depositato**: un record 9606-2 BW oggi mostra l'etichetta sbagliata; VQ-10 la corregge nei profili, ma fino ad allora la verifica 9606-2 non va attivata.
5. **Doppia fonte gas** tra plausibilità e registry: gestita in VQ-7 (un solo avviso).
6. **File condivisi**: `reprocessableFields.js` (VQ-8 → VQ-10 → VQ-11 serializzati) e `deploy-manifest.json` (righe additive, conflitto banale).
7. **Contratto congelato troppo presto**: secondo profilo (VQ-10) come prova; se cambia, handoff e nuova versione `engine_version`.
8. **Percorso ingest critico** (`qualificationIngest.service.js`): modifica additiva, ma smoke obbligatorio.

## 9. Decisioni che spettano al committente

| # | Decisione | Default del piano |
|---|-----------|-------------------|
| D1 | Terzo stato `non_verificabile_dato_mancante` (oltre ai due richiesti) | Sì: distingue «manca la norma» da «manca il dato di prova/combinazione non modellata» |
| D2 | Confronto validità senza tolleranza (solo arrotondamento 0,01), `warn` solo su over_claim | Sì; da rivedere sul campione reale |
| D3 | Registrare una «presa visione» degli avvisi (audit trail, migrazione) | No (nessuna migrazione); se sì → VQ-ACK, Alto |
| D4 | 14732 parte A subito su estratto con max `info` | Sì |
| D5 | Certificati legacy EN 287-1 rilevanti? | Nessuna azione finché non risponde |
| D6 | Pack normativi: Medio con gate rafforzato o Alto (consenso per ogni merge) | Medio con gate rafforzato + campione reale prima di «pronta» |
| D7 | Aggiungere campi/colonne per le 8 voci Annex A non modellate e per la validità filler/dettagli (nuove colonne ⇒ migrazione + voce Rielaborazioni nella stessa slice) | No in questa epic; richiede HITL 4 per Tab. 3/4/5/11/12 |
| D8 | Usare gli esiti per i semafori di copertura commessa | No (fuori epic) |

## Esito sessione di charting (06/10/2026)

- Piano e quattro brief di prima onda scritti; backlog norme aggiornato; riga in roadmap. **Nessuna** slice eseguita, nessun codice, nessuna migrazione.
- Spunte DoD: da compilare slice per slice (VQ-1 … VQ-12) nelle sessioni di esecuzione.
