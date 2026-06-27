# DEPUTYTASK — stato al 27/06/2026

## Sessione CHIUSA — Errori console systemgest (TEST OK, PR #172)

**Sintomi**: su `systemgest.netlify.app` — `ai/feedback` 500, `run-nc-alerts` 400, warn schema al logout, warn `q3834_s1_3` su click NC.

**Fix** (PR **#172** → merge su `main`):
- `aiAssist.controller.js`: `req.user.user_id || req.user.id` (hotfix VPS già applicato)
- `NotificationsSettingsPage`: anteprima/invio NC solo dopo salvataggio config (`config.exists`)
- `StorageContext`: niente warn schema durante reset logout
- `ChecklistModule`: rimosso warn prematuro NC/OSS senza note

**Verifica**: build app OK; health API VPS OK; deploy Netlify da `main` (~2 min).

---

## Backlog (prossime sessioni)
1. **Dismettere ambiente test isolato** `/var/www/sgq-backend-test` quando non più necessario
2. **Batch upload WPS** (nessun endpoint, bassa priorità)
3. **Hardening RBAC welding** (assertCompanyRead mancante, media priorità)
4. **MT/PT/UT**: sezioni parametri specifiche + template Word
5. **Foto offline**: upload asincrono per cantieri senza WiFi
