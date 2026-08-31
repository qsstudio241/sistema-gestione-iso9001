# DEPUTYTASK — LG-2: UX conferma tenant + deep-link Libreria

**Stato:** CHIUSO — TEST OK  
**Aperto:** 30/08/2026  
**Chiuso:** 30/08/2026  
**Piano:** [`PLAN_LIBRERIA_GAP_SLICES.md`](PLAN_LIBRERIA_GAP_SLICES.md)  
**Rischio:** Basso–Medio — solo FE  
**Branch:** `cursor/lg2-libreria-gap-ux-7143`  
**Esito:** TEST OK — Vitest 15 · build OK

## Esito

- CTA per-gap «Vai in Libreria — …» con query `?highlight=&path=tenant|platform&prefill=1`
- Badge distinti Via tenant (ingest) vs Via piattaforma + conferma in risposta
- Libreria: banner arrivo + prefill form + highlight riga backlog (`rowClassName`)
- Util `libraryGapDeepLink.js` (contratto query, pathname invariato)
- Niente BE / pdf-to-json

## DoD

- [x] CTA deep-link
- [x] Distinzione tenant vs piattaforma
- [x] Prefill + highlight Libreria
- [x] Test L1 + build
- [x] PLAN LG-2 CHIUSO; brief CHIUSO

## Post-merge

- FE Netlify da `main` (nessun deploy BE aggiuntivo per LG-2)
- Prossima slice: **LG-3** coda superadmin
