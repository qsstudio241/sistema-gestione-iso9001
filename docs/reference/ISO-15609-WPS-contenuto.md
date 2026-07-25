# ISO 15609-1/-2:2019 — Contenuto WPS (riferimento operativo SGQ)

> **Uso**: ingest WPS, revisione campi AI, allineamento schema `documentTypeSchemas` tipo `wps`, supporto ISO 3834-5 (riferimenti WPS arco/gas).  
> **Fonte**: estratto operativo da BS EN ISO 15609-1:2019 e BS EN ISO 15609-2:2019 (requisiti di contenuto pWPS/WPS). Testo digitalizzato in `docs/Normative/Normative NORMA_00014_ UNI EN ISO 15609-1_2019 Rev. 0.md` e `…00015…15609-2…`.  
> **Catalogo JS**: non previsto (non è un elenco di simboli discreti come 14175/4063; è una checklist di variabili).  
> **Piano slice**: RC-10 in `docs/agent-tasks/PLAN_INGEST_REFERENCE_CATALOGS.md`.

## Scopo

Definire **quali informazioni** devono comparire in una Welding Procedure Specification (e nella pWPS) per:

| Parte | Processo | Processo tipico ISO 4063 |
|-------|----------|---------------------------|
| **15609-1** | Saldatura **ad arco** | 111, 12x, 13x, 14x, 15 |
| **15609-2** | Saldatura **a gas** (oxy-fuel) | 311 (e affini gas) |

Non sostituisce ISO 15614 (qualifica procedura / WPQR) né ISO 15607 (regole generali): fissa il **contenuto minimo/raccomandato** della WPS. Range e tolleranze seguono lo standard di qualifica applicabile e l'esperienza del produttore.

**Rapporto con ISO 3834**: la serie 3834 (in particolare 3834-5) richiama ISO 15609-* come norma di specifica WPS per i vari processi.

## Regole per l'estrazione AI (WPS)

| Campo ingest | Regola (da 15609) |
|--------------|-------------------|
| `wps_number` | Identificazione WPS (§4.2) |
| `wpqr_ref` | Riferimento WPQR / documenti di qualifica (§4.2, vedi ISO 15607) |
| `welding_process` | Codice ISO **4063** (§4.4.1) — es. `141`, `135`, `111`, `311` |
| `base_material` | Designazione materiale + norma di riferimento (§4.3.1) |
| `material_group` | Gruppo ISO/TR **15608** (o 20172/20173/20174 se assegnato; fallback 15608) |
| `thickness_min_mm` / `thickness_max_mm` | Range spessore materiali (§4.3.2) |
| `pipe_outside_diameter_mm` | Range diametro esterno tubi se applicabile (§4.3.2) — stringa o numero; `null` se solo piastra |
| `joint_type` | Tipo giunto da sketch/testo (BW/FW o descrizione); sketch non estraibile → descrizione testuale |
| `welding_positions` | Posizioni ISO **6947** (§4.4.3), array se multiple |
| `filler_material` | Designazione consumabile + dimensioni (§4.4.8) |
| `shielding_gas` | Solo **15609-1**: designazione ISO **14175** (§4.4.16); `null` se processo senza gas o WPS gas (15609-2) |
| `preheat_temp` | Tp — temperatura preriscaldo; misura secondo ISO **13916** (§4.4.11) |
| `interpass_temp` | Ti — interpass max (e min se necessario); ISO **13916** (§4.4.12) |
| `heat_input` | Solo arco se specificato: range heat input / arc energy (ISO/TR 18491) (§4.4.17 15609-1) |
| `current_range` / `voltage_range` | Solo arco (§4.4.9 15609-1) |
| `flame_type` / `fuel_gas` | Solo gas (§4.4.9 15609-2): tipo fiamma, fuel gas, pressioni O₂ |

**Preferenza**: normalizzare processi/posizioni/gas con i cataloghi già in repo (RC-1/RC-2/RC-3). Non inventare range numerici assenti dal PDF.

## Parte 1 — ISO 15609-1 (arco): checklist variabili

### Identificazione e materiale

- Produttore, ID WPS, riferimento WPQR
- Materiale base (designazione + gruppo), spessori, OD tubo

### Comuni a tutti i processi arco (§4.4)

- Processo 4063, joint design (+ sequenza passate se essenziale), posizioni 6947
- Preparazione giunto (pulizia, dime, punti)
- Tecnica (weaving, angolo torcia/elettrodo)
- Back gouging / backing (materiale, gas, flux)
- Consumabili (designazione, marca, dimensioni, handling/essiccazione)
- Parametri elettrici (AC/DC, polarità, pulse, range corrente/tensione, wire feed)
- Meccanizzato/automatico: travel speed, wire/strip feed (o machine settings)
- Tp / Ti / Tm (mantenimento preriscaldo) — vedi ISO 13916
- Post-heating idrogeno; PWHT / ageing
- Gas di protezione ISO 14175
- Heat input / arc energy (se richiesto)

### Specifici per gruppo processo (§4.5)

| Processo | Extra tipici |
|----------|----------------|
| 111 MMA | Run-out length / travel speed |
| 12 SAW | Multi-wire, distanza contact tip, flux, filler aggiuntivo, tensione |
| 13 GMAW | Portata gas, ugello, n. fili, metal transfer, distanza contact tip |
| 14 GTAW | Elettrodo W (ISO 6848), portata gas, filler aggiuntivo |
| 15 Plasma | Plasma gas, torch, distanze |

## Parte 2 — ISO 15609-2 (gas): checklist variabili

Stessa struttura identificazione/materiale/posizioni/consumabili/temperature (Tp/Ti/Tm via 13916) e PWHT.

**Differenze vs arco**:

- Nessun gas di protezione 14175 / parametri elettrici / heat input arco
- **Parametri fiamma** (§4.4.9): nozzle size, fuel gas type e pressione, O₂ pressure, tipo di fiamma
- Tecnica: saldatura leftward/rightward; angolo cannello/filo
- Processo tipico: **311** (e varianti gas 4063)

## Annex A (template WPS)

Entrambe le parti forniscono un modulo informativo (Annex A) copiabile. Nell'estrazione PDF le tabelle risultano spesso **fuse/rovinate**: usare le clausole §4 come fonte di verità, non le celle Annex.

## Limiti digitalizzazione (PDF BSI)

- Testo normativo §1–4 generalmente leggibile (pdfplumber)
- TOC e Annex A: layout a colonne/tabelle → testo a tratti interfogliato o celle vuote
- Pagine copyright/disclaimer BSI: rumore, ignorare per ingest
- **Non** committare i PDF originali

## Riferimenti incrociati

| Norma | Ruolo |
|-------|--------|
| ISO 15607 | Regole generali specifica/qualifica procedure |
| ISO 15614-* | Qualifica WPQR (range di validità) |
| ISO 4063 | Codici processo |
| ISO 6947 | Posizioni |
| ISO 14175 | Gas protezione (solo arco) |
| ISO/TR 15608 | Gruppi materiale |
| ISO 13916 | Misura Tp / Ti / Tm |
| ISO 3834-5 | Elenco norme di supporto (cita 15609-1/-2) |
| ISO/TR 18491 | Energie di saldatura (heat input / arc energy) |
