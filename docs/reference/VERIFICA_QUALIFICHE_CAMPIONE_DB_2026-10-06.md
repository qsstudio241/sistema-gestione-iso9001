# Verifica qualifiche vs norma — misura sul campione reale del DB (06/10/2026)

> **Solo dati aggregati.** Nessun nome, numero di certificato, azienda, ente, percorso file o data di nascita compare qui. Gli esempi sono descritti per pattern di campi tecnici. Misura in **sola lettura** (nessuna scrittura, nessuna migrazione, nessun deploy) del motore `backend/src/services/qualificationVerify` (tip `main` 972ded5a, VQ-1…VQ-8 + pack 5/6) sulle qualifiche già presenti in produzione.
> Serve a: D2 (tolleranza/severità `warn`), D6 (gate «pronta» dei pack normativi), HITL 2 («campione di certificati reali») di [`PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md`](../agent-tasks/PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md).

## 1. Sintesi (le 8 cose da sapere)

1. **Tenant misurato:** `MASON_Srl` (`organization_id` 1003) — **143 qualifiche** (137 saldatori ISO 9606-1, 6 operatori «ISO 14732»). Le altre organizzazioni hanno 8 record in tutto (1001: 3 di prova; 1004: 5) e sono misurate **a parte** (§3.4). Nessuna misura mescola i tenant.
2. **Migrazione 168: APPLICATA** (le 6 colonne `welding_process_test`, `welding_processes_validity`, `welding_position_test`, `thickness_s_test_mm`, `thickness_t_test_mm`, `pipe_diameter_test_mm` esistono) — ma **sono vuote al 100%** (0/143). Non è stata applicata nulla in questa sessione.
3. **Causa:** il backend sul VPS non ha ancora il codice VQ né il prompt di ingest aggiornato (sul VPS `documentTypeSchemas.js` è del 16/09 e non contiene le chiavi `*_test`; nessuna chiave `*_test` compare in alcun `staged_fields_json` fino a ottobre). Quindi **la correttezza di tabella (Tab. 6/7/8/9/10, processi) oggi non è misurabile sui dati reali**: i controlli `THK_BW`, `THK_FW`, `PIPE_DIAMETER`, `POSITIONS`, `PROCESS`, `DESIGNATION` rispondono `non_verificabile_dato_mancante` su ~100% dei record.
4. **Findings reali sul tenant 1003:** 22 `warn` su **20 record su 143 (14,0%)**; 333 `info` verificabili; 323 `non_verificabile_dato_mancante`; 0 `non_verificabile_fonte_mancante`. I `warn` sono **tutti** di completezza/date (`THK_VALIDITY` 19, `CONFIRMATION_INTERVAL` 2, `FILLER_GROUP` 1), **nessuno** di tabella.
5. **Giudizio manuale sui 22 warn (tutti letti, nessun campione necessario):** 0 scarti normativi confermabili senza PDF; 17 sono **difetti di dato/estrazione reali** (utili da segnalare), 5 sono **ambiguità di convenzione** (falsi positivi di fatto: «t≥3» senza flag «senza limite») — §5.
6. **Prova «what-if» sui dati di validità già presenti** (ricalcolo inverso: esiste una prova s/t/D/posizione che renda il certificato coerente con la tabella?): spessore 126/130 esatti e 2 «più stretti», 2 anomalie; posizioni 137/137 coerenti; diametro mai in eccesso. **Le regole di tabella non sono rumorose per natura**: il rischio di falsi positivi sta nell'**estrazione dei dati di prova** (non ancora presenti), non nelle tabelle — §6.
7. **Corpus omogeneo e già rivisto da persona:** 143/143 record vengono dall'ingest e sono `confirmed` da un revisore; 138/143 sono stati **corretti** (media 4 campi), 5 accettati senza modifiche. Solo **2 enti emittenti** distinti nei 137 certificati 9606-1: i risultati **non generalizzano** ad altri emittenti/layout — §7.
8. **Cosa serve:** (a) deploy backend VQ + prompt ingest e **backfill Rielaborazioni** delle 6 colonne `*_test` (le voci esistono in `REPROCESSABLE_FIELD_REGISTRY`), poi **ripetere questa misura**; (b) HITL 2: PDF dei 20 record con `warn` + 10 di controllo, per la verità di terreno; (c) 9606-2 e 14732 **non hanno alcun record utile** nel DB (0 alluminio; 14732 = 6 record, pack ancora vuoto).

## 2. Metodo e vincoli rispettati

| Voce | Esito |
|---|---|
| Accesso | VPS via SSH (chiave da secret cloud, file temporaneo `chmod 600` fuori dal repo, poi cancellato) |
| Sul VPS | solo `SELECT` (script con guardia `^SELECT`, retry per «insufficient system memory»); script in `/tmp` del VPS, rimossi a fine lavoro; nessuna scrittura in `/var/www/sgq-backend`, nessun restart |
| Anonimizzazione alla fonte | nomi persona → `P001…`; numero certificato → `sha256(salt casuale per run)` troncato a 8 caratteri (il salt non esce dal VPS); enti emittenti/esaminatori → `E01…`; eliminati: percorsi/URL file, email, CF, note libere, dettaglio ambito, codici personale/diploma; `equipment_type` (matricole macchina) usato solo in locale e non riportato |
| Dati conservati | solo campi tecnici usati dal motore (norma, tipo, processo, prodotto, giunto, posizioni, spessori, diametri, gruppi, gas, date esame/scadenza/conferma, designazione) + flag di processo (`staging confermato`, `feedback accettato/corretto`, n. campi corretti) |
| Export | JSON anonimo in `/tmp` locale (permessi 600), mai nel repo; cancellato a fine lavoro |
| Motore | `verifyQualification(riga, { mode: 'db' })` — stessa modalità del loader di Rielaborazioni (`verifyReprocess.service.js`); nessuna modifica al codice di prodotto |
| Loader | stessa semantica di `verifyRecordLoader.js` (tutti i record `status != 'revocata'`; nessun record revocato nel DB) |

Individuazione del tenant: «Mason» in [`PROJECT_ROADMAP.md`](../PROJECT_ROADMAP.md) è il coordinatore di saldatura cliente; nel DB l'unica organizzazione con nome corrispondente è `organization_id` 1003 (`MASON_Srl`, moduli `qualifiche`, `saldatura`, `ai_import` attivi), con 1 utente admin; ha 143 delle 151 qualifiche totali.

## 3. Composizione del corpus

### 3.1 Per organizzazione

| Org | Qualifiche | Note |
|---|---:|---|
| 1003 (Mason) | 143 | 137 «Saldatore ISO 9606-1», 6 «Operatore ISO 14732» |
| 1004 | 5 | 3 saldatori, 1 NDT UT, 1 generica |
| 1001 | 3 | dati di prova («Test» ×2, 1 operatore 14732) |
| 1002, 1007 | 0 | — |

### 3.2 Tenant 1003: norma/edizione/profilo

| Norma/edizione (dal motore) | Record | Profilo registry | Pack |
|---|---:|---|---|
| ISO 9606-1:2017 | 136 | BW 70 · FW 66 | completezza + correttezza |
| ISO 9606-1:2012 | 1 | BW | idem (edizione elencata nei pack) |
| ISO 14732 (edizione assente) | 6 | `14732` | **stub vuoto (`rules: []`)** → 0 finding |

I 137 record 9606-1: BW 71 / FW 66; P 81 / T 56 (tutti i tubi con diametro minimo); processi 135 (85), 141 (34), 111 (13), 138 (4), 136 (1). **15% (21 BW/T) ha «BRANCH» nei dettagli giunto.** 45 persone distinte nei 143 record (13 con 1 solo certificato, 1 con 14); esami 2023–2026 (82 nel 2025); tutti i certificati con scadenza = esame + 3 anni.
I 6 record «14732»: 3 sono **stud welding (783)** e 3 **arco sommerso (121)** con modalità «meccanizzata/automatica»; nessun 9606-2 (alluminio), nessun PES/PAV, nessun 311, nessun NDT nel tenant.

### 3.3 Colonne popolate (137 record 9606-1)

| Gruppo | Colonna | Popolata |
|---|---|---:|
| Base | norma (`standard_ref`), numero cert., ente, gruppo materiale, processo, tipo prodotto/giunto, posizioni, dettagli giunto | 100% |
| Base | gruppo apporto (`filler_material`) | 99,3% |
| Base | gas di protezione | 90,5% |
| Base | modo di trasferimento | 65,0% |
| Validità | `thickness_min_mm` | 94,2% |
| Validità | `thickness_max_mm` | 24,8% |
| Validità | `thickness_max_unlimited` (true) | 65,7% |
| Validità | `pipe_diameter_min_mm` (= 100% dei tubi) | 40,9% |
| Validità | `pipe_diameter_max_mm` | **0%** |
| Date | esame, scadenza, ultima conferma, prossima conferma, rivalidazione | 100% |
| Campo legacy | `thickness_range` (testo, es. «3-18 mm») | 52,6% |
| **Prova (mig. 168)** | `welding_process_test`, `welding_processes_validity`, `welding_position_test`, `thickness_s_test_mm`, `thickness_t_test_mm`, `pipe_diameter_test_mm` | **0%** |
| Altro | `examiner_body` | 0% |

Osservazione: `qualification_designation` è **costruita dall'app a partire dalle colonne di validità** (`weldingDesignation.js`): non è una fonte indipendente. La regola `DESIGNATION` (designazione vs campi di prova) sarà quindi confrontata con dati di prova letti dall'AI, ma la designazione stessa è un'eco della validità → controllo parzialmente circolare.

### 3.4 Altre organizzazioni (misurate separatamente)

| Org | Record | Esito |
|---|---:|---|
| 1004 | 5 | 2 saldatori 9606-1:2017 BW: 0 `warn`. 1 saldatore con norma assente → profilo `UNKNOWN`: 6 `warn` di completezza (tipo prodotto, giunto, apporto, posizioni, dettagli giunto, ente): record incompleto, apporto scritto nel campo gruppo materiale (campi scambiati). 2 non coperti (NDT UT, generica) → `QV.ENGINE.SOURCE_MISSING` info |
| 1001 | 3 | 2 «Test» → `SOURCE_MISSING`; 1 operatore 14732 → 0 finding |

## 4. Risultati del motore — tenant 1003 (143 record)

### 4.1 Severità e stato

| Severità / stato | Finding | % sul totale finding (678) |
|---|---:|---:|
| `warn` · verificabile | 22 | 3,2% |
| `info` · verificabile | 333 | 49,1% |
| `non_verificabile_dato_mancante` (sempre `info`) | 323 | 47,6% |
| `non_verificabile_fonte_mancante` | 0 | 0% |

Record con **almeno un `warn`**: **20/143 = 14,0%** (20/137 = 14,6% sui soli 9606-1). Record senza alcun finding: 6 (i 14732). Record con solo `info`/non verificabili: 117.

### 4.2 Finding per codice (`WQ9606_1.` omesso)

| Codice | Sev. / stato | N | % record (143) |
|---|---|---:|---:|
| `COMP.THK_TEST` | info · verificabile | 137 | 95,8% |
| `COMP.POSITION_TEST` | info · verificabile | 137 | 95,8% |
| `CORR.POSITIONS` | info · dato mancante (manca `welding_position_test`) | 137 | 95,8% |
| `CORR.THK_FW` | info · dato mancante (manca `t` di prova) | 66 | 46,2% |
| `CORR.THK_BW` | info · dato mancante (manca `s` di prova) | 64 | 44,8% |
| `COMP.PIPE_DIAMETER_TEST` | info · verificabile | 56 | 39,2% |
| `CORR.PIPE_DIAMETER` | info · dato mancante (manca `D` di prova) | 56 | 39,2% |
| **`COMP.THK_VALIDITY`** | **warn · verificabile** | **19** | **13,3%** |
| `COMP.TRANSFER_MODE` | info · verificabile | 2 | 1,4% |
| **`CORR.CONFIRMATION_INTERVAL`** | **warn · verificabile** | **2** | **1,4%** |
| **`COMP.FILLER_GROUP`** | **warn · verificabile** | **1** | **0,7%** |
| `CORR.TRANSFER_MODE` | info · verificabile | 1 | 0,7% |

I **10 codici più frequenti** sono le prime 10 righe della tabella (8 `info`, 2 `warn`; le ultime due posizioni sono a pari merito con `CORR.CONFIRMATION_INTERVAL`). Regole **mai scattate** su dati reali: `PROCESS`, `DESIGNATION`, `GAS_14175`, `MATERIAL_GROUP`, `PLATE_TO_PIPE`, `VALIDITY_PERIOD`, `THK_BW_LAYERS` (nessun `s` di prova), `COMP.PRODUCT_TYPE/JOINT_TYPE/POSITIONS/WELD_DETAILS/ISSUING_BODY/STANDARD_REFERENCE`, `COMP.SHIELDING_GAS`.

**Rumore da `info`:** il 95,8% dei record riceve 3 `info` fisse («manca spessore/posizione/diametro di prova») + 3 «non verificabile». È informazione corretta ma, finché le colonne di prova sono vuote, **dominano la lista** e nascondono i 22 `warn`. Raccomandato aggregarle in un'unica riga («Dati di prova non estratti: controlli di tabella non eseguibili») oppure non mostrarle in UI/Rielaborazioni fino al backfill.

## 5. Giudizio manuale dei `warn` (22 su 22, campi letti uno per uno)

### 5.1 `COMP.THK_VALIDITY` (19 record) — completezza validità spessore

| Classe | N | Pattern anonimo | Giudizio |
|---|---:|---|---|
| A. Massimo perso | 6 | BW piastra, `thickness_min_mm`=3, `thickness_max_mm` vuoto, flag «senza limite» falso, **testo `thickness_range` = «3-18 mm»**; designazione costruita «t≥3» | **Errore di dato/estrazione reale** (il certificato dichiara un massimo 18 che non è nella colonna; la designazione «t≥3» è fuorviante). Warn **corretto** |
| B. Validità solo nel testo | 5 | BW tubo, min e max vuoti, testo `thickness_range` = «3-12.6 mm» | **Errore di estrazione/colonna**: dato presente solo nel campo legacy. Warn corretto; correggibile in modo meccanico leggendo `thickness_range` |
| C. «t≥3» senza flag | 5 | BW piastra, min=3, max vuoto, flag falso, testo assente o «≥3mm» | **Falso positivo di convenzione**: «da 3 mm senza limite» è lo scritto normale per s≥12 (Tab. 6); l'ingest non ha impostato `thickness_max_unlimited` (corretto a mano solo 14 volte su 243 eventi). Warn **troppo severo** → `info` o auto-inferenza del flag |
| D. Genuinamente mancante | 3 | BW tubo senza alcun dato di spessore; BW piastra senza alcun dato; FW tubo con min vuoto e max+flag valorizzati | **Vero buco di dato**. Warn corretto |

Totale: 11 TP-dato (A+B), 3 TP-vuoto (D), **5 FP di convenzione (C)**. Leggendo `thickness_range` come fonte di ripiego (classi A+B) e inferendo «senza limite» da «min=3 senza max» (classe C), i warn residui scenderebbero da 19 a **3** (solo classe D).

### 5.2 `CORR.CONFIRMATION_INTERVAL` (2 record)

Prossima conferma a **17 e 18 mesi** dall'ultima conferma (attesi 6 mesi, §9.2). Sugli altri 135 record l'intervallo è **esattamente 6 mesi** → `next_confirmation_due` è, di fatto, una data **derivata** (la regola è quasi tautologica). I 2 casi sono incoerenze reali di dato (probabile data errata dall'estrazione o dalla correzione manuale; entrambi i record hanno già avuto correzioni umane). Warn **corretto** (0 FP). Cautela: `last_confirmation_date` e `next_confirmation_due` sono i due campi **più corretti dagli umani** (§7.2): la regola è corretta ma si fida di campi instabili.

### 5.3 `COMP.FILLER_GROUP` (1 record, tenant 1003)

BW piastra 135 con gruppo apporto assente e designazione senza «FMx»: **vero buco di dato** (warn corretto). (Nel tenant 1004 un secondo caso: gruppi FM scritti nel campo gruppo materiale — campi scambiati, vero errore di dato.)

### 5.4 Segnali `info` utili trovati dal motore

- `CORR.TRANSFER_MODE` (1): processo 141 (TIG) con «short_arc» → **errore di dato reale**, giustamente `info`.
- `COMP.TRANSFER_MODE` (2): modo di trasferimento mancante dove atteso: corretto.

### 5.5 Anomalie reali che il motore **non** vede (candidati a regole di plausibilità, non normative)

- 3 record con **ultima conferma anteriore alla data di esame** (di 1 giorno) e 1 con prossima conferma pochi giorni oltre la scadenza del certificato (intervallo di 6 mesi corretto, ma la conferma cade dopo la scadenza). Nessuna regola del motore li segnala.
- 1 certificato 9606-1:2012 trattato con le regole 2017 (le edizioni 2012/2013 sono dichiarate nei pack): accettabile, ma la fonte normativa del repo è una sola edizione.
- 3 record «14732» sono stud welding (783): norma diversa (ISO 14555), non coperta.

## 6. Regole sospette di fragilità — misura «what-if»

Poiché le colonne di prova sono vuote, per ogni record con validità dichiarata è stato **ricalcolato all'indietro** il valore di prova (s, t, D, posizione) che rende il certificato coerente con le funzioni di `weldingQualificationRules9606.js` (unica fonte dei numeri). Esito `esatto` = tabella restituisce proprio quel range; `più stretto` = il certificato è dentro la tabella (sarebbe `info`); `impossibile` = nessun valore di prova evita `warn` (il certificato è più largo di qualsiasi riga di tabella).

| Regola | Record con claim | Esatto | Più stretto | Impossibile | Lettura |
|---|---:|---:|---:|---:|---|
| `THK_BW` (Tab. 6) | 64 | 62 | 2 | 0 | **Nessun FP strutturale.** I 2 «più stretti» sono «t6-24» (min 6 non esiste in Tab. 6: valido solo con s≥12) |
| `THK_FW` (Tab. 8) | 66 | 64 | 0 | 2 | 63 su 66 sono «t≥3» (esatto). 2 impossibili: «t≥1 senza limite» (Tab. 8 con t=1 dà 1…3: vero scarto o errore di lettura) e 1 record con min vuoto e massimo+flag contraddittori |
| `PIPE_DIAMETER` (Tab. 7) | 56 | — | — | — | Mai `warn` possibile sul minimo scritto: Tab. 7 dà min=0,5·D (≥25) ⇒ ogni minimo ≥ 25 è raggiungibile; sotto 25 vale D. Il massimo non è mai popolato (0/56) → nessun controllo su D<25 |
| `POSITIONS` (Tab. 9/10) | 137 | 134 | 3 | 0 | Coerenti con almeno una posizione di prova |
| `PROCESS` (§5.2) | 0 | — | — | — | **Non misurabile**: `welding_processes_validity` 0%; solo 1 record multiprocesso («135, 138») che la regola salterebbe |
| `CONFIRMATION_INTERVAL` | 137 | 135 | — | 2 | vedi §5.2 |

### 6.1 `THK_BW` vs `thickness_t_test_mm`

La regola usa lo spessore **depositato `s`** (Tab. 6); se c'è solo `thickness_t_test_mm` risponde «non verificabile» con un suggerimento. L'ingest/form estrae **`t`** (spessore materiale). Per processo singolo e stesso filler la nota a) di Tab. 6 dice **s = t**: usare `t` come `s` renderebbe verificabili **64 BW su 71** invece di 0. Rischi: (i) **diramazioni** (nota b: lo spessore è quello del ramo o del tubo principale) — **21 BW/T (15% del corpus) hanno «BRANCH»**; (ii) multiprocesso (nota f); (iii) `s≥12` richiede ≥3 passate (nota e) → la `THK_BW_LAYERS` info comparirebbe su **24 BW** (34%) come rumore permanente. Fixture S09 e S18.

### 6.2 Diametro Tab. 7 sui giunti d'angolo

- Il testo di §5.7 nel Markdown del repo dice «per le saldature **a cordone d'angolo** il campo di qualificazione per gli **spessori** è la Tab. 8»; Tab. 7 è presentata per i giunti **di testa**. Applicarla ai FW su tubo (22 record) è **un'interpretazione**, non una clausola esplicita → **ambiguità di norma**, non rilevabile con i soli dati.
- Valori reali sui FW/T: 12/22 sono diametri esterni commerciali (60,3 ×5; 48,25≈48,3 ×6; 42,4 ×1) → il certificato sembra riportare il **diametro provato** («D≥60,3») e non 0,5·D. Con `D` di prova = 60,3 la tabella darebbe min 30,15 ≥ 25: il certificato sarebbe **più stretto** → `info` (S12). Nessun `warn`, ma solo se `D` è estratto bene: **`pipe_diameter_mm` è corretto a mano nel 19,8% dei casi** (§7.2). Con `D` letto sul tubo sbagliato (ramo vs principale) la regola produrrebbe `warn` spuri.

### 6.3 Regola `PROCESS`

Non misurabile (dato assente). Noto: il Markdown 9606-1 del repo e l'estratto sono stati allineati da VQ-3/VQ-6; i processi del corpus sono quasi tutti semplici (135/141/111/138). Finché non esistono record con `welding_processes_validity` letto dal certificato, non c'è base per un `warn`.

### 6.4 Completezza su campi che l'ingest non estrae

Anche con il nuovo prompt, `examiner_body` (0%), `pipe_diameter_max_mm` (0%) e i sei campi `*_test` (0% sui dati già staged) non esistono nel corpus. Le regole `COMP.*_TEST` (info) saranno vere ma permanentemente rumorose sui 143 record fino al backfill. `COMP.TRANSFER_MODE` e `SHIELDING_GAS` hanno già le colonne (65% e 91%): niente rumore.

### 6.5 Token di posizione non riconosciuti

I 17 BW/T con **«PH-L045»** (12% del corpus) hanno la posizione come token composto; la matrice di Tab. 9 usa la chiave **`H-L045`** e `computeQualifiedWeldingPositions('PH-L045')` restituisce `null`: se l'estrazione scriverà `PH-L045` come `welding_position_test`, la regola dirà «non è una riga della tabella» (info), non `warn` (nessun FP, ma 17 record non verificabili). 4 BW dichiarano **PB** (non esiste in Tab. 9 BW) e 6 dichiarano «PH» tra le posizioni: tutti `non_verificabile`, mai `warn`.

## 7. Qualità del corpus

### 7.1 Conferma umana vs solo AI (tenant 1003)

| Indicatore | Valore |
|---|---|
| Record da ingest (`ingest_staging.committed_qualification_id`) | 143/143 |
| Staging `review_status = confirmed` con revisore | 143/143 |
| `feedback` = **corrected** / **accepted** | 138 / 5 |
| Campi corretti per record corretto | media 4,0 (min 1, max 10) |
| Record modificati anche dopo la creazione (`updated_at` > `created_at` + 1 min) | 29 |
| Certificato PDF conservato | 143/143 |
| `approval_status = approvata` | 143/143 (flag di default: non discrimina) |
| Duplicati di numero certificato (stesso hash) nei 9606-1 | 0 |

Il corpus è quindi **«confermato da persona» al 100%** (gate di revisione dell'ingest), ma il 96,5% ha richiesto correzioni: la verità di terreno **non** è indipendente dall'AI su campi non corretti e non è verificata su PDF.

### 7.2 Campi più corretti dagli umani (feedback `patentino_saldatore`, tenant 1003; 243 eventi: 68 accettati, 165 corretti, 10 scartati)

| Campo | Corretto in | % degli eventi |
|---|---:|---:|
| `last_confirmation_date` | 133 | 54,7% |
| `next_confirmation_due` | 113 | 46,5% |
| `standard_reference` | 86 | 35,4% |
| `weld_details` | 58 | 23,9% |
| `issuing_body` | 55 | 22,6% |
| `pipe_diameter_mm` | 48 | 19,8% |
| `thickness_max_mm` | 31 | 12,8% |
| `thickness_min_mm` | 26 | 10,7% |
| `welding_positions` | 17 | 7,0% |
| `thickness_max_unlimited` | 14 | 5,8% |
| `filler_material_group` | 9 | 3,7% |
| `joint_type` / `product_type` | 5 / 2 | 2,1% / 0,8% |

(14732: 7 eventi, 5 corretti, soprattutto sulle date di conferma.) Lettura: le date di conferma, la norma e il diametro sono i campi dove l'estrazione sbaglia di più; sono proprio i dati su cui poggiano `CONFIRMATION_INTERVAL`, `STANDARD_REFERENCE` (profilo/edizione) e `PIPE_DIAMETER`.

### 7.3 Certificati non 9606 o edizioni non coperte

| Caso | N (tutti i tenant) | Comportamento del motore |
|---|---:|---|
| ISO 14732 (tenant 1003 ×6, 1001 ×1) | 7 | profilo `14732`, **0 finding** (pack vuoto: VQ-11) |
| NDT UT / generica / «Test» (norma assente) | 4 | `SOURCE_MISSING` (info) |
| ISO 9606-1 edizione 2012 | 1 | coperta dal pack (2017/2013/2012) |
| ISO 9606-2 (alluminio), PES/PAV, 311, 142 | **0** | nessun dato: pack 9606-2 e regole 311/142 **non misurabili** |
| Stud welding (processo 783) classificati «14732» | 3 | fuori campo del tipo documento (norma tipica diversa, non coperta) |

## 8. Raccomandazioni di taratura (D2 / D6)

Legenda: **warn pronto** = misurato su dati reali o dimostrato dal what-if, 0 FP osservati; **info finché** = tenere `info` fino a nuovi dati.

| Regola | Proposta | Motivo / dato |
|---|---|---|
| `COMP.FILLER_GROUP` | **warn pronto** | 1 TP, 0 FP |
| `CORR.CONFIRMATION_INTERVAL` | **warn pronto** (n=2) | 2 TP, 0 FP; attenzione ai campi instabili (§7.2); verificare i 2 PDF |
| `COMP.THK_VALIDITY` | **warn solo per classi A, B, D; info per C** | 5/19 FP di convenzione; ridurre i FP leggendo `thickness_range` e inferendo «senza limite» da «min=3 senza max» (modifica di prodotto: fuori da questa misura) |
| `CORR.THK_BW` | **warn pronto dopo backfill di `thickness_s_test_mm`**; **`info` se «BRANCH»** | 62/64 esatti, 0 FP strutturali; rischio solo da estrazione e diramazioni (15% corpus); valutare fallback s=t (nota a) |
| `CORR.THK_FW` | **warn pronto dopo backfill di `t`** | 64/66 esatti; 2 anomalie vere da guardare sui PDF |
| `CORR.PIPE_DIAMETER` (BW) | warn dopo backfill, ma **tarare dopo il campione** | nessun FP strutturale; `D` corretto a mano nel 19,8% |
| `CORR.PIPE_DIAMETER` (**FW**) | **info finché HITL sulla norma** | ambiguità Tab. 7 su cordoni d'angolo (§6.2); 12/22 certificati riportano il diametro provato |
| `CORR.POSITIONS` | warn pronto dopo backfill, **con alias `PH-L045`→`H-L045`** | 137/137 coerenti; 27 record con token non giudicabili |
| `CORR.PROCESS` | **info finché non ci sono dati** | 0 record con validità processi; nessuna base empirica |
| `CORR.DESIGNATION` | **info finché** | la designazione è derivata dalla validità (circolare) |
| `CORR.TRANSFER_MODE`, `GAS_14175`, `MATERIAL_GROUP` | già `info` — mantenere | 1 TP reale a livello info; 0 scatti su gas/gruppo materiale |
| `COMP.*_TEST`, `THK_BW_LAYERS` | **info aggregata** o non mostrata prima del backfill | 96% dei record, rumore permanente |
| Nuove regole di plausibilità (non normative) | proporre: conferma < esame; prossima conferma > scadenza | 4 record reali |

Stima: **3 regole sono già «pronte» a `warn`** sui dati reali (`FILLER_GROUP`, `CONFIRMATION_INTERVAL`, `THK_VALIDITY` per le classi A, B, D); **4 lo diventano dopo il backfill** delle colonne di prova (`THK_BW`, `THK_FW`, `PIPE_DIAMETER` su giunti di testa, `POSITIONS`); **3 vanno tenute a `info`** finché non ci sono altri dati o una decisione sulla norma (`PROCESS`, `DESIGNATION`, `PIPE_DIAMETER` su giunti d'angolo); le restanti sono già `info`.

Tolleranza D2 (nessuna oltre 0,01 mm): sui 130 certificati con spessore dichiarato, **nessuno cade nella fascia di tolleranza** (i valori sono esatti o nettamente fuori: es. 12,6/14,22/5,54 provengono da pareti tubo commerciali e coincidono col doppio di s). Non emerge alcun motivo per introdurre una tolleranza; da riverificare dopo il backfill con valori di `s` letti da AI.

## 9. Rischi e limiti della misura

- **Nessuna verità di terreno:** i giudizi sono di **coerenza interna** (campi ↔ tabella ↔ testo legacy), non confrontati col PDF. «TP» = difetto di dato/estrazione, non scarto normativo dimostrato.
- **Le regole di tabella sono quasi non esercitate** (colonne di prova vuote): i FP reali della correttezza sono **ignoti** finché non c'è backfill + nuova misura.
- **Corpus omogeneo:** 2 enti emittenti, 1 tenant, 45 persone, processi quasi solo 135/141; nessun 311, 9606-2, PES/PAV, NDT. Non generalizzabile.
- **Natura derivata di alcuni campi** (designazione, `next_confirmation_due`) → controlli parzialmente tautologici.
- **Sicurezza:** nessun dato identificativo in repo/log; il salt di hash non è stato conservato (gli hash non sono correlabili tra run). I `src_id` dei record non sono riportati nel documento.
- **Prodotto non toccato:** nessuna ipotesi sopra è implementata; ogni modifica alle regole è una slice separata (rischio «Medio con gate rafforzato»).

## 10. Proposta di fixture sintetiche (inventate dai pattern; nessuna copia di record)

Base: BW piastra, processo 135, apporto FM1, gas M21, posizioni PA, esame 2025-03-10, conferma 2025-09-10 → 2026-03-10. Valori **ricalcolati sul motore a `main` 972ded5a** (modalità `db`; ignorate le tre `info` di completezza `*_TEST`); `(nv)` = non verificabile. Candidate per un futuro `verifyRealPatterns.test.js` (da creare in una slice di prodotto).

| ID | Pattern (campi variati) | Atteso dal motore |
|---|---|---|
| S01 | BW, min 3 + «senza limite», `s`=12, posizione prova PA | nessun `warn`; `THK_BW_LAYERS` info (nv) |
| S02 | BW, min 3, max vuoto, flag falso (testo «3-18» perso) | `THK_VALIDITY` **warn** |
| S03 | BW, min e max vuoti | `THK_VALIDITY` **warn** |
| S04 | ultima conferma 2025-06-11, prossima 2026-12-11 | `CONFIRMATION_INTERVAL` **warn** |
| S05 | FW, min 1 + «senza limite», `t`=1 | `THK_FW` **warn** (over-claim massimo) |
| S06 | BW `s`=6, 3–13 | `THK_BW` **warn** |
| S07 | BW `s`=6, 3–12 | nessun `warn` (esatto) |
| S08 | BW `s`=6, 6–24 | `THK_BW` **warn** (massimo oltre 2s; con `s`≥12 sarebbe coerente) |
| S09 | BW solo `thickness_t_test_mm`=6, 3–12 | `THK_BW` info (nv) — caso del fallback s=t |
| S10 | tubo D=60,3, min 25 | `PIPE_DIAMETER` **warn** |
| S11 | tubo D=60,3, min 60,3 | `PIPE_DIAMETER` info (più stretto) |
| S12 | FW tubo D=60,3, min 60,3 | `PIPE_DIAMETER` info — caso ambiguità Tab. 7/FW |
| S13 | prova PC, dichiarate PA, PC, PE | `POSITIONS` **warn** |
| S14 | BW, dichiarate PA, PB (prova PA) | `POSITIONS` info (nv, PB fuori da Tab. 9) |
| S15 | processo 141 con «short_arc» | `TRANSFER_MODE` info |
| S16 | apporto FM7 | `FILLER_GROUP` **warn** (correttezza) |
| S17 | apporto assente | `FILLER_GROUP` **warn** (completezza) |
| S18 | BW diramazione («BRANCH ≥60°»), `s` letto 3 invece di 6, 3–12 | `THK_BW` **warn** — falso positivo da ambiguità (dopo taratura: info) |
| S19 | prova 141, validità «141, 135» | `PROCESS` **warn** |
| S20 | operatore 14732 (edizione 2013) | nessun finding (pack vuoto) |
| S21 | tipo NDT, norma assente | `SOURCE_MISSING` info (nv) |
| S22 | FW `t`=3, min 3 + «senza limite», prova PB, dichiarate PA, PB | nessun finding (caso pulito) |

## 11. Chiusura operativa

- VPS: script `/tmp/vq_*.js` e `/tmp/vq_anon.json` rimossi (verificato `ls /tmp/vq_*` vuoto); nessuna scrittura su `/var/www/sgq-backend`; nessun restart; nessuna migrazione.
- Locale: chiave SSH decodificata, export anonimo e risultati cancellati da `/tmp`; nulla nel repo oltre a questo documento.
- Prossimo passo suggerito (decisione del committente): deploy backend con VQ + prompt ingest → backfill Rielaborazioni delle 6 colonne `*_test` sul tenant 1003 → **ripetere questa misura** (stessa procedura, stesso script) → HITL 2 sui 20 record con `warn` + 10 di controllo.
