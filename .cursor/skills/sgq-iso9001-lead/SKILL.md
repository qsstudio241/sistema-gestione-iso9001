---
name: sgq-iso9001-lead
description: >-
  Operates on the "Sistema Gestione ISO 9001" codebase (React PWA, Node API,
  SQL Server multi-tenant, Netlify). Loads PROJECT_CONTEXT, PROJECT_ROADMAP,
  GUIDA_CONSOLIDATA, and docs/agent-tasks briefs; respects L1–L5 test pyramid,
  sgq-operating-memory rules, no secrets in repo, Italian explanations for the
  committer. Use when the user works on ProgettoISO, SGQ, ISO 9001/14001/45001
  checklists, Word export, document registry, licenses, auth, RBAC, smoke
  checklists, Netlify preview, or delegated agent-tasks.
---

# Lead — Sistema Gestione ISO 9001

## All’avvio (sempre, prima di codice o commit)

1. Leggere in ordine: `PROJECT_CONTEXT.md` (root) → `docs/PROJECT_ROADMAP.md` → `docs/GUIDA_CONSOLIDATA.md` (in particolare *Piano qualità* / piramide L1–L5 e smoke).
2. Leggere `.cursor/rules/sgq-operating-memory.mdc` per approvazione, chunking, terminale, sicurezza.
3. Per incarichi delegati: il brief è in **`docs/agent-tasks/*.md`** indicato dall’utente — è la fonte di verità per scope e DoD.

Non creare nuovi `SESSION_NOTES_*.md` in root: aggiornare `GUIDA_CONSOLIDATA` e/o `PROJECT_ROADMAP` se cambia una procedura ripetibile.

## Lingua e pubblico

- Rispondere **sempre in italiano**, in modo chiaro (il committente lavora soprattutto a prompt, competenze di codice limitate).
- Non dare per scontati termini interni senza una riga di contesto quando serve.

## Robustezza e qualità

- **Multi-tenant / sync / offline**: non bypassare scope organizzazione o pattern esistenti; per RBAC vedere `docs/ARCHITETTURA_UTENTI_RBAC.md` se il task tocca permessi.
- **Piramide test** (`GUIDA_CONSOLIDATA`): dopo modifiche a `app/`, eseguire almeno **L1** (`NODE_ENV=test` → `npm run test:run`, poi `npm run build` dalla directory `app/`). Non dichiarare chiusi smoke **manuali** (L3/L4) senza evidenza in tabella (OK/KO, data, note anonime).
- **Chunking**: una slice verticale alla volta (diagnosi → fix minimo → test → doc se serve); non mescolare migrazione DB, refactor ampio e smoke umani nella stessa consegna senza tappa intermedia.

## Sicurezza

- **Mai** segreti in repository, commit, checklist o chat (password DB, JWT, token). Usare ciò che è già documentato in guida (file locali gitignored, variabili ambiente, vault).

## Approvazione preventiva (solo eccezioni)

Chiedere conferma esplicita al committente **solo** se: breaking change API/schema senza piano; migrazioni o dati produzione sensibili; auth/sicurezza che cambia modello minaccia; purge irreversibile; decisione commerciale non in doc; credenziali solo umane.

Per documentazione, checklist, allineamenti roadmap/guida e fix mirati con test esistenti: procedere in autonomia entro le regole sopra (allineato a `sgq-operating-memory.mdc`).

## Git e deleghe

- Lavoro non banale: branch dedicato; preferire **PR** verso `main` con CI dove previsto (`.github/workflows/ci-app-pr.yml` su path `app/**` e correlati).
- Dopo il **primo push** di un branch, aprire/subito creare la PR se il contenuto non è ancora su `main` (evita branch “orfani” senza differenza da mergiare).
- **GitHub CLI** (`gh`): se disponibile nel PATH, usabile per PR/status; altrimenti push + link compare dal sito.

## Output utile

- Per modifiche: riepilogo breve *cosa / perché / rischi residui*.
- Per smoke: distinguere sempre **L1 automatico** vs **verifica umana** ancora da fare.
