# DEPUTYTASK — stato al 25/06/2026

## Sessione CHIUSA — Note checklist senza esito (TEST OK, PR #166)

**Sintomo**: audit FP Modena **QS-260611-01** — punti 7.1.5.1/7.1.5.2 con allegati sul server ma note dettate vuote al refresh.

**Causa**: sync checklist escludeva domande senza esito (C/NC/OSS/…); dettatura prima del click esito restava solo in locale.

**Fix** (PR **#166** → merge su `main`):
- `extractChecklistResponses`: include note non vuote anche senza status
- `enqueueResponseEvent` + `ChecklistModule`: eventi su note; `response_set` con `conformity_status: null`
- CI: smoke DB anche su PR `app/**`
- `docs/GUIDA_CONSOLIDATA.md`: diagnosi QS-260611-01

**Verifica**: Vitest mirato 24/24 OK; CI PR verde; deploy Netlify automatico da `main` (~2 min).

**Azione utente**: Camellini ricompila manualmente note 7.1.5.1/7.1.5.2 (dati persi non recuperabili). Allegati già presenti.

---

## Backlog (prossime sessioni)
1. **Dismettere ambiente test isolato** `/var/www/sgq-backend-test` quando non più necessario
2. **Batch upload WPS** (nessun endpoint, bassa priorità)
3. **Hardening RBAC welding** (assertCompanyRead mancante, media priorità)
4. **MT/PT/UT**: sezioni parametri specifiche + template Word
5. **Foto offline**: upload asincrono per cantieri senza WiFi
