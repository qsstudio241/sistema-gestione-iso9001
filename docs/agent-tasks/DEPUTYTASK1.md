# DEPUTYTASK1 — ISO-5b: foto cordone Welding Book

**Stato:** CHIUSO — TEST OK  
**Aperto:** 08/09/2026 (post-merge ISO-5 #670; priorità roadmap #3)  
**Chiuso:** 08/09/2026  
**Rischio:** Medio — migrazione additiva `attachments` + attachment controller + upsert welds + FE; niente auth/JWT/sync  
**Piano:** [`PLAN_3834_SLICES.md`](PLAN_3834_SLICES.md) § ISO-5b · ADR-016 § foto cordone  
**Branch:** `cursor/iso5b-foto-cordone-8269`  
**Compare:** https://github.com/qsstudio241/sistema-gestione-iso9001/compare/main...cursor/iso5b-foto-cordone-8269?expand=1  
**Slot precedente:** ISO-5 CHIUSO su `origin/main` (sovrascrittura consentita)  
**Parallelo:** `DEPUTYTASK.md` Alert HITL APERTO — **NON toccato**. GUIDA/roadmap hub sync dopo merge.

---

## Esito

**TEST OK**

- Migrazione **165** test+prod: `welding_book_weld_id` + CHK (verificato COL OK / CHK_WB OK)
- Attachment API: list/upload con `welding_book_weld_id` + scope `welding_books`
- Upsert-by-id `welding_book_welds` (preserva foto al salvataggio)
- UI `WbWeldAttachments` per riga; form resta aperto dopo save per abilitare foto
- Word IOF: sezione «Foto cordone» con `ImageRun`
- L1 FE 9/9 · BE 22/22 · build Vite OK · deploy VPS PID 153430→170676 · health 200
- PR create 403 → compare URL sopra

## File toccati

- `database/migrations/165_attachments_welding_book_weld.sql`
- `backend/scripts/run-migration-165-vps.js`
- `backend/src/controllers/attachment.controller.js` (+ test)
- `backend/src/controllers/weldingBooks.controller.js` (+ test)
- `app/src/components/WbWeldAttachments.jsx`
- `app/src/pages/WeldingBooksPage.jsx` / `.css`
- `app/src/utils/wordExportWeldingBook.js` (+ test)
- `docs/agent-tasks/PLAN_3834_SLICES.md`
- `docs/agent-tasks/DEPUTYTASK1.md`

## Cosa NON toccato

- `qualificationAlert.service.js` / `DEPUTYTASK.md`
- Auth / sync / JWT / ISO-4b / CTX-4
- GUIDA / roadmap (hub dopo merge — parallelo HITL)

## Bozza hub (dopo merge)

- Roadmap: ISO-5b ✅; priorità Media successiva (ISO-8 o altro AFK)
- GUIDA: upsert welds **prima** degli allegati riga (pattern RDP); CHK parent con ogni nuovo parent allegati
