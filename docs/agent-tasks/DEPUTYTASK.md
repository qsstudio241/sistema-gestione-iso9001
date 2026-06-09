# DEPUTYTASK — Licenze moduli multi-tenant (09/06/2026)

**Stato:** CHIUSO — PR #101 mergiata su `main`, deploy backend VPS eseguito

**Obiettivo:** fix strutturato licenze per-tenant (hotfix ERAM + API + UI superadmin).

## Completato
- Hotfix produzione ERAM org 1004: moduli AI aggiunti via VPS (`run-patch-eram-ai-licenses-vps.js`).
- Backend: `GET /admin/organizations`, `GET /admin/organizations/:id/licenses`, helper service idempotenti.
- Frontend: selettore tenant in Licenze moduli per superadmin.
- Test CI: 642/642 pass, build Vite OK.
- Merge PR #101 su `main`.
- Deploy backend VPS (`admin.controller.js`, `admin.routes.js`, `moduleLicense.service.js`) + restart servizio.

## Verifica post-deploy
1. Login superadmin → Impostazioni → Licenze → seleziona ERAM → moduli AI visibili.
2. Mauro Franciosi (ERAM): logout/login per vedere Assistente AI (DB già aggiornato).

**TEST OK**
