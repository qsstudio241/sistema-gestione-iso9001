# DEPUTYTASK1 — Dieta token harness (doc only)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 06/09/2026  
**Chiuso:** 06/09/2026  
**Rischio:** Basso — solo Markdown / rules; niente codice prodotto  
**Branch:** `cursor/doc-token-diet-harness-8269`  
**Slot precedente:** LUX-A CHIUSO su `origin/main` (sovrascrittura consentita)

## Perché

Video LLM Wiki / Engram: **nessun vault Obsidian in prodotto**. Revisione harness Cursor per meno token all’avvio.

## File toccati

- `AGENTS.md` (−3.3 KB): Cloud/regole → puntatori alle rules
- `PROJECT_CONTEXT.md` (+0.2 KB): principio KB/Wiki/Engram
- `.cursor/rules/sgq-operating-memory.mdc` (−2.3 KB): avvio/git/parallelo → link
- `.cursor/rules/sgq-cloud-agent-env.mdc` (−0.6 KB)
- `docs/agent-tasks/PLAN_SECOND_BRAIN_SLICES.md` (−7.5 KB): stale 16/08 + status SB
- `docs/GUIDA_CONSOLIDATA.md`: 1 riga lezione
- `backend/scripts/check-harness-boot.js`: messaggio alwaysApply

## Cosa NON toccato

Codice prodotto AI (chat, AmbitoFactsBar, SB-4), auth/sync/migrazioni, GUIDA/roadmap intere, `sgq-git-autonomy.mdc`.

## Misure

| Metrica | Prima | Dopo |
|---------|-------|------|
| Avvio obbligatorio (check) | 28638 B | 25595 B |
| alwaysApply kernel (4 file) | 28670 B | 25733 B |
| Somma file tagliati (5) | 44660 B | 31219 B (−13.4 KB) |

## Test

- `node backend/scripts/check-harness-boot.js` OK
- `npm test -- --testPathPattern=check-harness-boot` → 21/21
- `check-utf8-encoding.js` → 0 issues

## Esito

**TEST OK** — dieta rafforzata senza cambio architetturale prodotto.
