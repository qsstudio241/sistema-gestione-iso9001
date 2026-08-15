# DEPUTYTASK — Rischi / Opportunità — ROO-8 (picker 4.1/4.2 → riga)

**Stato:** APERTO  
**Aperto:** 15/08/2026 (Lead wayfinder — integrazione SWOT / parti)  
**Slice:** ROO-8  
**Piano:** [PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md](PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md) §6  
**Branch base:** `cursor/rischi-opportunita-obiettivi-c6d2`

---

## Slice unica: ROO-8

**Obiettivo**: dal form della riga di analisi si possono **prendere** fattori §4.1 e parti §4.2 dal catalogo dell’ambito e **accodarli** nei testi `context_text` / `interested_parties_text`. Il tab Contesto resta l’anagrafica da monitorare; non è la home.

### Contesto gap (non riscrivere)

- I campi testo sulla riga ci sono (ROO-4); l’ingest li riempie già (ROO-6c).
- Il tab Contesto è CRUD isolato (`context_factors`, `interested_parties`).
- Nessun ponte UI: l’operatore ricopia a mano o lascia i testi vuoti.

### DoD

1. In `RiskForm`, sotto i due textarea, un controllo «Dal catalogo» (liste già caricate via API esistenti, filtrate da `useCompanyScope`). Scelta → accoda riga di testo (nome + requisiti / descrizione), non sovrascrive. Testo libero resta editabile.
2. Nessuna FK nuova, nessuna migrazione. Riga valida anche senza picker.
3. Test L1 sul form (accoda, non duplica se già presente, non tocca SWOT/scala).
4. Riuso liste/API del tab Contesto; non un terzo fetch pattern. UI: DNA esistente (`RisksPage` / `btn-secondary`), non un dialog nuovo se basta una `<select>`.

### File previsti

- `app/src/pages/RisksPage.jsx` (`RiskForm` + eventuale passaggio liste)
- test Vitest del form (nuovo o accanto a test rischi già presenti)
- API: solo GET già esistenti (`context-factors`, `interested-parties`)

### Cosa NON toccare

- `docs/agent-tasks/DEPUTYTASK.md` (SAL S1a)
- Detector SWOT/FMEA, segno G, `method` (ROO-15 / ROO-6b-S)
- Upsert ingest, scala P/G, selettore azienda in pagina
- Schema `interested_parties` / `context_factors`

### Prossima (non in questa sessione)

ROO-15 (`method` + G con segno) poi ROO-6b-S (detector SWOT sulla stessa matrice).
