# Spec — Analisi rischi e opportunità (M03)

> Draft di processo dello studio, non un inventario dell'app.
> **Processo ricostruito:** [`PROCESSO_ANALISI_RISCHI_OPPORTUNITA.md`](PROCESSO_ANALISI_RISCHI_OPPORTUNITA.md)
> Template: [`templates/M03-R00-analisi-rischi-opportunita.xlsx`](templates/M03-R00-analisi-rischi-opportunita.xlsx)
> Piano slice: [`../agent-tasks/PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md`](../agent-tasks/PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md)

**Fonte file**: M03 rev.00, 19/06/2026, foglio unico `Analisi Rischio`, creatore Marco Camellini. Titolo cella B1: `ANALISI RISCHI E OPPORTUNITA'`. Codice cella E1: `M03 / rev.00 / 19/06/2026`. Titoli di stampa: righe 1–2. Filtro: `A2:K18`.

Nel file consegnato le colonne A–D e I–L sono **vuote** (template); restano i punteggi. A1 è `#VALUE!` (formula rotta, probabilmente logo/ragione sociale). Celle unite in A/B/D = un *elemento* o un *contesto* può coprire più righe di analisi.

## Processo (ordine delle colonne)

| # | Colonna Excel | Intestazione (riga 2) | Clausola | Note |
|---|----------------|------------------------|----------|------|
| 1 | A | Elemento valutatao (*typo nel draft*) | — | Gruppo: stessa etichetta su più rischi |
| 2 | B | Contesto | §4.1 | Testo sulla riga, non anagrafica |
| 3 | C | Parti interessate | §4.2 | Testo sulla riga |
| 4 | D | Azioni attuali di mitigazione del rischio | §6.1.2 (già in atto) | Controlli esistenti |
| 5 | E | P | §6.1 | Probabilità; nel draft valori 1–3, G arriva a **4** |
| 6 | F | G | §6.1 | Gravità (impatto) |
| 7 | G | R | — | `=P*G` (alcune celle sono valori fissi) |
| 8 | H | Livello di rischio | — | Testo: Basso / Medio (Alto non compare) |
| 9 | I | Possibili ulteriori azioni | §6.1.2 | Piano |
| 10 | J | Resp. | §6.1.2 / 6.2.2 c | |
| 11 | K | Temp. | §6.1.2 / 6.2.2 d | Tempistica |
| 12 | L | Aggiornamento | §6.1.2 b)2 | Riesame / efficacia |
| 13 | M–P | P G R Livello di rischio residuo | §6.1.2 | Dopo le ulteriori azioni |

## Mapping verso `risks` (target ingest / UI)

| Colonna M03 | Campo target (proposto) | Stato app 14/08/2026 |
|-------------|-------------------------|----------------------|
| Elemento valutato | `evaluated_element` | C'è (ROO-4); `title` resta il rischio |
| Contesto | `context_text` | C'è (ROO-4); enum `context` ancora presente |
| Parti interessate | `interested_parties_text` | C'è (ROO-4); tab catalogo resta a parte |
| Azioni attuali | `current_actions` | C'è (ROO-4) |
| P / G / R | `probability`, `impact`, `score` | C'è, CHECK **1–3** (M03 ha G=4) |
| Livello | `score_level` | Calcolato in API/UI (soglie 1–3/4–6/7–9) |
| Ulteriori azioni | `further_actions` | C'è (ROO-4); fallback lettura `treatment_desc` |
| Resp. | `responsible` | C'è |
| Temp. | `review_date` (azione distinta = ROO-7) | C'è (`review_date`) |
| Aggiornamento | `effectiveness_note` | C'è (ROO-5) |
| P/G/R/Livello residuo | `residual_probability`, `residual_impact`, `residual_score` | C'è (ROO-5); scala 1–3 |
| (ISO, non in Excel) | `nature` | C'è (`risk` default in ingest) |
| Ambito | `company_id` | Opzionale + header `useCompanyScope` |

Ingest (ROO-6): riga 1–2 = testata; dati da riga 3; celle unite → ripetere il valore sulle righe coperte. Detect: foglio `Analisi Rischio` **oppure** intestazioni `Contesto` + `Parti interessate` + `Livello di rischio residuo`. Pattern ADR-013: detect → dry-run → upsert.

## Fuori da questo foglio

- Obiettivi §6.2 (KPI, target, avanzamento) — tab distinto.
- Cataloghi PESTLE / anagrafica parti — opzionali, non obbligatori per una riga valida.

## Altri layout di ingest (non versionare i file cliente)

Stesso prodotto, detector diversi (vedi PLAN §5):

| Layout | Segnali di detect | Metodo |
|--------|-------------------|--------|
| M03 | foglio `Analisi Rischio` + «Livello di rischio residuo» | `pxg` |
| SWOT (es. COSBEN 04.34) | colonna `SWOT` con S/W/O/T + `RI`/`RR` | `swot_signed` |
| FMEA HSE (es. QLT-MOD09) | colonne `G P R IPR` + foglio Istruzioni IPR | `fmea_gpr` |

I due Excel pieni (SSL/Ambiente 2026, COSBEN 2025) restano presso lo studio: dati operativi, non template.
