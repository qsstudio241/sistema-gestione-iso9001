# Backlog norme mancanti (piattaforma)

> **Fonte unica** delle lacune documentali da richiedere al committente o da digitalizzare.
> Distinto dal Registro Documenti cliente (`document_registry`): qui si traccia solo ciò che serve agli **agenti di sviluppo** e al seed `norm_requirements` / skill.
>
> Aggiornare dopo ogni `pdf-to-json` o richiesta HITL. Stati: `da_richiedere` | `pdf_ricevuto` | `digitalizzata` | `parcheggio`.

## Come usare

1. Slice **norm-touching** senza Markdown utile → aggiungere/aggiornare riga qui + blocco «Richiesta norma» (vedi `HANDOFF_TEMPLATE.md`).
2. PDF arrivato → `pdf_ricevuto` → skill `pdf-to-json` → `digitalizzata` + seed VPS se è norma SGQ a clausole.
3. Non inventare soglie/clausole per righe ancora `da_richiedere` / `parcheggio`.

## Backlog

| Codice / titolo | Impatto modulo | Stato | Priorità | Note |
|-----------------|----------------|-------|----------|------|
| ISO **14555**:2025 (arc stud welding / prigionieri) | WPQR Stud Welding (Mason) | `digitalizzata` | P0 | `NORMA_00033` MD+JSON (26/08 + HITL Tabella 1/2 29/08). 3° confronto PDF 04/10: stessa edizione, **file in Git non sostituito** (CLI reintrodurrebbe Tabella 1 invertita). PDF **non** in Git. Estratto [`ISO-14555-2025-range-validita-WPQR.md`](ISO-14555-2025-range-validita-WPQR.md). Codice range = STUD-3-B. Confusione ingest 14555↔15614 Level 2 = diagnosi certificati, non lacuna PDF. |
| ISO **4063**:2023 (nomenclature processi) | Ingest WPQR/WPS/qualifiche; catalogo `weldingProcesses4063.js` | `digitalizzata` | P0 | `NORMA_00044` MD+JSON (04/10/2026), schema `generic`. PDF **non** in Git. Famiglia corrente **78**: 783 (drawn arc + ferrule/gas), 784 (short-cycle), 785 (CD drawn arc), 786 (CD tip ignition). **781/787 obsoleti** (Annex B). Estratto [`ISO-4063-processi-saldatura.md`](ISO-4063-processi-saldatura.md). Catalogo JS aggiornato (frequenti + 78x). **Non** seed SGQ. Range stud restano ISO 14555 §10.2.8. |
| ISO **14732**:2013 (testo integrale in `docs/Normative/`) | Qualifiche operatore; **verifica qualifiche vs norma** ([`PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md`](../agent-tasks/PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md), VQ-11 parte B) | `da_richiedere` | P1 | Estratto [`ISO-14732-operatori-saldatura.md`](ISO-14732-operatori-saldatura.md) usabile (OCR 28/28). **Nessun** `NORMA_00xxx` in Git. Non blocca ingest `qualifica_14732`. **Blocca solo la parte B della verifica 14732** (regole `warn` con clausola da testo integrale: intervalli 6 vs 3 anni, variabili essenziali); la parte A parte subito su estratto con severità massima `info`. Richiesta HITL 1 di 6 nel piano § 3.1. |
| Campione **certificati reali anonimizzati** (9606-1 BW/FW, P/T, 311; 14732) | Verifica qualifiche vs norma (misura dei falsi positivi) | `da_richiedere` | P1 | **Non è una norma**: serve come gate per dichiarare «pronta» le PR dei pack normativi (VQ-5/6/10). Richiesta HITL 2 di 6 nel piano § 3.1. |
| **EN 287-1** / ISO 9606-1:2004 (certificati legacy) | Verifica qualifiche vs norma | `da_richiedere` | P2 | **Condizionata**: serve solo se il committente ha patentini rilasciati con le edizioni precedenti (decisione D5 del piano). Finché non risponde: edizione non coperta → `non_verificabile_fonte_mancante` (info). Il testo 9606-1:2017 non è applicabile a certificati 2004/EN 287-1. |
| ISO **9606-1**:2017 Tab. 3/4/5/11/12 (celle «×» da confermare a livello di glifo) + discordanza estratto §5.2 (141/143/145 → 142) | Validità filler/dettagli saldatura; allineamento estratto/prompt | `parcheggio` | P2 | Tab. 6/7/8/9/10 sono ricostruite e usate. Tab. 3/4/5/11/12 non servono alla prima onda (nessun campo strutturato: decisione D7). La discordanza §5.2 sull'estratto è corretta in VQ-3 (solo documentazione) e in VQ-6 (codice/prompt). |
| ISO/TR **15608**:2013 integrale + CR ISO 15608 (gruppi Al 21–26; gruppo 26 mancante) | Verifica 9606-2 (Tab. 2 gruppi di materiale), sottogruppi 9606-1 | `da_richiedere` | P2 | Oggi solo estratto sintetico. Finché manca: gruppi Al → solo `info` nella verifica 9606-2 (VQ-10). Richiesta HITL 5 di 6 nel piano § 3.1. |
| ISO **6947** integrale (posizioni di saldatura) | Verifica posizioni 9606-1/-2 | `parcheggio` | P3 | Solo estratto sintetico; il catalogo `weldingPositions6947.js` basta per la prima onda. Non bloccante. |
| ISO **9606-3/-4/-5** (rame, nichel, titanio) | Verifica qualifiche vs norma | `parcheggio` | P3 | Fuori scope dell'epic; nel registry compaiono come `non_verificabile_fonte_mancante`. Solo su richiesta del committente. |
| Quaderno Linea Guida **1090** | Contesto EN 1090 / carpenteria | `digitalizzata` | P1 | Conforma Quaderno n.2 Rev.0 Set 2015 — `Quaderni/Quaderno_2_Linea_Guida_1090.{md,json,txt}` (26/08/2026); schema `generic`; GAP pag. 3 vuota; PDF **non** in Git |
| ISO **2560**:2020 (elettrodi rivestiti) | Material Compliance apporto | `digitalizzata` | P1 | `NORMA_00035` MD+JSON (26/08/2026); PDF **non** in Git. Estratto soglie 3.1 lotto = slice successiva (non inventare) |
| ISO **17632**:2015 (filo animato) | Material Compliance apporto | `digitalizzata` | P1 | `NORMA_00036` MD+JSON; GAP cid su alcuni simboli fluoride in tabelle — non inventare. Estratto soglie = slice successiva |
| ISO **14174**:2019 (flussi) | Material Compliance apporto | `digitalizzata` | P2 | `NORMA_00037` MD+JSON; estratto soglie = slice successiva |
| ISO **9712**:2021 (testo integrale) | CND / qualifiche NDT (CND-2) | `digitalizzata` | P1 | `NORMA_00034` MD+JSON (26/08/2026); GAP pagine 8/51 vuote. Estratto storico `ISO_9712_2022_NDT_QUALIFICATION.md` resta utile |
| ISO **9712**:2021 Annex A.3 — scope settori industriali (`m` `s` `r` `a`) | Copertura CND (COV-3) | `da_richiedere` | P1 | Il testo (`NORMA_00034`) rimanda allo scope pubblicato dall'ente di certificazione; nessun elenco dei prodotti compresi. **Non** inventare «`s`/`m` coprono `w`»: in COV-3 industriale→prodotto = `partial` finché il committente non fornisce lo scope dell'ente (PDF) o una decisione scritta. Estratto `ISO_9712_2022_NDT_QUALIFICATION.md` §4 = convenzione operativa non verificabile. Compositi 2021 = `cc` `frp` `mmc` `cmc` (app: `p` unico) |
| ISO **9712**:2021 Table 1 — codici metodo | Copertura CND (COV-3), gate CND-2 | `parcheggio` | P2 | Table 1 (righe VT/UT vuote nel MD, GAP) usa `AT` `LT` `ST` `TT`; repo/estratto usano `AE` `TT`(tenuta) `ST`(stress) `LT`. Decisione HITL di allineamento (`ndtInspectorGate` `NDT_METHODS`, estratto, ingest) in slice separata; COV-3 resta sui 6 metodi VT PT MT UT RT ET |
| ISO **19011**:2026 | Audit / metodologia | `digitalizzata` | P2 | `NORMA_00038` MD+JSON (ed. 2026 supersede 2018). PDF **non** in Git |
| ISO **3452-1**:2021 (PT principi) | CND penetranti | `digitalizzata` | P1 | `NORMA_00039`; PDF upload troncato riparato pymupdf; GAP pagina 6 |
| ISO **17638**:2016 (MT saldature) | CND magnetoscopico | `digitalizzata` | P1 | `NORMA_00040` MD+JSON |
| ISO **23278**:2015 (MT acceptance) | CND magnetoscopico | `digitalizzata` | P1 | `NORMA_00041`; PDF upload troncato riparato pymupdf |
| ISO **23277**:2015 (PT acceptance) | CND penetranti | `digitalizzata` | P1 | `NORMA_00042`; GAP pagina 9 vuota |
| ISO **15614-1**:2017+A1:2019 (WPQR acciaio/nichel) | WPQR / range procedura | `digitalizzata` | P0 | `NORMA_00043` MD+JSON (06/09/2026); PDF **non** in Git. Archivio ed. 2017 senza A1 = `NORMA_00019`. Non seed SGQ. Delta A1: eliminate §8.5.2.3.1–.4 (waveform/pulsed). Estratto operativo già in [`ISO-15614-1-range-validita-WPQR.md`](ISO-15614-1-range-validita-WPQR.md) |
| ISO **15613**:2025 (prova di pre-produzione WPS) | WPQR/WPS/fattibilità quando il coupon 15614 non rappresenta il giunto | `digitalizzata` | P0 | `NORMA_00045` MD+JSON (04/10/2026), schema `norm-clause` `ISO_15613_2025`. PDF **non** in Git. Estratto [`ISO-15613-qualifica-pre-produzione.md`](ISO-15613-qualifica-pre-produzione.md). **Non** seed SGQ. **Non** catalogo JS. Tabella 2 = parti 15614, **non** 14555. |
| EN **10025-3/4/5/6** | MC fine grain / weathering | `parcheggio` | P2 | Traccia MC; non bloccano MVP lamiere 10025-2 |
| Leggi settoriali oltre D.Lgs. **81**/ **152** | Conformità legislativa / ADR-018 | `digitalizzabile via Normattiva` | P1 → P0 | **81/2008** (sicurezza) e **152/2006** (ambiente) ora disponibili via ingest automatico Normattiva.it (settembre 2026). Settoriali specifici = HITL. Verifica validità automatica tramite Normattiva |

## Chiusure recenti (non riaprire)

| Codice | Stato | Data | Dove |
|--------|-------|------|------|
| ISO 15614-1:2017+A1:2019 | `digitalizzata` | 06/09/2026 | `NORMA_00043` MD+JSON; `NORMA_00019` resta archivio senza A1 |
| ISO 3834-2:2021 | `digitalizzata` | 25/08/2026 | `NORMA_00029` + seed VPS `ISO_3834_2_2021` |
| ISO 3834-4:2021 | `digitalizzata` | 25/08/2026 | `NORMA_00030` + seed VPS `ISO_3834_4_2021` |
| ISO 14555:2025 | `digitalizzata` | 26/08/2026; confronto 04/10/2026 | `NORMA_00033` tenuto (HITL); 3° CLI non applicato; estratto range + STUD-3-B già in repo |
| ISO 4063:2023 | `digitalizzata` | 04/10/2026 | `NORMA_00044` MD+JSON; 783–786 nel testo; catalogo JS aggiornato; non seed SGQ |
| ISO 15613:2025 | `digitalizzata` | 04/10/2026 | `NORMA_00045` MD+JSON; estratto pre-produzione vs 15614/14555; non seed SGQ |
| ISO 9712:2021 … 23277:2015 (batch 9) | `digitalizzata` | 26/08/2026 | `NORMA_00034`–`00042` MD+JSON; vedi backlog sopra per GAP per-norma |
| Quaderno LG 1090 (Conforma n.2) | `digitalizzata` | 26/08/2026 | `Quaderni/Quaderno_2_Linea_Guida_1090.{md,json,txt}`; non seed SGQ |

## Inventari collegati (non duplicare il dettaglio)

| Ambito | Path |
|--------|------|
| Material Compliance | [`MATERIAL-COMPLIANCE-NORME-SINTESI.md`](MATERIAL-COMPLIANCE-NORME-SINTESI.md) § Inventario |
| Catalogo Normative + Quaderni | [`.cursor/skills/gap-analysis-normativa/reference.md`](../../.cursor/skills/gap-analysis-normativa/reference.md) |
| PDF fuori Git | [`docs/Normative/SOURCE_PDF_INDEX.md`](../Normative/SOURCE_PDF_INDEX.md) |
| Piano fedeltà normativa | [`PLAN_NORM_FIDELITY_SLICES.md`](../agent-tasks/PLAN_NORM_FIDELITY_SLICES.md) |
