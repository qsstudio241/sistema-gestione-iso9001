# ISO 15614-2:2025 — Range di qualificazione WPQR alluminio (riferimento operativo SGQ)

> **Uso**: ingest WPQR alluminio, generatore WPS, assistente AI.
> **Fonte**: BS EN ISO 15614-2:2025 (PDF committente 25/08/2026). Testo integrale digitalizzato in `docs/Normative/Normative NORMA_00031_ UNI EN ISO 15614-2_2025 Rev. 0.md`.
> **Codice**: `weldingQualificationRules15614_2.js` (app + backend mirror).
> **Non confondere** con ISO 9606-2 (qualifica **saldatori** alluminio — patentino).

## Ambito

Arc welding di alluminio e leghe (wrought/cast). Processi tipici ISO 4063: 131, 141, 142 (elenco completo in norma §1). Non applica a finishing welding di getti (ISO 15614-4).

## Spessore materiale base — butt welds (Tabella 5, §8.3.2.2)

| Spessore provino t (mm) | Range materiale base | Max metallo depositato (s) |
|---|---|---|
| t ≤ 3 | 0,5 t – 2 t | 2 s |
| 3 < t ≤ 10 | 3 mm – 2 t | 2 s |
| 10 < t ≤ 20 | 5 mm – 2 t | 2 s |
| 20 < t ≤ 40 | 5 mm – 2 t | 2 s (s < 20) / 2 t (s ≥ 20) |
| 40 < t ≤ 150 | 5 mm – 2 t | 2 s (s < 20) / 2 t (s ≥ 20) |
| t > 150 | 5 mm – 1,5 t | 2 s (s < 20) / 1,5 t (s ≥ 20) |

**Codificato**: `computeQualifiedMaterialThicknessRange15614_2` (solo colonna materiale base; depositato non ancora usato in copertura WPS).

## Gola / fillet (Tabella 6, §8.3.2.3)

| Spessore provino t | Gola qualificata | Materiale (single / multi) |
|---|---|---|
| t ≤ 3 | 0,7 t – 2 t | 0,75 a – 1,5 a / nessuna restrizione |
| 3 < t < 30 | 3 – 2 t | (come sopra per single/multi) |
| t ≥ 30 | ≥ 5 mm (solo minimo) | — |

**Codificato**: `computeQualifiedFilletThroatThicknessRange15614_2`.

## Diametro tubo (Tabella 7, §8.3.2.4)

| Diametro provino D | Range |
|---|---|
| D ≤ 25 | 0,5 D – 2 D |
| D > 25 | ≥ 0,5 D (minimo 25 mm), nessun massimo |

Piastra → tubo: D > 500 mm, oppure D > 150 mm in **PA o PC** (posizione ruotata).  
**Nota vs 15614-1**: la parte 1 include anche PF/PA rotated; la parte 2 cita PA o PC.

**Codificato**: `computeQualifiedPipeDiameterRange15614_2`, `describePlateCoversPipeDiameter15614_2`.

## Spessori dissimili e campi t1/t2

§8.3.2.1: per il **calcolo tabellare** del nominale t su giunti dissimili (fillet, branch, T-butt) si usa lo **spessore minore**.  
I verbali reali (Annex) possono comunque dichiarare **due range** (t1 / t2). L’app li memorizza in `thickness_t1_*` / `thickness_t2_*` e in copertura WPS verifica ciascun genitore sul proprio range (orientamento A↔t1/B↔t2 oppure scambio).

## Gruppi materiale (Tabella 4)

Combinazioni similar/dissimilar per sottogruppi 21–26 (ISO/TR 15608). Matrice **non ancora** codificata in JS in questa slice (stesso pattern “solo gruppo dichiarato” dell’ingest 15614-1). Backlog: `isAluminiumParentCombinationCovered`.

## Regole ingest

| Campo | Regola |
|---|---|
| `standard_reference` | Preferire `UNI EN ISO 15614-2:2025` (o edizione sul verbale) |
| Range spessore | Estrarre i valori **dichiarati**; usare Tabella 5/6 solo come cross-check / suggerimento |
| t1 / t2 | Se il verbale elenca due range FW, popolare `thickness_t1_*` e `thickness_t2_*` |
