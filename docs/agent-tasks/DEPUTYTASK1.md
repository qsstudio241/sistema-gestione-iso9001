# DEPUTYTASK1 — Dieta token doc (harness + progetto)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 06/09/2026  
**Chiuso:** 06/09/2026 (pass 2 incluso)  
**Rischio:** Basso — solo Markdown / rules; niente codice prodotto  
**Branch:** `cursor/doc-token-diet-harness-8269`  
**PR:** [#651](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/651) (draft)  
**Slot precedente:** LUX-A CHIUSO su `origin/main` (sovrascrittura consentita)

## Perché

Video LLM Wiki / Engram: **nessun vault Obsidian in prodotto**. Dieta token su harness Cursor **e** documentazione di progetto (avvio agente).

## Pass 1 — harness (già su branch)

- `AGENTS.md` (−3.3 KB), rules operating-memory/cloud-env, `PLAN_SECOND_BRAIN` (−7.5 KB)
- `PROJECT_CONTEXT` principio KB/Wiki/Engram; GUIDA 1 riga lezione

## Pass 2 — doc di progetto

- `docs/PROJECT_ROADMAP.md` § Stato: **82 → 45 righe** (~12 KB → ~3.3 KB); priorità entro `limit: 45`; sessioni verbose in `<details>`; riga SB → **SB-4**
- `docs/README.md` + `INDICE_DOCUMENTAZIONE.md` + `adr/README.md`: banner dieta / no inject intero
- `GUIDA`: rafforzata riga «Dieta avvio» (sezione già aperta, non file intero)
- `PLAN_SECOND_BRAIN`: non reinflazionato

## Misure avvio obbligatorio (`check-harness-boot`)

| Momento | Bytes |
|---------|------:|
| Prima pass 1 | 28638 |
| Dopo pass 1 | 25595 |
| Dopo pass 2 | **16993** |

## Cosa NON toccato

Codice prodotto AI, auth/sync/migrazioni, GUIDA/roadmap **intere** (solo § Stato + 1 nota GUIDA), `sgq-git-autonomy.mdc`.

## Test

- `node backend/scripts/check-harness-boot.js` OK (49 righe boot slice)
- UTF-8 OK

## Esito

**TEST OK** — pass 1 harness + pass 2 doc progetto; KB=DB; no Obsidian in-app.
