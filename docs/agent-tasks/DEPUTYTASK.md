# DEPUTYTASK — PR #38 parte B: editor foto pre-upload (07/06/2026)

**Stato:** CHIUSO — TEST OK — 07/06/2026

**Task:** Recuperare dalla PR #38 **solo** l'editor foto pre-upload (`PhotoEditModal`: crop, rotazione ±90°, zoom), integrarlo su `main` aggiornato (che già contiene la compressione foto, parte A, commit `0740d80`), mergiare via git locale e **chiudere la PR #38** (ora completata). Export Word **non** toccato (resize già in `main`).

## Comportamento implementato
- Alla scelta di una foto (Gallery/Camera) si apre `PhotoEditModal`: **ritaglio (crop), rotazione ±90°, zoom, aspect ratio**.
- Editor **opzionale**: "Salta" usa l'originale, "Conferma" applica crop/rotazione (Canvas → JPEG 0.92), "Annulla tutto" non carica nulla. Più foto in sequenza (indice/totale).
- Flusso: scelta file foto → **editor opzionale** → `addAttachments("foto", ...)` → **compressione esistente (parte A)** → upload. **Una sola compressione**; `customItemId` preservato.

## File toccati
- `app/src/components/PhotoEditModal.jsx` (nuovo)
- `app/src/components/PhotoEditModal.css` (nuovo)
- `app/src/components/AttachmentSection.jsx` (wiring apertura modal per categoria "foto")
- `app/package.json` + `app/package-lock.json` (dipendenza `react-easy-crop@^5.5.7`)
- `docs/GUIDA_CONSOLIDATA.md` (registro decisioni: #38 chiusa, sottosezione parte B)

## Esito
- **Dipendenza**: `react-easy-crop@5.5.7` (peer `react >=16.4.0` → OK con React 18.2).
- **Build app (Vite)**: OK.
- **Test mirato**: `compressImageFile.test.js` 3/3 PASS (flusso compressione intatto). Nessun test dedicato editor (UI).
- **Merge** su `main` via git locale (no force, no squash), push `origin main`.
- **PR #38**: CHIUSA su GitHub via MCP con commento (parte A + parte B recuperate, Word già in main).
- Worktree dedicato `C:\sgq-pr38b-wt` rimosso a fine sessione. Working tree principale (WIP committente) non toccato.

## Passi manuali per il committente
1. **`git pull origin main`** sul desktop per allineare il working tree principale.
2. **`npm install`** in `app/` (nuova dipendenza `react-easy-crop`).
3. **Deploy frontend**: automatico su **Netlify** al push su `main` (nessuna azione backend richiesta).

---

## Task futuro pendente — Caricamento verbale di audit con revisione = numeratore audit

**Origine:** chiusura **PR #52** (07/06/2026). L'automatismo audit-close → `document_registry` (ADR-009 Fase 5) **non** è desiderato: il report Word esportato deve restare **modificabile** e **caricato manualmente** nell'albero. Il requisito vero è allineare la revisione al numero audit al momento del caricamento manuale.

- Tipo documento dedicato **"Verbale di audit"** nella cartella **12 AUDIT**.
- Al caricamento: selezione audit → `revision = audit.audit_number` (formato `PREFISSO-YYMMDD-NN`); campo revisione **read-only**.
- Opzionale: riconoscimento audit dal nome file export (`{Cliente}_{NumeroAudit}_{Standard}.docx`, trattini resi come underscore).
- Note tecniche: `document_registry.revision` è `NVARCHAR(20)` → valutare allargamento colonna (numeri audit fino a ~26 char); nessuna FK audit → salvare `audit_id`/`audit_number` in `type_specific_data`.
