# WPQR — dati di prova (pagina 2): estratto operativo Annex B / A / C (SGQ)

> **Uso**: input normativo per le slice WV-4 (schema AI e persistenza), WV-5a/5b (pack di verifica) e WV-6a (editor passate) di [`PLAN_VERIFICA_WPQR_SLICES.md`](../agent-tasks/PLAN_VERIFICA_WPQR_SLICES.md). **Non** contiene regole di range: per quelle vedi [`ISO-15614-1-range-validita-WPQR.md`](ISO-15614-1-range-validita-WPQR.md), [`ISO-15614-2-range-validita-WPQR.md`](ISO-15614-2-range-validita-WPQR.md), [`ISO-14555-2025-range-validita-WPQR.md`](ISO-14555-2025-range-validita-WPQR.md).
> **Verifica**: ogni clausola citata è stata **aperta e letta** nel Markdown di `docs/Normative/` il 08/10/2026 (slice WV-2). Dove il testo è illeggibile o ambiguo non si decide: si scrive **GAP** (§ 7) con rimando alla richiesta HITL.
> **Fonti**: `NORMA_00043` (15614-1:2017+A1:2019), `NORMA_00031` (15614-2:2025), `NORMA_00033` (14555:2025), `NORMA_00045` (15613:2025), `NORMA_00014` (15609-1:2019). Estratti già in repo: [`ISO-15613-qualifica-pre-produzione.md`](ISO-15613-qualifica-pre-produzione.md), [`ISO-15609-WPS-contenuto.md`](ISO-15609-WPS-contenuto.md), [`GAP_WPQR_ESTENSIONI_ANNEX_B_2026-08-07.md`](../gap-reports/GAP_WPQR_ESTENSIONI_ANNEX_B_2026-08-07.md).
> **Solo documentazione**: nessuna soglia è definita da questo file (le cifre citate nei GAP sono quelle del testo ambiguo, non regole); nessun dato di cliente.

## Gate norme (dichiarato)

```text
Fonti Markdown:
- Coperte: 15614-1 §9 + Annex B (+ §8.3.x, §8.4.1–8.4.11, §8.5.2.3, §8.5.6, §7.1 Tab. 1/2); 15614-2 §9 + Annex A (+ §8.4.4–8.4.9); 14555 §9, §10.2.8.x, §10.4 + Annex C; 15613 §8, §10; 15609-1 §4.4–4.5
- Mancanti: ISO/TR 18491 e ISO/TR 17671-1 (-2, -4); Tab. 7 colonna Level 1; attribuzione L1/L2 di §8.4.7 e note di Tab. 3 (colonne intercalate); edizioni legacy
- Si parte su: tutto ciò che è leggibile; ogni dubbio resta GAP (§ 7), nessuna soglia inventata
```

## Legenda

| Termine | Significato |
|---------|-------------|
| **pag. 1 / 2 / 3** | Pagine del **modulo**: 1 = «Test piece / Range of qualification» (certificato); 2 = «Record of weld test» (con tabella passate); 3 = «Test results». Nei Markdown il modulo è spezzato in pagine di estrazione: 15614-1 Annex B = «Pagina» 47–51 (testata a 47, Test piece/Range a 48, Record of weld test a 49, esiti a 50–51); 15614-2 Annex A = 37–40; 14555 Annex C = 37–41 (a 37 c'è il modulo **WPS**, il WPQR è a 38–41) |
| **`*`** | Marcatura del modulo: «`*If required`» (15614-1 Annex B, ultima riga della pag. 2 e della pag. 3). Significa «se richiesto», **non** «obbligatoria» né «assente per norma» |
| **«shall» (§9)** | La base vincolante è il testo di §9 (15614-1/-2), §10 (15613), §10.4 (14555), **non** il modulo, che è un esempio di formato |
| **Campo esistente** | Colonna presente nella whitelist `WPQR_MANUAL_EDITABLE_FIELDS` di `welding.controller.js` |
| **Campo proposto** | Colonna/campo del piano § 2.2–2.3, **non ancora in DB** (migrazione WV-3) |
| **Stato fonte** | `leggibile` = clausola letta e senza ambiguità · `GAP-n` = vedi § 7 |

---

## 1. Base «shall» (verificata)

| Norma | Clausola | Cosa impone (testo letto) | Formato |
|-------|----------|---------------------------|---------|
| 15614-1 | §9 | La WPQR è la dichiarazione dei risultati di ogni provino, **re-test inclusi**. Vi sono inclusi «the relevant items listed for the WPS in the relevant part of ISO 15609» e i dettagli di ogni caratteristica non accettabile secondo la clausola 7. È «qualified» solo se non ci sono esiti inaccettabili e **firmata e datata** dall'esaminatore. Si **usa un formato WPQR** per presentazione uniforme | «An example of WPQR format is shown in Annex B». Se richiesto da norma applicativa, si allegano i certificati dei materiali base e dei consumabili |
| 15614-2 | §9 | Stessa struttura: WPQR con risultati del provino (nel testo letto: «pre-production test piece»), elementi della WPS di **ISO 15609-1**, difformità dalla clausola 7, firma e data; «A WPQR form shall be used» | «An example of the WPQR format is shown in Annex A» |
| 14555 | §10.4 | WPQR con risultati di ogni provino, re-test inclusi; vi sono inclusi gli elementi della WPS elencati nella **Clausola 9 della stessa 14555** (non 15609-1); firmata e datata da esaminatore o ente di prova | «A WPQR format, as shown in Annex C, **may** be used» (facoltativo, a differenza di 15614-1/-2 e 15613) |
| 15613 | §10 | WPQR con risultati del provino di pre-produzione; elementi della WPS delle norme di **Tabella 1** (15609-1…-6); difformità dalla clausola 7; firma e data; «A WPQR form shall be used» | **Nessun Annex con esempio di modulo** nel testo (solo Annex ZA/ZB) |
| 15609-1 | §4.1, §4.4–4.5 | Elenco degli elementi di una pWPS/WPS: è la lista che 15614-1/-2 e 15613 richiamano per la WPQR | Esempio di modulo WPS in Annex A (non WPQR) |

I tre Annex del modulo WPQR sono **esempi** (nel titolo degli Annex il marcatore «informative» compare intercalato alle parole del titolo; in 15614-1 l'indice è illeggibile sul punto, vedi GAP-6): l'obbligo è §9/§10/§10.4.

---

## 2. ISO 15614-1:2017+A1:2019 — Annex B (`NORMA_00043`)

**Pag. 1 — testata del certificato** (Markdown «Pagina» 47)

| Riga del modulo | `*` | Clausola | Campo | Stato fonte |
|-----------------|-----|----------|-------|-------------|
| Manufacturer's WPQR no. | — | solo modulo | `wpqr_code` (esistente) | leggibile |
| Examiner or examining body | — | §9 (firma/data dell'esaminatore) | `examiner_body` (esistente) | leggibile |
| Manufacturer · Address · Reference no. | — | solo modulo | anagrafica (non è dato di prova) | leggibile |
| Code/testing standard | — | solo modulo | `standard_reference` (esistente) | leggibile |
| **Level** | — | §7.1 (Tab. 1 = Level 1, Tab. 2 = Level 2); §9 | `qualification_level` (esistente) | leggibile |
| Date of welding | — | solo modulo | `test_date` (esistente) | leggibile |

**Pag. 1 — «Test piece» / «Range of qualification»** (Markdown «Pagina» 48; due colonne: valore di prova / range qualificato)

| Riga del modulo | `*` | Clausola | Campo | Stato fonte |
|-----------------|-----|----------|-------|-------------|
| Product form | — | §8.3.3 (L1: ogni forma di prodotto qualifica tutte; L2: diametro, Tab. 9) | `product_type` (esistente) | leggibile |
| Welding process(es) — processi usati No. 1/2/3 | — | §8.4.1; 15609-1 §4.4.1 | `welding_process` (esistente); per passata `wpqr_test_runs.welding_process` (proposto) | leggibile |
| **Deposited metal thickness (mm)** (per processo) | — | §8.3.2.1 (per multiprocesso si usa lo spessore depositato **di ciascun processo**); Tab. 7 | `deposited_thickness_mm` (proposto, gruppo A; processo principale) | leggibile · colonna L1 di Tab. 7: GAP-3 |
| Type of joint and weld | — | §8.4.3; 15609-1 §4.4.2 | `joint_type` (esistente) | leggibile |
| Parent material group(s) and sub-group(s) | — | §8.3.1.1–8.3.1.2 (Tab. 5); 15609-1 §4.3.1 | `base_material_group` (esistente) | leggibile |
| Parent material thickness (mm) | — | §8.3.2.2 (Tab. 7); 15609-1 §4.3.2 | `thickness_tested`, `thickness_min/max` (esistenti) | leggibile · L1: GAP-3 |
| Throat thickness (mm) | — | §8.3.2.2 (Tab. 8, solo L2) | `throat_test_mm` (esistente) | leggibile |
| Single layer/multi-run | — | §8.4.3 (frase «when impact or hardness requirements apply, it is not permitted to change a multi-run deposit into a single run deposit … or vice versa») | `single_multi_run` (esistente) | leggibile |
| Outside pipe diameter (mm) | — | §8.3.3 (L1: non variabile essenziale; L2: Tab. 9); 15609-1 §4.3.2 | range `diameter_min/max` (esistenti); `diameter_test_mm` (proposto, gruppo A) | leggibile |
| Filler material designation | — | §8.4.4; 15609-1 §4.4.8 | `filler_material` (esistente) | leggibile |
| Filler material make | — | §8.4.4 (restrizioni per produttore/nome commerciale; attribuzione L1/L2 non verificata riga per riga); 15609-1 §4.4.8 («make») | `filler_make` (proposto, gruppo A) | leggibile |
| Filler material size | — | §8.4.5 (rimanda a §8.4.7); 15609-1 §4.4.8 («Dimensions (size)») | `filler_size` testo (proposto, informativo); misura per passata `filler_diameter_mm` (proposto) | leggibile |
| Designation of shielding gas/flux | — | §8.5.1 (flusso, processo 12), §8.5.2.1 (13), §8.5.3.1 (14), §8.5.4 (15); 15609-1 §4.4.16 | `shielding_gas` (esistente) | leggibile |
| Designation of backing gas | — | §8.5.6; 15609-1 §4.4.7 | `backing_gas` (proposto, gruppo A) | leggibile |
| Type of welding current and polarity | — | §8.4.6; 15609-1 §4.4.9 | `current_type` (esistente) | leggibile |
| Transfer mode | — | §8.5.2.3 (processo 13; dopo A1 le sotto-clausole 8.5.2.3.1–.4 sono eliminate); 15609-1 §4.5.3 | `metal_transfer` (esistente) | leggibile |
| Heat input | — | §8.4.7 («The kind of calculation, either heat input or arc energy, shall be documented»); 15609-1 §4.4.17 («if specified») | `heat_input_note` (esistente); `heat_input_kind`, `heat_input_range_*`, `heat_input_tol_*` (proposti) | «kind documentato» leggibile · limiti per livello: **GAP-1** |
| Welding positions | — | §8.4.2; 15609-1 §4.4.3 | `welding_positions` (esistente) | leggibile |
| Preheat temperature | — | §8.4.8; 15609-1 §4.4.11 | `preheat_temp` (esistente) | leggibile |
| Interpass temperature | — | §8.4.9; 15609-1 §4.4.12 | `interpass_temp` (esistente) | leggibile |
| Post-heating | — | §8.4.10; 15609-1 §4.4.14 | `post_heating` (proposto) | leggibile |
| Post-weld heat-treatment | — | §8.4.11; 15609-1 §4.4.15 | `pwht` (esistente, flag); `pwht_details` (proposto) | leggibile |
| Other information (see also 8.5) | — | §8.5.x | `other_test_info` (proposto, gruppo B) | leggibile |
| Location · Date of issue · Examiner (nome, data, firma) | — | §9 («signed and dated by the examiner») | `issue_date` (esistente); la firma non è un dato | leggibile |

**Pag. 2 — «Record of weld test»** (Markdown «Pagina» 49)

*Testata*

| Riga del modulo | `*` | Clausola | Campo | Stato fonte |
|-----------------|-----|----------|-------|-------------|
| Location · Manufacturer · Manufacturer's WPQR no. · Examiner or examining body | — | solo modulo | come pag. 1 | leggibile |
| Manufacturer's pWPS no. | — | 15609-1 §4.2 (identificazione WPS) | `wps_ref` (esistente); nessun `pwps_ref` (piano § 2.2) | leggibile |
| Method of preparation and cleaning | — | 15609-1 §4.4.4 | `joint_preparation`, `cleaning_method` (proposti, gruppo B) | leggibile |
| Parent material specification | — | 15609-1 §4.3.1 | `base_material_spec` (esistente) | leggibile |
| Material thickness (mm) | — | §8.3.2; 15609-1 §4.3.2 | `thickness_tested` (esistente); `thickness_t2_test_mm` (proposto) | leggibile |
| Welder's/operator's name | — | solo modulo | `welder_name` (esistente) | leggibile |
| Outside pipe diameter (mm) | — | §8.3.3 | `diameter_test_mm` (proposto) | leggibile |
| Joint type and weld | — | §8.4.3 | `joint_type` (esistente) | leggibile |
| Welding position | — | §8.4.2 | `welding_position_test` (proposto) | leggibile |
| Weld preparation details (sketch) · Joint design · Welding sequences | `*` (solo lo schizzo) | 15609-1 §4.4.2 | nessuno (grafico, non dato strutturato) | leggibile |

*Tabella «Welding details» — una riga per passata* (nessuna unità di misura è stampata nel modulo per **Wire feed speed**, **Travel speed**, **Heat input**; per la corrente e la tensione sono stampati solo «A» e «V»)

| Colonna del modulo | `*` | Clausola | Campo (`wpqr_test_runs`, proposto) | Stato fonte |
|--------------------|-----|----------|------------------------------------|-------------|
| Run | — | nessuna (etichetta libera; il modulo non definisce la numerazione) | `run_label`, `run_no` | leggibile |
| Welding process | — | §8.4.1; 15609-1 §4.4.1 | `welding_process` | leggibile |
| Size of filler material | — | §8.4.5; 15609-1 §4.4.8 | `filler_diameter_mm` | leggibile |
| Current A | — | 15609-1 §4.4.9 («Current range») | `current_a` | leggibile |
| Voltage V | — | 15609-1 §4.4.9 («Voltage range (if applicable)»), §4.5.2–4.5.3 («Arc voltage range») | `voltage_v` | leggibile |
| Type of current/polarity | — | §8.4.6; 15609-1 §4.4.9 | `current_polarity` | leggibile |
| Wire feed speed | — (senza `*`) | 15609-1 §4.4.9 («for mechanized and automatic welding»), §4.4.10 | `wire_feed_speed` + `wire_feed_unit` | leggibile (richiesta solo per saldatura meccanizzata/automatica) |
| Travel speed | `*` | 15609-1 §4.4.10 («Travel speed range»); §4.5.1 (111: «run-out length … or travel speed») | `travel_speed` + `travel_speed_unit` | leggibile |
| Heat input | `*` | §8.4.7; 15609-1 §4.4.17 | `heat_input_value` + `heat_input_unit` | leggibile · ricalcolo V·A/v: ISO/TR 18491 mancante (backlog) |
| Metal transfer | — | §8.5.2.3; 15609-1 §4.5.3 («Mode of metal transfer») | `metal_transfer` (per riga solo se dichiarato; fonte primaria la testata) | leggibile |

*Righe sotto la tabella*

| Riga del modulo | `*` | Clausola | Campo | Stato fonte |
|-----------------|-----|----------|-------|-------------|
| Filler material designation and make | — | §8.4.4; 15609-1 §4.4.8 | `filler_material`, `filler_make` (a livello WPQR; per riga solo se il layout lo richiede) | leggibile |
| **Other information\*, e.g.**: baking/drying · weaving (max width) · gas/flux shielding e backing · oscillation (ampiezza, frequenza, sosta) · pulse welding details · gas flow rate (shielding, backing) · distance contact tube/workpiece · plasma welding details · tungsten electrode type/size · torch angle · back gouging/backing | `*` | 15609-1 §4.4.4–4.4.7, §4.4.9, §4.5.2–4.5.5 (via §9) | gruppo B del piano (vedi § 6) e `other_test_info` | leggibile |
| Preheat temperature · Interpass temperature | — | §8.4.8, §8.4.9 | `preheat_temp_test`, `interpass_temp_test` (proposti; D4 = Sì) | leggibile |
| Post-heating | — | §8.4.10 | `post_heating` | leggibile |
| Post-weld heat treatment (PWHT): time, temperature, method; heating and cooling rates | `*` (solo le velocità di riscaldo/raffreddamento) | §8.4.11; 15609-1 §4.4.15 | `pwht_details` | leggibile |
| Firme (Manufacturer / Examiner or examining body: nome, data, firma) | — | §9 | non è un dato | leggibile |

**Pag. 3 — «Test results»** (Markdown «Pagina» 50–51)

| Riga del modulo | `*` | Clausola | Campo | Stato fonte |
|-----------------|-----|----------|-------|-------------|
| Visual | — | §7.1 (Tab. 1 e Tab. 2: 100 %), §7.3 | `vt_result` (esistente) | leggibile |
| Penetrant/magnetic particle testing | `*` | §7.1 Tab. 2 (L2: «Surface crack detection», nota b: PT o MT; solo PT su materiali non magnetici) | `pt_result`, `mt_result` (esistenti, **separati**; il modulo ha **una sola riga** per PT/MT) | leggibile · obbligatorietà: **GAP-2** (nota) |
| Radiographic testing | `*` | §7.1 Tab. 2 (L2: RT **o** UT; note a, g) | `rt_result` (esistente) | leggibile |
| Ultrasonic testing | `*` | §7.1 Tab. 2 (idem) | `ut_result` (esistente) | leggibile |
| Tensile tests (Type/no., Re, Rm, A %, Z %, fracture location, requirement) | — | §7.4.1; Tab. 1/2 | `tensile_result` (esistente); valori numerici **non** archiviati (D5 del piano) | leggibile |
| Bend tests (type/no., former diameter, bend angle, elongation\*, results) | `*` (solo elongation) | §7.4.2; Tab. 1/2 | `bend_result` (esistente) | leggibile |
| Macroscopic examination (foto) | — | §7.4.3; Tab. 1/2 | `macro_result` (esistente) | leggibile |
| Impact test (type, size, requirement, valori 1–3, media, entaglio/direzione, temperatura) | `*` | §7.4.4; Tab. 2 (L2: due serie; note d, e) | `impact_result` (esistente) | leggibile · note d/e/f: **GAP-2** |
| Hardness test (type/load, schizzo, parent metal / HAZ / weld metal) | `*` | §7.4.5; Tab. 2 (L2: «required»; nota e); Tab. 3 (limiti HV 10) | `hardness_result` (esistente) | leggibile · note di Tab. 3: **GAP-2** |
| Other tests · Remarks · Tests carried out in accordance with … · Laboratory report reference no. · **Test results were acceptable/not acceptable** · Test carried out in the presence of | `*` (a livello di pagina) | §9 (qualified solo se nessun esito inaccettabile) | `notes`; l'esito complessivo è letto da `*_result` | leggibile |

Livelli di prova (leggibile in §7.1): **Level 1** → Tab. 1 (visual, trazione trasversale, piega; macro per i giunti d'angolo); **Level 2** → Tab. 2 (aggiunge NDT, resilienza, durezza, macro). Se resilienza, durezza o NDT sono richieste da una norma applicativa, si eseguono e valutano secondo Level 2 «unless otherwise specified».

---

## 3. ISO 15614-2:2025 — Annex A (`NORMA_00031`)

Stessa struttura di Annex B con le differenze lette sotto. Markdown «Pagina» 37 (pag. 1), 38 (pag. 2), 39–40 (pag. 3).

**Pag. 1** — il modulo elenca le righe **una sola volta** sotto «Range of qualification»; la colonna «Test piece» non è leggibile nel Markdown (GAP-5).

| Riga del modulo | Clausola | Campo | Stato fonte |
|-----------------|----------|-------|-------------|
| Manufacturer's WPQR No. · Examiner · Manufacturer · Reference No. · Address · Code or testing standard · Date of welding | solo modulo | come Annex B | leggibile |
| Welding process(es) | §8.4.1 | `welding_process` | leggibile |
| Type of joint and weld | §8.4.3 (Tab. 8) | `joint_type` | leggibile |
| Parent material group(s) and sub-group(s) | §8.3.1 | `base_material_group` | leggibile |
| Parent material thickness (mm) | §8.3.2.2 (butt), §8.3.2.3 (fillet) | `thickness_tested`, `thickness_min/max` | leggibile |
| Throat thickness (mm) | §8.3.2.3 | `throat_test_mm` | leggibile |
| Single run/multi run | §8.4.3 («not permitted to change a multi-run deposit into a single run … or vice versa for a given welding process») | `single_multi_run` | leggibile |
| Outside pipe diameter (mm) | §8.3.2.4 | `diameter_test_mm`, range `diameter_min/max` | leggibile |
| **Filler metal type** | §8.4.4 (gruppi ISO 18273) | `filler_material` | leggibile · **nessuna** riga per make/size su pag. 1 |
| Designation of shielding gas · of backing gas | §8.5.1.1 (131), §8.5.2 (141/142), §8.5.3.2 (15) | `shielding_gas`, `backing_gas` | leggibile |
| Type of welding current and polarity | §8.4.5 | `current_type` | leggibile |
| Heat input | §8.4.6 (limite superiore dell'apporto termico, con eccezione per il gruppo 23; arc energy secondo ISO 18491) | `heat_input_*` | leggibile · ricalcolo: fonte mancante |
| Welding positions | §8.4.2 | `welding_positions` | leggibile |
| Preheat temperature | §8.4.7 | `preheat_temp` | leggibile |
| Interpass temperature | §8.4.8 | `interpass_temp` | leggibile |
| Post-weld heat treatment and/or ageing | §8.4.9 | `pwht`, `pwht_details` | leggibile |
| Other information | §8.5.x | `other_test_info` | leggibile |

Nessuna riga per **Level**, **Deposited metal thickness**, **Transfer mode**, **Post-heating** (coerente con l'assenza delle relative clausole in 15614-2).

**Pag. 2** — come Annex B con queste differenze verificate:

- testata: «Welder's name» (non «operator»); «Welding process» e «Welding position» sono in testata;
- tabella passate: Run · Welding process · Size of filler metal · Current A · Voltage V · Type of current/polarity · Wire feed speed · Travel speed\* · Heat input con **nota 3 «If required»**; **nessuna colonna «Metal transfer»**. L'asterisco di «Travel speed\*» e di «Weld preparation details (sketch)\*» non ha la legenda «\*If required» nel Markdown (GAP-5);
- «Filler metal designation» (senza «make»);
- «Other information e.g.»: baking/drying, weaving, oscillation, gas shielding/backing, contact tube to workpiece distance, gas flow rate, plasma welding details, tungsten electrode type/size, torch angle, back gouging/backing. **Manca «Pulse welding details»**;
- «Preheat temperature», «Interpass temperature» e «Post-weld heat treatment and/or ageing (time, temperature, method, heating and cooling rates)» (senza `*` sulle velocità).

**Pag. 3** — struttura diversa da Annex B:

| Blocco del modulo | Contenuto letto | Clausola | Campo |
|-------------------|-----------------|----------|-------|
| Non-destructive testing | Visual, Penetrant, Radiographic, Ultrasonic, Time of flight diffraction, Phased array ultrasonic: Acceptable / Unacceptable / Report No. | clausola 7 (richiamata da §9) | `vt_result`, `pt_result`, `rt_result`, `ut_result` (esistenti); TOFD e phased array **senza colonna** |
| Metallographic examinations | Macro (Acceptable / Unacceptable / Report No.) | idem | `macro_result` |
| Destructive tests | Tensile (Required Yes/No; Type/No.; Re; Rm; A; Z; frattura; temperatura di prova; requirement); Bend (Required Yes/No; Type/No.; lato; diametro del mandrino; esito) | idem | `tensile_result`, `bend_result` |
| Fracture tests · Other tests (nota 4 «if required») | Required Yes/No; denominazione; tipo e dimensione delle imperfezioni; livello di qualità | idem | nessuno (`notes`) |
| Chiusura | Remarks; norma di prova; Laboratory report reference No.; acceptable/unacceptable; presenza | §9 | `notes` |

Nessuna riga per **resilienza** né **durezza** nell'Annex A (le colonne `impact_result`/`hardness_result` non hanno corrispondente in questo modulo).

---

## 4. ISO 14555:2025 — Annex C (`NORMA_00033`)

Annex C contiene **due moduli**: il modulo **WPS** («Manufacturer's welding procedure specification», Markdown «Pagina» 37) e il modulo **WPQR** («Welding procedure qualification record form», «Pagina» 38–41). Qui solo il WPQR. **Nessuna tabella per passata**: i parametri di prova stanno in **due tabelle** (una riga ciascuna per prova).

**Pag. 1 — testata e condizioni** (Markdown «Pagina» 38)

| Riga del modulo | Clausola | Campo | Stato fonte |
|-----------------|----------|-------|-------------|
| Manufacturer · Examiner or examining body · Address · Code/testing standard | solo modulo | come Annex B | leggibile |
| Date of welding | solo modulo | `test_date` | leggibile |
| Manufacturer's welding procedure Reference No. | §9.2.2–9.2.3 | `wps_ref` | leggibile |
| Name of operator | solo modulo | `welder_name` | leggibile |
| Extent of qualification | §10.2.8.x | testo libero; i range sono nelle colonne esistenti (§10.2.8.4–10.2.8.9) | leggibile |
| Stud-welding process | §9.4 (ISO 4063) | `welding_process` | leggibile |
| Stud diameter (mm) · Stud length (mm) · Stud material · Stud designation | §9.6.1; §10.2.8.8 (sezione di saldatura) | campi stud di mig. 159 (`qualifying_element`, …); **nessuna colonna di testata prevista dal piano § 2.2** per diametro/lunghezza stud: da decidere in WV-4 | leggibile (lunghezza: solo modulo) |
| Parent material | §9.3.1; §10.2.8.4–10.2.8.5 | `base_material_group`, `base_material_spec`, `base_material_group_2` | leggibile |
| Parent material thickness (mm) | §9.3.2; §10.2.8.6 | `thickness_tested` | leggibile |
| **Application > 100 … / ≤ 100 …** | §10.2.8.5, §10.2.8.9 (tempo di saldatura «beyond 100 ms» / «100 ms and below») | campo da definire (WV-4) | **GAP-4** (unità) |
| Kind of weld pool protection | §9.10 h; §10.2.8.12 | campo stud / `notes` | leggibile |
| Use of damper (yes/no) | §9.10 f; §9.9.1 | idem | leggibile |
| Ceramic ferrule designation | §9.7.1 | idem | leggibile |
| Shielding gas designation · Flow rate | §9.7.2; §9.9.2 | `shielding_gas` (esistente); portata: gruppo B | leggibile |
| Welding position | §9.5.2; §10.2.8.9 | `welding_positions` | leggibile |
| Power source · Welding gun/head | §9.8; §9.9.1; §10.2.8.10 | testo / `notes` | leggibile |
| Preheat temperature (°C) | §9.11 a; §10.2.8.11 | `preheat_temp` | leggibile |
| Other information · Certified … · Location · Date of issue · Examiner | §10.4 (firma e data) | `issue_date` | leggibile |

**Tabella 1 — parametri di saldatura** (una riga per prova)

| Colonna del modulo (unità stampata) | Clausola | Campo (`wpqr_test_runs`, proposto) | Stato fonte |
|-------------------------------------|----------|-------------------------------------|-------------|
| Welding current (A) | §9.10 b | `current_a` | leggibile |
| Welding time (ms) | §9.10 c | `weld_time_ms` | leggibile |
| Protrusion (mm) | §9.10 e | `protrusion_mm` | leggibile |
| Lift (mm) | §9.10 d | `lift_mm` | leggibile |
| Remarks | — | `remarks` | leggibile |

**Tabella 2 — scarica capacitiva** (una riga per prova)

| Colonna del modulo (unità stampata) | Clausola | Campo (proposto) | Stato fonte |
|-------------------------------------|----------|------------------|-------------|
| Gap or lift (mm) | §9.10 d, k («spring force and/or gap length») | `gap_lift_mm` | leggibile |
| Charging voltage (V) | §9.10 j | `charging_voltage_v` | leggibile |
| Capacitance (mF) | §9.10 i | `capacitance_mf` | leggibile |
| **Spring force / impact speed (N) or (mm/s)** | §9.10 k | `spring_force_n` (proposto: solo newton) | **GAP-4b**: la colonna ammette **N oppure mm/s** |
| Remarks | — | `remarks` | leggibile |

**Esiti** (Markdown «Pagina» 39–41): 1) visual; 2) bend (≤ 100 …: piega con angolo; > 100 …: momento flettente con chiave dinamometrica, Nm); 3) trazione (solo ≤ 100 …); 4) radiografia (solo ≤ 100 …, d > 12 mm); 5) macro; 6) prove aggiuntive; riferimento rapporto di laboratorio; acceptable/not acceptable. Scope e criteri: §10.2.5 e clausola 11 (non riletta qui nel dettaglio: non serve alle righe del modulo). Per la qualifica «through-deck» in sito (§10.2.9) i parametri si registrano nella WPQR (Annex C) **oppure** nel rapporto di Annex D (non è un modulo WPQR).

**Elementi della WPS (Clausola 9) richiesti via §10.4 senza riga dedicata in Annex C WPQR** (finiscono in «Other information» o non sono registrati): polarità (§9.10 a), numero e posizione dei morsetti di massa (§9.10 g), configurazione del cavo di saldatura (§9.10 l), mezzo bagnante (§9.10 m), dispositivi magnetici (§9.10 n), preparazione superficie del materiale base (§9.5.3; è nel modulo WPS, non nel WPQR), movimentazione/pulizia degli stud (§9.6.2), supporto (§9.5.5), temperatura ambiente minima se non c'è preriscaldo (§9.11 b), trattamento termico post-saldatura (§9.12), trattamenti non termici (§9.13).

---

## 5. ISO 15613:2025 — rinvio (`NORMA_00045`)

- §10: la WPQR contiene gli elementi delle WPS di **Tabella 1** (15609-1…-6) e «A WPQR form shall be used». **Il testo non fornisce un modulo di esempio**: le righe del modulo si prendono dall'Annex della parte 15614 corrispondente alla Tabella 2 (§ 2 e § 3 di questo file).
- §8: «Any qualification issued under this document shall be limited to the type of joint used in the pre-production test»; il range segue «as far as technically possible» la parte 15614 di Tabella 2; per lo spessore si applica a **ciascun componente** del giunto e allo spessore di saldatura; per la saldatura a resistenza il range è limitato al provino. **Nessuna soglia propria.**
- **La Tabella 2 non contiene ISO 14555**: per gli stud il rinvio a 15613 non è definito dal testo (resta nel solo perimetro di 14555 §10.2.9). Dettaglio operativo: [`ISO-15613-qualifica-pre-produzione.md`](ISO-15613-qualifica-pre-produzione.md).

---

## 6. Elementi di ISO 15609-1 richiesti via §9 e posizione nel modulo (`NORMA_00014`)

«Riga» = riga/colonna dedicata; «Other\*» = compare solo come esempio nel blocco opzionale «Other information\*, e.g.:» di Annex B (15614-2: «Other information e.g.»); «assente» = nessuna menzione nel modulo.

| 15609-1 | Elemento | 15614-1 Annex B | 15614-2 Annex A | Campo previsto (piano § 2.2) |
|---------|----------|-----------------|-----------------|------------------------------|
| §4.4.4 | Preparazione/pulizia; attrezzature di bloccaggio e puntatura | riga «Method of preparation and cleaning»; attrezzature: assente | idem | `joint_preparation`, `cleaning_method` |
| §4.4.5 | Oscillazione (larghezza max; ampiezza, frequenza, sosta); angolo torcia/filo | Other\* | Other | `torch_angle_deg`; oscillazione in `other_test_info` |
| §4.4.6–4.4.7 | Ripresa al rovescio; supporto | Other\* («Details of back gouging/backing»); «Designation of backing gas» | idem | `backing_gas` |
| §4.4.8 | Designazione, make, dimensioni; trattamento (essiccazione) | righe designazione/make/size; essiccazione: Other\* | «Filler metal type»; passata «Size of filler metal»; make: assente su pag. 1 | `filler_*` |
| §4.4.9 | Tipo e polarità; **dettagli di pulsazione**; intervallo di corrente; di tensione; velocità filo (meccanizzata/automatica) | righe + colonne della tabella; pulsazione: Other\* | colonne; pulsazione: **assente** | `wpqr_test_runs.*` |
| §4.4.10 | Velocità di avanzamento; velocità filo/nastro | colonne | colonne | idem |
| §4.4.11–4.4.12 | Preriscaldo (e, senza preriscaldo, temperatura minima del pezzo — §4.4.11.2: **assente**); interpass | righe | righe | `preheat_temp_test`, `interpass_temp_test` |
| §4.4.13 | Temperatura di mantenimento del preriscaldo | **assente** | **assente** | nessuno |
| §4.4.14–4.4.15 | Post-heating (intervallo di temperatura, tempo minimo); PWHT (tempo, temperatura) | righe | solo PWHT/ageing | `post_heating`, `pwht_details` |
| §4.4.16 | Gas di protezione (designazione ISO 14175; composizione, produttore, nome commerciale) | riga designazione; produttore/nome: assente | idem | `shielding_gas` |
| §4.4.17 | Intervallo di apporto termico «(if specified)» | riga + colonna | riga + colonna | `heat_input_*` |
| §4.5.1 | Processo 111: lunghezza consumata dell'elettrodo **o** velocità di avanzamento | colonna «Travel speed\*»; lunghezza consumata: assente | colonna | `travel_speed` |
| §4.5.2 | Processo 12: n. e configurazione fili e polarità; **distanza tubo di contatto/pezzo**; flusso; filler addizionale; tensione d'arco | distanza: Other\*; flusso: «shielding gas/flux»; n. fili e filler addizionale: assente | distanza: Other | `contact_tube_distance_mm_*` |
| §4.5.3 | Processo 13: **portata gas e diametro ugello**; n. fili; filler addizionale; **distanza punta di contatto/pezzo**; tensione; modo di trasferimento | portata e distanza: Other\*; **diametro ugello: assente**; n. fili: assente; trasferimento: riga | portata e distanza: Other; **ugello: assente**; trasferimento: assente | `shielding_gas_flow_*`, `nozzle_diameter_mm`, `contact_tube_distance_mm_*` |
| §4.5.4 | Processo 14: **tungsteno** (diametro e codifica ISO 6848); **portata gas e diametro ugello**; filler addizionale | tungsteno e portata: Other\*; ugello: assente | idem | `tungsten_electrode`, `shielding_gas_flow_*`, `nozzle_diameter_mm` |
| §4.5.5 | Processo 15: gas di plasma; portata gas di protezione e **diametro ugello**; tipo di torcia; distanza ugello/pezzo | «Plasma welding details» e portata: Other\*; ugello e tipo di torcia: assente | idem | `other_test_info` |

Quindi, per i quattro elementi che il piano chiama «via §9 ma non in Annex B»: **portata gas**, **distanza tubo di contatto** e **tungsteno** compaiono come esempio nel blocco opzionale «Other information» (non come righe dedicate); il **diametro dell'ugello non compare affatto** né in Annex B né in Annex A. Il riferimento di clausola preciso è §4.5.3 (13), §4.5.4 (14), §4.5.5 (15) per portata e ugello; §4.5.2, §4.5.3, §4.5.5 per la distanza; §4.5.4 per il tungsteno. Il §4.5.2 riguarda il **processo 12 (arco sommerso)** e non richiede portata gas né ugello.

### Cosa non è nel modulo

- Nessun valore numerico di prova si ricava da Annex B/A/C **tranne** quelli delle tabelle di pag. 2 (passate, o i due blocchi di parametri per gli stud), i valori di pag. 1 (spessori, diametro, temperature) e gli esiti di pag. 3 (Re, Rm, A %, Z %, valori di resilienza, durezza: **non** archiviati, D5 del piano).
- Il modulo **non stampa le unità** di Wire feed speed, Travel speed e Heat input (15614-1 e 15614-2): l'unità va letta/registrata insieme al valore.
- Il modulo **non ha colonne** per rendimento dell'arco, lunghezza del cordone depositato, lunghezza usata dell'elettrodo, lunghezza consumata (§4.5.1), n. di fili/elettrodi (§4.5.2–4.5.3), tipo di torcia (§4.5.5).
- **Effetti sul range senza riga dedicata nel modulo**: grado di meccanizzazione (§8.4.1, Level 2: ogni grado è qualificato separatamente), angolo della derivazione (§8.3.4, Level 2), sistema a filo singolo/multiplo (§8.5.2.2, Level 2). Compaiono, se compaiono, nel testo libero.
- Il modulo 15614-1 ha **una sola riga PT/MT**, mentre il DB ha `pt_result` e `mt_result`.

---

## 7. Ambiguità di lettura e GAP (non risolti)

Nessuno di questi punti è risolto qui: si rimanda alle richieste HITL del piano § 4.1 (2 di 4, 3 di 4, 4 di 4) e a [`NORME_MANCANTI_BACKLOG.md`](NORME_MANCANTI_BACKLOG.md).

| ID | Punto | Perché è un GAP | Rimando |
|----|-------|-----------------|---------|
| **GAP-1** | 15614-1 **§8.4.7**: limite superiore (resilienza) e inferiore (durezza) dell'apporto termico per Level 1 / Level 2 | Le colonne L1/L2 sono intercalate: nel testo si leggono «maximum heat input used», «25 % greater» e «25 % lower», ma **l'attribuzione ai livelli e la frase sul limite inferiore non sono determinabili**. È leggibile e non ambiguo solo: «kind of calculation … shall be documented»; la sostituzione heat input ↔ arc energy; il riferimento a ISO/TR 18491 e al k-factor ISO/TR 17671-1 | HITL 2 di 4 |
| **GAP-2** | 15614-1 **Tab. 3** (limiti di durezza HV 10) e **note d/e/f di Tab. 2** | I valori per gruppo sono leggibili ma le **note a/b/c** sono staccate dai relativi gruppi/colonne; la condizione che rende resilienza e durezza **obbligatorie** dipende da note e da norme applicative. Per questo il modulo non permette di dedurre «`result` ≠ `NA` obbligatorio» (anche perché le righe PT/MT, RT, UT sono marcate `*` pur essendo al 100 % in Tab. 2 L2) | HITL 3 di 4 |
| **GAP-3** | 15614-1 **Tab. 7, colonna Level 1** (t > 3 mm) | La cifra iniziale è troncata in 5 righe su 7 (es. «5 to 2 t» per t > 12 mm) e per 3 < t ≤ 12 è incerta (stato già dichiarato nel file di range). Le cifre **non sono riportate in questo file**; Level 2 fino a 40 mm è leggibile | HITL 3 di 4; [`ISO-15614-1-range-validita-WPQR.md`](ISO-15614-1-range-validita-WPQR.md) |
| **GAP-4** | 14555 Annex C: etichetta «**Application > 100 °C / ≤ 100 °C**» (e «application ≤ 100 °C» nelle prove) | Nel testo normativo letto la discriminante dell'applicazione è il **tempo di saldatura 100 ms** (§10.2.8.5, §10.2.8.9); il modulo stampa «°C». Non si decide quale sia l'unità corretta | HITL (conferma sulla pagina del PDF; nuova riga di backlog) |
| **GAP-4b** | 14555 Annex C, Tabella 2: colonna «Spring force / impact speed (N) or (mm/s)» | Una sola colonna accetta **due grandezze con unità diverse**: il campo `spring_force_n` (solo N) del piano non le rappresenta entrambe. Non si converte né si sceglie | Osservazione per WV-3/WV-4 (nessuna richiesta di norma: il testo è leggibile) |
| **GAP-5** | 15614-2 Annex A: legenda `*` di «Travel speed\*» e di «Weld preparation details (sketch)\*»; colonna «Test piece» di pag. 1; riga «Micro» dei test metallografici | La legenda «\*If required» non compare nel Markdown (compare solo la nota 3 sul «Heat input» e la nota 4 su «Other tests»); la pag. 1 mostra le righe una volta sola; il testo intercalato «Destructive tests» fa sospettare una riga «Micro» che la tabella non riporta | HITL (foto/PDF delle pagine del modulo; nuova riga di backlog) |
| **GAP-6** | 15614-1 §9 e indice: formulazione per livello | §9 contiene due frasi intercalate («For level 1 … record details and level …» / «For level 2 … record details, range of qualification and level …»): la lettura più naturale è che il **range di qualifica** sia registrato nel modulo per Level 2, ma non è verificabile; stesso problema per il marcatore «(normative)/(informative)» dell'Annex B nell'indice | HITL 2 di 4 (stessa pagina da confermare) |
| **GAP-7** | ISO/TR 18491 (energia d'arco), ISO/TR 17671-1 (k-factor) e, citate come riferimenti informativi, ISO/TR 17671-2 (15614-1 §8.4.8) e ISO/TR 17671-4 (15614-2 §8.4.7) | Testi non digitalizzati: nessun ricalcolo di V·A/v né verifica della riduzione di preriscaldo «fulfilled». In 15614-2:2025 §8.4.6 il riferimento è «ISO 18491» con nota «Under preparation … ISO/DIS 18491:2025» | HITL 4 di 4 (condizionata); riga backlog |
| **GAP-8** | Edizioni legacy 15614-1:2004+A2:2012 e 15614-2:2005 | Fonte assente | Backlog (`parcheggio`) |

---

## 8. Cosa **non** si fa con questo estratto

- Nessuna soglia di range (±25 %, −50 °C/+50 °C, limiti di Tab. 7/8/9) è definita qui: le regole già codificate sono in `weldingQualificationRules15614*.js` e negli estratti di range.
- Non si decide l'obbligatorietà di resilienza/durezza/NDT, né l'attribuzione L1/L2 di §8.4.7 (GAP-1…3).
- Non si rinomina o riscrive il piano: le differenze tra piano e testo sono nel body della PR (slice WV-2) e nel § 6 di questo file.
