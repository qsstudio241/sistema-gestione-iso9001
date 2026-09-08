# DEPUTYTASK1 — ISO-5b: foto cordone Welding Book

**Stato:** APERTO  
**Aperto:** 08/09/2026 (post-merge ISO-5 #670; priorità roadmap #3)  
**Rischio:** Medio — migrazione additiva `attachments` + attachment controller + upsert welds + FE; niente auth/JWT/sync  
**Piano:** [`PLAN_3834_SLICES.md`](PLAN_3834_SLICES.md) § ISO-5b · ADR-016 § foto cordone  
**Branch:** `cursor/iso5b-foto-cordone-8269`  
**Slot precedente:** ISO-5 CHIUSO su `origin/main` (sovrascrittura consentita)  
**Parallelo:** `DEPUTYTASK.md` Alert HITL APERTO — **NON toccato**. GUIDA/roadmap hub sync dopo merge (parallelo HITL).

---

## DoD

- [x] Migrazione `165` colonna `attachments.welding_book_weld_id` + `CHK_attachments_parent` (idempotente)
- [x] Upload/list allegati con `welding_book_weld_id` (org via `welding_books`)
- [x] Upsert-by-id su `welding_book_welds` (niente DELETE all che orfana le foto)
- [x] UI foto per riga sequenza (pattern RDP/NDT) + salvataggio resta in form per ottenere `id`
- [x] Export Word IOF embed foto cordone (`ImageRun`)
- [ ] L1 FE + BE verdi; migrazione VPS test+prod; deploy BE se serve
- [ ] PR/compare

## File previsti

- `database/migrations/165_attachments_welding_book_weld.sql`
- `backend/scripts/run-migration-165-vps.js`
- `backend/src/controllers/attachment.controller.js` (+ test)
- `backend/src/controllers/weldingBooks.controller.js` (+ test upsert)
- `app/src/components/WbWeldAttachments.jsx`
- `app/src/pages/WeldingBooksPage.jsx` / `.css`
- `app/src/utils/wordExportWeldingBook.js` (+ test)
- `docs/agent-tasks/PLAN_3834_SLICES.md`
- `docs/agent-tasks/DEPUTYTASK1.md`

## Cosa NON toccare

- `qualificationAlert.service.js` / `DEPUTYTASK.md` Alert HITL
- Auth / sync / JWT / ISO-4b / CTX-4
- `wordExportHelpers.js` / template audit

## Bozza hub (dopo merge)

- Roadmap: ISO-5b ✅; priorità successiva Medio actionable
- GUIDA: lezione upsert welds prima degli allegati riga (pattern RDP)
