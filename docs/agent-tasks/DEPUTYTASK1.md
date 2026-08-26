# DEPUTYTASK1 — CND-6: foto + NC da marca in campo (hardening mobile)

**Stato:** APERTO  
**Aperto:** 26/08/2026  
**Piano:** [`PLAN_CND_SLICES.md`](PLAN_CND_SLICES.md)  
**Dipende da:** CND-1 **CHIUSO** (#549) — marche a scheda già in tasca  
**Rischio:** Medio — FE allegati CND + hint NC; niente auth/sync/schema.  
**Parallelo a:** CND-7 su [`DEPUTYTASK.md`](DEPUTYTASK.md) e STUD-1 su [`DEPUTYTASK_WPQR_STUD.md`](DEPUTYTASK_WPQR_STUD.md) — **file disgiunti**.

## Fonti Markdown

- Coperte: PLAN_CND (evidenza fotografica + NC da difetto); DNA / libreria UI (`AttachmentSection` pattern, `NcCreateModal`)
- Mancanti: —
- Si parte su: irrobustire ciò che già esiste in campo (camera/touch), non reinventare uploader

## Perché

Foto per riga marca e NC da giudizio R/S ci sono, ma in officina restano scomode (target piccoli, errori poco chiari, flusso NC da marca). CND-6 = hardening mobile del già fatto.

## DoD (da PLAN_CND)

1. `NdtItemAttachments`: UX touch/camera più chiara (target tap, feedback upload/errore, read-only coerente) senza secondo uploader parallelo.
2. Hint / ingresso a `NcCreateModal` da marca con giudizio R o S (precompilazione sensata se già supportata; altrimenti messaggio + open modal) — **non** un wizard NC nuovo.
3. Riuso: `compressImageFile` / pattern allegati già in repo; `status-btn` invariato.
4. Non toccare gate 9712 (CND-2) né flag PT/MT (CND-3) né controller posa registro (CND-7).
5. Test L1 Vitest mirati + `npm run build` in `app/`.
6. Spuntare CND-6 in PLAN_CND; brief **CHIUSO** — TEST OK.

## File previsti

- `app/src/components/NdtItemAttachments.jsx` / `.css`
- eventuale tocco minimo in `NdtReportsPage.jsx` **solo** per hint NC da marca (se il collegamento non è già lì) — **vietato** riscrivere sezioni metodo / gate
- `app/src/tests/` mirati CND-6
- `docs/agent-tasks/PLAN_CND_SLICES.md` + questo brief (chiusura)

## Cosa NON toccare

- `DEPUTYTASK.md` / CND-7 / `ndtReports.controller.js` / posa registro
- `ndtMethodParams.js` / flag PT/MT / `ndtInspectorGate*`
- STUD / WPQR / NormBroker / auth / sync
- CND-9 IndexedDB (slice separata)
- GUIDA / roadmap § Stato attuale (parallelo — sync **dopo merge**)

## Verifica

- [ ] Foto marca usabile a dito; errori leggibili
- [ ] Percorso NC da R/S chiaro
- [ ] L1 + build OK
- [ ] PLAN CND-6 spuntato; brief CHIUSO — TEST OK
