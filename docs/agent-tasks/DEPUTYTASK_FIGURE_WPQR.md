# DEPUTYTASK_FIGURE_WPQR — FW-0: slot visivi dal VLM (niente verdetto WPQR)

**Stato:** PRONTO — **non APERTO**. Lanciare solo dopo merge MR-5.  
**Aperto:** —  
**Piano:** [`PLAN_FIGURE_WPQR_SLICES.md`](PLAN_FIGURE_WPQR_SLICES.md)  
**Spec:** ADR-010 · MR-5 `describeCropAgainstFigures` · non chiamare `generateWpsFromWpqr` in questa slice  
**Rischio:** Medio — parse additivo sulla risposta VLM; PR + 1 Bugbot a slice chiusa; **non** push su `main`

> **Allineamento Git (autonomo)**: `git fetch origin main` e partire da `origin/main` con MR-5 già mergiato. Non chiedere al committente.

---

## Slice unica: FW-0

**Obiettivo:** il VLM, oltre al testo italiano, prova a emettere uno **schema slot** (giunto, processo, spessori se visibili, posizione). Un parser locale estrae JSON; se manca o è sporco → `slots: null`. Nessuna query su `wpqr_records`. Nessun «siete coperti».

### DoD

1. Prompt VLM chiede un blocco JSON (oltre al testo); disclaimer invariato.
2. Parser: JSON valido → `slots`; altrimenti `null`. Nessun throw.
3. API `search-by-image` aggiunge `slots` (null se assente). `reply` resta com’è.
4. L1: mock VLM con JSON buono / testo senza JSON / JSON parziale.
5. **Non** importare `wpsGenerator.service.js` né `qualificationCoverage.js`.
6. Un Bugbot solo a slice chiusa.

### File previsti

- `backend/src/services/figureVlm.service.js` + test
- `backend/src/controllers/figureKnowledge.controller.js` + test (campo `slots`)
- eventuale helper minimo nello stesso service (niente file nuovo se sta in 40 righe)
- questo brief + riga PLAN FW-0 **fatto** a chiusura

### Cosa NON toccare

- `wpsGenerator.service.js`, `qualificationCoverage.js`, `welding.controller.js`
- `AiAssistantPage.jsx` (UI candidati = FW-3)
- Gemini, CLIP, migrazioni, GUIDA, roadmap
- `DEPUTYTASK.md` / `DEPUTYTASK5.md` (MR-5 già chiuso)

### Verifica

```bash
cd backend && npx jest src/services/figureVlm.service.test.js src/controllers/figureKnowledge.controller.test.js --forceExit
```

---

## Comando per il deputy (solo dopo merge MR-5)

Sovrascrivi lo **Stato** in **APERTO**, poi: leggi `docs/agent-tasks/DEPUTYTASK_FIGURE_WPQR.md` ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI. Non chiamare il motore WPQR. Non toccare GUIDA né roadmap.
