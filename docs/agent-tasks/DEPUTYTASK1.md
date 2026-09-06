# DEPUTYTASK1 — Gate definitivo merge origin/main prima di push/PR

**Stato:** CHIUSO — TEST OK  
**Aperto:** 06/09/2026  
**Chiuso:** 06/09/2026  
**Rischio:** Basso — solo docs/rules (+ check harness documentale); niente codice prodotto  
**Branch:** `cursor/git-rule-no-update-branch-8269`  
**Slot precedente:** dieta token doc CHIUSO su `origin/main` (sovrascrittura consentita)  
**Parallelo:** `DEPUTYTASK_COMPLIANCE_MAP.md` CM-1 APERTO — **NON toccato** AmbitoFacts / aiChat / codice CM.

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK1.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Perché

Dopo merge PR #652 (brief Compliance Map) GitHub chiede ancora «Update branch»: gli agent aprono la PR al primo push e non mergiano `origin/main` quando main avanza. La policy in `sgq-git-autonomy` già lo dice — **non basta**. Serve gate operativo impossibile da saltare.

## File previsti / toccati

- `.cursor/rules/sgq-git-autonomy.mdc` § Aggiornare branch PR (gate hard)
- `AGENTS.md` § Cursor Cloud
- `docs/agent-tasks/MINI_CHECKLIST_VALIDAZIONE_DEPUTY.md` + `HANDOFF_TEMPLATE.md` (checkbox)
- `backend/scripts/check-harness-boot.js` + `.test.js` — stringa `merge origin/main` + «Update branch»

## Cosa NON toccare

- Codice prodotto CM-1 / AmbitoFacts / Second Brain
- Force-push su `main`

## Esito

- Gate obbligatorio `fetch` + `merge origin/main` prima di ogni push feature e create/update PR / ManagePullRequest
- Vietato esplicito: «Update branch», `git pull` al committente, push/PR «e poi si allinea»
- Dopo merge stack: allineare subito branch OPEN; se PR fallisce / main avanti → merge prima di riprovare
- `node scripts/check-harness-boot.js` OK; Jest `check-harness-boot.test.js` 24/24
