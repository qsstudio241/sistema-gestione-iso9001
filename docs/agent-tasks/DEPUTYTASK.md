# DEPUTYTASK — Audit server-first aggressivo (chiuso)

**Branch:** `cursor/audit-aggressive-server-first-7698`  
**Stato:** TEST OK — merge su `main` in corso dall'agente cloud

## Comando deputy (storico)

```
Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```

## Obiettivo (completato)

Policy **server-first aggressiva** per il menu audit: purge automatica della cache IndexedDB allineata al server, senza dipendere dal pulsante «Svuota cache».

## Cosa è stato fatto

| Area | Comportamento |
|------|----------------|
| `reconcileAuditsFromServer` | Se GET /audits OK e lista vuota → purge fantasma; solo bozze `isIntentionalDraft` |
| Post-merge | `purgeStaleAuditsFromDevice` + `persistFinalAuditsToIndexedDB` (clear store + rewrite) |
| Rimosso | Bug 5 Fix B (ripristino audit corrente da cache locale) |
| `loadAuditsFromIndexedDB` | Online+JWT: no fallback a tutta la cache se download fallisce |
| Login | `processQueue` → `clearAuditsStore` → reconcile |
| Mobile | `visibilitychange` / `pageshow` invariati (PR #74) |

## Verifica utente

1. Hard refresh PWA (`https://systemgest.netlify.app`) dopo deploy Netlify (~2 min da merge `main`).
2. Logout → login (oppure riapri app in primo piano su mobile).
3. I fantasma eliminati sul server non devono più comparire; restano solo bozze offline intenzionali.

## Test L1

`NODE_ENV=test node node_modules/vitest/vitest.mjs run src/tests/storageContext.dedup.test.js` — 17/17 OK.
