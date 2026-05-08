# Task per delega (Cursor desktop ↔ web)

## Scopo

Allineare **due sessioni** (es. desktop e web) **senza** un canale diretto tra gli agenti: la **fonte di verità** è **GitHub** (file nel repo + branch + Pull Request).

## Come usarlo

1. **Chi prepara il task** (di solito sessione desktop): crea o aggiorna un file `CASE_STUDY_*.md` o `TASK_*.md` in questa cartella con obiettivo, vincoli, criteri di completamento e branch suggerito. Esempio numerazione audit Mason: `TASK_AUDIT_NUMBER_MASON_FORMAT.md`.
2. **Chi delega su Cursor web** (solo quando serve): incolla un prompt breve che **punta al file** (vedi sezione “Prompt pronto” dentro ogni case study).
3. **Restituzione risultati**: commit sul branch indicato + **PR verso `main`** (mai push forzato su `main` senza review consapevole).
4. **Verifica**: tab **Checks** sulla PR — workflow `.github/workflows/ci-app-pr.yml` (test + build `app/`). Netlify Deploy Preview è complementare.

## Stabilità del progetto

- Non introdurre segreti nel repo.
- Preferire **PR** per modifiche non banali; merge su `main` solo con CI verde (o rischio documentato).
- Backend/VPS: deploy separato; l’agente web non sostituisce operazioni che richiedono credenziali server.

## Checklist rapida deputy

- Per la revisione rapida del lavoro delegato usare: `docs/agent-tasks/MINI_CHECKLIST_VALIDAZIONE_DEPUTY.md`.
- Per anomalie report cliente Mason (export Word): `docs/agent-tasks/TASK_MASON_REPORT_ANOMALIE_2026-04-20.md`.
- Per audit non visibile in menu Mason (`2026-04`): `docs/agent-tasks/TASK_MASON_AUDIT_2026-04_VISIBILITY_2026-04-20.md`.
