# DEPUTYTASK_WPQR_T1T2 — Doppi range t1/t2 + ISO 15614-2

**Stato:** CHIUSO — TEST OK  
**Aperto:** 25/08/2026  
**Chiuso:** 25/08/2026  
**Branch:** `cursor/wpqr-t1t2-15614-2-887f`  
**PR:** [#558](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/558) mergiata  
**Rischio:** Medio — migrazione additiva nullable, ingest/API/UI WPQR, regole 15614-2; niente auth/sync.

## Perché

Mason: FW con t1/t2 distinti persi; alluminio senza 15614-2. PDF consegnati 25/08.

## DoD (tutti OK)

1. Colonne `thickness_t1_*` / `thickness_t2_*` (mig. **158**) + runner VPS — applicata in PROD  
2. Schema FE/BE + mapping ingest + create/update WPQR + form Modifica  
3. `checkThicknessCoverage` con range duali (orientamento o scambio)  
4. Digitalizzazione NORMA_00031 (15614-2) / 00032 (9606-2) + estratto operativo + regole JS Tabella 5/6/7  
5. Select norma WPQR: 15614-1 / 15614-2  
6. Test L1 verdi + deploy backend VPS  

## Lezioni (delta)

1. **t1 ≠ un solo max** — su FW con spessori diversi la norma (15614-1 Tabella 8 nota a) e i verbali richiedono due range; un unico `thickness_min/max` perde dati.  
2. **9606-2 ≠ WPQR** — alluminio WPQR = **15614-2**; 9606-2 è patentino (già in menu qualifiche).  
3. **Commenti JS** — non scrivere `*/` dentro `/* … */` (es. `t1_*/t2_*`): sul VPS Node crasha.  
4. **Sentinel ingest** — nuovi flag `*_max_unlimited` vanno forzati a `false` nel round-trip come `thickness_max_unlimited`.  
5. **Fonti prima delle regole** — PDF in chat → digitalizza (`NORMA_00031`/`00032`) → codifica solo il leggibile.

## Backlog esplicito (non in questa slice)

- Matrice gruppi alluminio Tabella 4  
- Regole complete 9606-2 in JS  

## Rielaborazione t1/t2 (dopo #563)

- Codice mergiato [#563](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/563); backend deploy PROD (PID cambiato, health 200).  
- Superadmin: **Billing → Rielaborazioni disponibili → «Range spessore duali t1/t2 (FW) — WPQR» → Lancia**.  
- Poi in **Saldatura**: conferma proposte nel banner. Niente cron automatico. 

## File toccati

Vedi PR #558 (migrazione 158, ingest, wpsGenerator, form, norme digitalizzate).
