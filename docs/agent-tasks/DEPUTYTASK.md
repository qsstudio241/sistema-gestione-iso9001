# DEPUTYTASK — LN-4: Tipi riferimento libro/quaderno (label UI, senza enum nuovi)

**Stato:** APERTO  
**Aperto:** 29/08/2026  
**Piano:** [`PLAN_LIBRERIA_NORME_SLICES.md`](PLAN_LIBRERIA_NORME_SLICES.md)  
**Rischio:** Basso — solo label FE in Libreria; **niente** nuovi `doc_type` / migrazioni / CHECK  
**Branch:** `cursor/ln4-libreria-tipi-0b72`  
**Decisione prodotto (sicura senza HITL):** libri/quaderni restano tipizzati come `manuale` / `altro` già in registry; in Libreria label esplicite «Manuale / libro» e «Altro / quaderno». Enum dedicati = solo se HITL futuro + ADR-011.

> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo.`

## Obiettivo

Catalogo Libreria mostra tipi con label che chiariscono scope libri/quaderni **senza** inventare `doc_type=libro|quaderno` né migrazione.

## File previsti

- `docs/agent-tasks/DEPUTYTASK.md`, `PLAN_LIBRERIA_NORME_SLICES.md`
- `app/src/pages/NormLibraryPage.jsx` (+ test)

## Cosa NON toccare

- `documentTypes.js` enum globale (evita breaking form Documenti)
- Migrazioni / CHECK / ADR-011 rewrite
