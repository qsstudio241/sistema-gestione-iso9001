# DEPUTYTASK_SAL_AI — S1b: OCR immagini (PNG/JPEG/WebP)

**Stato:** APERTO  
**Aperto:** 29/08/2026  
**Stream:** SAL AI evidenze — piano [`PLAN_SAL_AI_EVIDENCE_SLICES.md`](PLAN_SAL_AI_EVIDENCE_SLICES.md)  
**S1a:** CHIUSO (PR [#471](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/471))  
**Rischio:** Medio — service backend additivo (OCR su buffer immagine); niente auth/sync/migrazioni  
**Branch:** `cursor/sal-ai-s1b-ocr-immagini-b42c`

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK_SAL_AI.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Perché

S1a legge i PDF scansionati. Una foto (PNG/JPEG/WebP) allegata al registro resta `unsupported_format`: il suggeritore SAL AI non vede il testo. S1b fa leggere anche quelle foto, senza rompere se Tesseract manca o fallisce.

## Obiettivo

Allegato `image/png` / `image/jpeg` / `image/webp` → testo via Tesseract sul buffer (niente pdf2pic). Se il motore non c’è o fallisce → `text: null` + reason stabile, **senza crash**.

## DoD

- [ ] Ramo immagini in `documentTextExtractor` (riuso worker Tesseract da `ocrExtractor`; niente pipeline PDF duplicata)
- [ ] Test L1 con buffer minima / mock
- [ ] `isExtractable` true per png/jpeg/jpg/webp
- [ ] Fallimento → `ocr_unavailable` / `ocr_failed` (come S1a), no throw

## File previsti

- `backend/src/utils/ocrExtractor.js` (helper `extractTextFromImageBuffer` + WebP)
- `backend/src/utils/ocrExtractor.test.js`
- `backend/src/services/documentTextExtractor.service.js`
- `backend/src/services/documentTextExtractor.service.test.js`
- `docs/agent-tasks/DEPUTYTASK_SAL_AI.md` (questo brief)
- `docs/agent-tasks/PLAN_SAL_AI_EVIDENCE_SLICES.md` (checkbox S1b)

`deploy-manifest.json`: `ocrExtractor.js` e `documentTextExtractor.service.js` **già listati** — non aggiungere file nuovi.

## Cosa NON toccare

- `docs/agent-tasks/DEPUTYTASK.md` (slot principale; PR #601 LN-1)
- UI SAL (`SALModule.jsx`, `SalAiSuggestDialog`, `SalEvidenceSection`)
- `.doc` / S1c; S2a/S2b
- Pipeline ingest (salvo riuso già esistente)
- Auth, sync, JWT, migrazioni
- GUIDA / roadmap § Stato attuale (altra chat LN-1 aperta — bozza qui sotto; sync dopo merge)

## Verifica

- [ ] Jest mirato: `documentTextExtractor.service.test.js` + `ocrExtractor.test.js`
- [ ] PNG/JPEG/WebP: OCR ok → testo + `ocr_ok`; throw Tesseract → `ocr_failed`; modulo assente → `ocr_unavailable`
- [ ] `.doc` / zip restano `unsupported_format`
- [ ] PDF S1a invariato

## Bozza hub (dopo merge, non in questa PR)

- **GUIDA**: una riga — estrattore registro legge anche foto PNG/JPEG/WebP via Tesseract; stesso fallback S1a.
- **Roadmap**: S1b CHIUSO; prossimo = S2a (documento mancante HITL), non S1c finché HITL `.doc`.
