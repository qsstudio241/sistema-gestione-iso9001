# DEPUTYTASK — ING-1: Classificazione / riordino allegati batch (caso commerciale)

**Stato:** APERTO  
**Aperto:** 02/09/2026  
**Piano:** [`PLAN_VALUTAZIONE_COMMESSE_SLICES.md`](PLAN_VALUTAZIONE_COMMESSE_SLICES.md) § ING-1  
**Rischio:** Medio — FE util + UI HITL su catalogo VC-2; riuso PATCH allegato esistente; niente migrazione; niente auth/sync breaking  
**Branch:** `cursor/ing1-batch-doc-classify-1c5d`  
**Dipende da:** VC-2 catalogo ruoli su `main`; PLAN ING-* (branch docs #623 allineato)  
**Parallelo:** se ING-4 su `DEPUTYTASK1` — file disgiunti (non toccare template checklist)

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

---

## Obiettivo verificabile

Su un caso `commercial_cases` con mole di allegati poco ordinata: **suggerimenti ruolo/tipo in batch** (euristiche da nome/path, pattern Import PDF) → pannello HITL (checkbox + select) → conferma applica via PATCH catalogo VC-2. Niente secondo storage, niente black-box totale.

## File previsti

- `app/src/utils/caseDocCatalog.js` (+ test) — suggerimento ruolo + build batch
- `app/src/pages/ContractReviewPage.jsx` (+ CSS minimo `.cr-*`) — UI HITL batch
- `docs/agent-tasks/DEPUTYTASK.md` / `PLAN_VALUTAZIONE_COMMESSE_SLICES.md` — brief + spunta ING-1

## Cosa NON toccare

- ING-2+ (matching auto pre-Analizza), VC-5 chiarimenti
- `importJobs.controller`, auth/JWT, sync, migrazioni
- Secondo storage allegati / nuovo motore OCR

## Caso golden path

Caso reale committente: se `case_id` non indicato → implementazione generica su qualsiasi caso aperto. HITL: indicare `case_id` di prova. Tenant prova noto: ERAM org 1004 (smoke coverage) — non vincolante per questa slice.

## Criteri chiusura

- [ ] Util suggerisce ruoli whitelist VC-2 da nome/mime (senza LLM)
- [ ] UI batch HITL: suggerisci → correggi → applica selezionati
- [ ] Test L1 util + build FE
- [ ] PR draft / compare URL; DEPUTYTASK CHIUSO TEST OK; PLAN ING-1 spuntato
