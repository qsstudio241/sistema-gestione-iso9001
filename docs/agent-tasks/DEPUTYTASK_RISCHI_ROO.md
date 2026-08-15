# DEPUTYTASK — Rischi / Opportunità / Obiettivi — ROO-6 (ingest Excel M03)

**Stato:** CHIUSO  
**Priorità:** P1 — importare il foglio M03 nella matrice già allineata  
**Branch base:** `main`  
**Slice:** ROO-6  
**Chiuso:** 15/08/2026 — detect → dry-run → insert  
**Piano:** [PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md](PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md)  
**Spec:** [M03_ANALISI_RISCHI_OPPORTUNITA.md](../specs/M03_ANALISI_RISCHI_OPPORTUNITA.md)

## Cosa NON toccare

- `docs/agent-tasks/DEPUTYTASK.md`
- Scala P/G 1–4 (ROO-13): G=4 in Excel = riga saltata, non 400 sull'intero file
- Detector SWOT / FMEA (ROO-6b)
- Upsert per chiave (v1 = solo insert)
- Sync / ADR-008

## Consegnato

| Pezzo | Dove |
|-------|------|
| Detector | `excelRisksM03Detector.js` — foglio `Analisi Rischio`, merge fill, primo/secondo P/G |
| API | `POST /risks/detect-import`, `POST /risks/import`, `GET /risks/import-template` |
| UI | toolbar Analisi: Importa Excel M03 + Scarica modello + dialog anteprima |

## Prossima slice

**ROO-6b** — detector SWOT + FMEA HSE sullo stesso flusso.
