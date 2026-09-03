# DEPUTYTASK — PONTE-1: Checklist ↔ allegati layout A

**Stato:** CHIUSO — TEST OK  
**Aperto:** 03/09/2026 (HITL UX) · **Implementato / chiuso:** 03/09/2026  
**Piano:** [`PLAN_VALUTAZIONE_COMMESSE_SLICES.md`](PLAN_VALUTAZIONE_COMMESSE_SLICES.md) § PONTE-1  
**UX:** [`UX_PONTE_CHECKLIST_ALLEGATI.md`](UX_PONTE_CHECKLIST_ALLEGATI.md) — layout **A** confermato HITL  
**Rischio:** Medio  
**Branch:** `cursor/ponte-checklist-allegati-a-1c5d`  
**Migrazione:** **163** (`163_commercial_checklist_attachment_bridge.sql` + `run-migration-163-vps.js`)

---

## HITL

| Voce | Decisione |
|------|-----------|
| Layout | **A** |
| Flag | Template studio, default OFF; caso read-only badge |
| Soft | salva/export OK + badge ambra |
| Hard | Avanza stato bloccato se required senza file |

## Esito

- Schema link `commercial_case_checklist_attachments` + `attachment_required` template/caso
- API GET/POST/DELETE link; generate checklist snapshotta il flag
- FE tab Checklist zona Allegati collegati; template checkbox
- Gate workflow preliminare/finale
- L1 BE (attachment + workflow + template defaults) + Vitest FE + build app OK
- `deploy-manifest.json` aggiornato (`commercialChecklistAttachment.service.js`)

## Come prova l’utente

1. Ops: applicare mig **163** su VPS (`run-migration-163-vps.js`), deploy BE
2. Gestione → Template checklist: spunta «Allegato obbligatorio» su una voce → Salva
3. Caso riesame → Genera checklist → badge «Allegato richiesto»; senza file → «Manca allegato» (salva comunque)
4. Collega / Carica e collega da allegati del caso
5. Avanza stato: blocco se manca allegato required

## Cosa NON toccato

auth/sync · viste-per-ente · ING-5 · secondo DMS · SAL gap engine
