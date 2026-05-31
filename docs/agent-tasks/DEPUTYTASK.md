# DEPUTYTASK — RBAC Fase 2 (chiuso)

**Stato:** CHIUSO — **TEST OK** (31/05/2026)  
**Branch:** `feat/rbac-phase-2-nc-attachments-registry`  
**PR:** #76 (merge su `main` in chiusura sessione)

## Esito

RBAC Fase 2: scope studio su write path audit, NC, allegati e document registry. Jest L1 **22/22**. Smoke L3 a fette (`.cursor/rbac-smoke-l3-phase2.mjs`) — slice audit + nc **TEST OK**.

## Riferimenti

| Voce | Dettaglio |
|------|-----------|
| Architettura | [ARCHITETTURA_UTENTI_RBAC.md](../ARCHITETTURA_UTENTI_RBAC.md) sez. 5–7 |
| Smoke L3 | `node .cursor/rbac-smoke-l3-phase2.mjs --slice=all --keep-data` |
| Cleanup | `node .cursor/rbac-smoke-l3-phase2.mjs --cleanup` |
| Esperienza | `GUIDA_CONSOLIDATA.md` — Esperienza 31/05/2026 RBAC Fase 2 |

## Prossimo task

**Lead committente:** Fase 3 backlog RBAC / hardening attach+registry in smoke, oppure priorità roadmap corrente.

## Comando deputy (archivio)

```
Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```