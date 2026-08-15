# DEPUTYTASK — Rischi / Opportunità / Obiettivi — ROO-6c (mapping colonne ingest)

**Stato:** CHIUSO  
**Priorità:** P1 — i file cliente reali non passano il solo auto-detect M03  
**Branch base:** `cursor/rischi-opportunita-obiettivi-c6d2`  
**Slice:** ROO-6c  
**Chiuso:** 15/08/2026 — foglio + corrispondenza colonne + peso qualitativo  
**Piano:** [PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md](PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md)  
**Spec:** [M03_ANALISI_RISCHI_OPPORTUNITA.md](../specs/M03_ANALISI_RISCHI_OPPORTUNITA.md)

## Cosa NON toccare

- `docs/agent-tasks/DEPUTYTASK.md`
- Scala P/G 1–4 (ROO-13): valori 4/5 o |D|>3 = riga saltata
- Detector dedicato SWOT/FMEA come secondo metodo (ROO-6b / ROO-15)
- Upsert per chiave (resta solo insert)
- Sync / ADR-008

## Perché

`ANALISI RISCHI 2026` e `RISK_SGQ - 2025_REV.10` sono analisi §6.1 valide, ma non sono il template M03:

- peso testuale BASSO/MEDIO/ALTO invece di P e G numerici
- due colonne Rischi / Opportunità sulla stessa riga
- più fogli (cataloghi 4.1/4.2 + matrice); il primo foglio non è l'analisi
- Pi/Di in scala 1–5 con gravità con segno

L'auto-detect M03 da solo li rifiutava. La prova di ingest richiede **scelta foglio** e **corrispondenza colonne**.

## Consegnato

| Pezzo | Dove |
|-------|------|
| Detector | `excelRisksM03Detector.js` — tutti i fogli, sinonimi, peso qualitativo, split R/O, mapping override |
| API | `POST /risks/detect-import` accetta `sheetName` + `mapping`; import persiste `nature` |
| UI | dialog: select foglio + 16 corrispondenze + anteprima (classi `did-*`) |

## Prossima slice

**ROO-6b** — metodo SWOT/FMEA nativo (scala e segno in anagrafica, non solo mapping HITL).  
**ROO-13** — se si vuole importare anche |D|=4/5 senza skip.
