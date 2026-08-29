# DEPUTYTASK — LN-2: Libreria deep-link / azioni minime

**Stato:** CHIUSO — TEST OK  
**Aperto:** 29/08/2026  
**Chiuso:** 29/08/2026  
**Piano:** [`PLAN_LIBRERIA_NORME_SLICES.md`](PLAN_LIBRERIA_NORME_SLICES.md)  
**Rischio:** Basso/Medio — FE additivo su `NormLibraryPage` + riuso `NormUploadButton`; niente auth/sync/migrazioni  
**Origine:** Piano Libreria dopo LN-1 (#604); committente «esaurire tutti i punti» ramo fonti  
**Branch:** `cursor/ln2-libreria-deeplink-0b72`  
**Esito:** TEST OK — Vitest `normLibraryPage.test.jsx` (5) + `npm run build` verdi

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Esito

- Codice/titolo catalogo → deep-link `/documents?tab=tree&select=<id>`
- Header: `NormUploadButton` (refresh catalogo on complete) + CTA «Apri Documenti»
- PLAN LN-2 CHIUSO
