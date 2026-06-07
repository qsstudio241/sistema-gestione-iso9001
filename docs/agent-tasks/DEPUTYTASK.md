# DEPUTYTASK — Integrazione PR #91 con regola scope azienda AI (07/06/2026)

**Stato:** CHIUSO — TEST OK — 07/06/2026

**Task:** Finalizzare l'integrazione della PR #91 (ambito azienda assistente AI) adattandola alla **regola di prodotto definitiva** del committente, mergiare su `main` via git locale.

## Regola di prodotto applicata (diversa dalla PR originale)
- **Utente AZIENDA cliente**: scope AI **forzato sulla propria anagrafica primaria** (`company_id` più basso in `user_company_access`), ignorando qualunque `companyId` inviato dal client. **Nessun 403** (la PR originale dava 403 al cliente multi-azienda; ora blocchiamo/forziamo).
- **Utente STUDIO** (auditor_org / superadmin): invariato — può scegliere tra le SOLE aziende del suo `auditor_org_id`.
- **Sicurezza RAG mantenuta**: filtro `searchKnowledge` su `company_id = @compId` (niente `OR IS NULL`, niente chunk globali).
- **Frontend**: per l'utente azienda il chip selettore azienda è **disabilitato e fisso** sulla sua azienda (nessun dropdown).

## File toccati
- `backend/src/services/aiCompanyScope.service.js` (+ `.test.js`)
- `backend/src/controllers/aiChat.controller.test.js`
- `app/src/pages/AiAssistantPage.jsx` (+ `.css`)
- `docs/GUIDA_CONSOLIDATA.md` (registro decisioni: #91 MERGIATA + sottosezione regola scope)

## Esito
- **Test backend mirati (jest)**: 15/15 PASS (`aiCompanyScope.service.test.js`, `aiChat.controller.test.js`).
- **Build app (Vite)**: OK.
- **Merge** su `main` via git locale (no force, no squash), push `origin main`.
- Worktree dedicato `C:\sgq-pr91-wt` rimosso a fine sessione. Working tree principale (WIP committente) non toccato.

## Note operative
- Conflitto `GUIDA_CONSOLIDATA.md` (whole-file CRLF/LF) risolto tenendo la versione di `main` + nota PR #91.
- `gh` non autenticato: merge via git locale; PR #91 si auto-chiude al push del merge su `main` (o chiudere manualmente con commento).

## Passi manuali per il committente
1. **Deploy VPS backend** per attivare la nuova logica `/ai/chat` (`backend/scripts/deploy-to-vps.sh` o `deploy-controllers-to-vps.ps1`).
2. **`git pull origin main`** sul desktop per allineare il working tree principale.

---

## Task futuro pendente — Caricamento verbale di audit con revisione = numeratore audit

**Origine:** chiusura **PR #52** (07/06/2026). L'automatismo audit-close → `document_registry` (ADR-009 Fase 5) **non** è desiderato: il report Word esportato deve restare **modificabile** e **caricato manualmente** nell'albero. Il requisito vero è allineare la revisione al numero audit al momento del caricamento manuale.

- Tipo documento dedicato **"Verbale di audit"** nella cartella **12 AUDIT**.
- Al caricamento: selezione audit → `revision = audit.audit_number` (formato `PREFISSO-YYMMDD-NN`); campo revisione **read-only**.
- Opzionale: riconoscimento audit dal nome file export (`{Cliente}_{NumeroAudit}_{Standard}.docx`, trattini resi come underscore).
- Note tecniche: `document_registry.revision` è `NVARCHAR(20)` → valutare allargamento colonna (numeri audit fino a ~26 char); nessuna FK audit → salvare `audit_id`/`audit_number` in `type_specific_data`.
