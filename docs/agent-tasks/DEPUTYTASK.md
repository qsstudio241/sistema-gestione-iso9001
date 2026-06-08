# DEPUTYTASK — Licenze moduli multi-tenant (08/06/2026)

**Stato:** TEST OK — PR aperta su branch `cursor/org-licenses-superadmin-b334`

**Obiettivo:** fix strutturato licenze per-tenant (hotfix ERAM + API + UI superadmin).

## Completato
- Hotfix produzione ERAM org 1004: moduli AI aggiunti via VPS (`run-patch-eram-ai-licenses-vps.js`).
- Backend: `GET /admin/organizations`, `GET /admin/organizations/:id/licenses`, helper service idempotenti.
- Frontend: selettore tenant in Licenze moduli per superadmin.
- Test: `moduleLicense.service.test.js` (6/6), build Vite OK.

## Dopo merge (desktop committente)
1. `git pull origin main`
2. Deploy backend VPS (`deploy-controllers-to-vps.ps1`) per attivare i nuovi endpoint.
3. Verifica smoke: login superadmin → Impostazioni → Licenze → seleziona ERAM → moduli AI visibili.
4. Mauro Franciosi: logout/login per vedere Assistente AI (DB già aggiornato).
