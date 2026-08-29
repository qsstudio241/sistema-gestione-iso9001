# DEPUTYTASK — LN-5: Richieste Libreria scrivibili (minimo sicuro)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 29/08/2026  
**Chiuso:** 29/08/2026  
**Piano:** [`PLAN_LIBRERIA_NORME_SLICES.md`](PLAN_LIBRERIA_NORME_SLICES.md)  
**Rischio:** Basso — FE form + localStorage per org; niente migrazione/auth/sync  
**Branch:** `cursor/ln5-libreria-richieste-0b72`  
**Esito:** TEST OK — Vitest util + page (11) + build

## Esito

- Form «Aggiungi richiesta studio» → localStorage `sgq_library_requests_v1_<orgId>`
- Merge con snapshot piattaforma; badge Fonte Studio/Piattaforma
- «Copia MD» per paste HITL in `NORME_MANCANTI_BACKLOG.md`
- **Manca (2 righe HITL storage):** persistenza server (tabella/`library_source_requests` o API) se serve multi-device; oggi intenzionalmente file-local browser

## Piano

LN-2…LN-5 chiuse in sessione; PLAN marcato completato.
