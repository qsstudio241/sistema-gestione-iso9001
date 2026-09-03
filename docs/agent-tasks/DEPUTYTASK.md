# DEPUTYTASK — PONTE-1: Checklist ↔ allegati layout A (implementazione)

**Stato:** APERTO  
**Aperto:** 03/09/2026 (HITL UX) · **Implementazione:** 03/09/2026  
**Piano:** [`PLAN_VALUTAZIONE_COMMESSE_SLICES.md`](PLAN_VALUTAZIONE_COMMESSE_SLICES.md) § PONTE-1  
**UX:** [`UX_PONTE_CHECKLIST_ALLEGATI.md`](UX_PONTE_CHECKLIST_ALLEGATI.md) — **HITL confermato layout A**  
**Rischio:** Medio — schema additivo + API + FE; PR, non push su `main`  
**Branch:** `cursor/ponte-checklist-allegati-a-1c5d`  
**Migrazione dichiarata:** **163** (`163_commercial_checklist_attachment_bridge.sql`)

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

---

## HITL (03/09/2026)

| Voce | Decisione |
|------|-----------|
| Layout | **A** (zona Allegati collegati sotto ogni voce P/F) |
| Flag obbligatorio | Template studio (ING-4), default OFF; sul caso solo badge read-only |
| Soft | salva esito/note + export OK se manca allegato → badge ambra |
| Hard | «Avanza stato» bloccato se voci required senza file |

---

## Obiettivo

Tracer verticale minimo: link checklist_item ↔ attachment del caso + flag `attachment_required` su template (snapshot sul caso) + UI layout A + gate advance.

## File previsti

- `database/migrations/163_commercial_checklist_attachment_bridge.sql` (nuovo)
- `backend/scripts/run-migration-163-vps.js` (nuovo)
- `backend/src/services/commercialChecklistAttachment.service.js` (nuovo)
- `backend/src/services/commercialChecklistAttachment.service.test.js` (nuovo)
- `backend/src/services/commercialChecklistTemplate.service.js`
- `backend/src/services/contractReviewWorkflow.service.js` (+ test)
- `backend/src/controllers/contractReview.controller.js` (+ test mirati)
- `backend/src/routes/contractReview.routes.js`
- `backend/scripts/deploy-manifest.json` (se nuovi `.js` in `backend/src/`)
- `app/src/pages/ContractReviewPage.jsx` + `.css`
- `app/src/pages/ContractChecklistTemplatesPage.jsx` (+ css se serve)
- `app/src/services/apiService.js`
- `app/src/data/commercialChecklistDefaults.js` / mirror BE
- `app/src/tests/contractReviewChecklistAttachments.test.js` (nuovo)
- `docs/agent-tasks/PLAN_VALUTAZIONE_COMMESSE_SLICES.md` (checkbox PONTE-1)
- questo brief → CHIUSO TEST OK

## Cosa NON toccare

- `auth.middleware`, JWT, `syncService`, ADR-008
- Viste-per-ente; ING-5; VC-5; secondo DMS
- SAL `gapAnalysis.service.js`
- Look UI nuovo (solo `.cr-*`)

## Esito atteso

TEST OK · L1 BE + Vitest FE + build app · PR draft · mig **163** + runner VPS
