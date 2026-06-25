# DEPUTYTASK — stato al 25/06/2026

## Sessione CHIUSA — Rate limit Assistente AI Conclusioni (TEST OK + RILASCIO PRODUZIONE)

**Sintomo**: Camellini vede "Troppe richieste. Riprova tra qualche minuto." nel modal **Assistente AI — Conclusioni** ("Migliora bozza").

**Causa**: rate limiter generico API (`RATE_LIMIT_API`), non limite provider AI. Il `keyGenerator` leggeva `id`/`sub` nel JWT invece di `user_id` → tutti gli utenti dietro lo stesso IP condividevano un bucket (500 req/15 min).

**Fix** (PR **#164** mergiata su `main`):
- `backend/src/server.js`: bucket per `user_id` JWT
- `app/src/hooks/useAiAssist.js`: messaggio 429 più chiaro
- `backend/deploy-production.ps1`: `RATE_LIMIT_MAX_REQUESTS=1000`
- `docs/GUIDA_CONSOLIDATA.md`: nota diagnosi

**Stato produzione (25/06/2026)**:
- VPS: `server.js` deployato, `.env` `RATE_LIMIT_MAX_REQUESTS=1000`, restart PID verificato, health 200
- Frontend: Netlify da `main` (messaggio UI migliorato dopo deploy Netlify ~2 min)
- CI PR #164: verde (Vitest + smoke DB)

**Verifica utente**: Camellini riapre Assistente AI Conclusioni; se 429 residuo → attendere 15 min o chiudere schede duplicate.

---

## Backlog (prossime sessioni)
1. **Dismettere ambiente test isolato** `/var/www/sgq-backend-test` quando non più necessario
2. **Batch upload WPS** (nessun endpoint, bassa priorità)
3. **Hardening RBAC welding** (assertCompanyRead mancante, media priorità)
4. **MT/PT/UT**: sezioni parametri specifiche + template Word
5. **Foto offline**: upload asincrono per cantieri senza WiFi
