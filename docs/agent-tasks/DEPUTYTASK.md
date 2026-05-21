# DEPUTYTASK — Doc Fase 2 (completato 2026-05-21)

**Stato:** TEST OK

## Eseguito

- Merge Fase 1 su branch `cursor/docs-fase2-structure-adc9`
- Cartelle `docs/how-to/`, `docs/reference/`, `docs/specs/` + README
- Hub [how-to/deploy.md](../how-to/deploy.md) e [how-to/database-migrations.md](../how-to/database-migrations.md)
- Spostati file deploy, DB, mini-spec con stub redirect in `docs/*.md`
- Aggiornati link in GUIDA, PROJECT_CONTEXT, INDICE, ROADMAP, REFERENCE

## Verifica

```bash
test -f docs/how-to/deploy.md
test -f docs/reference/DATABASE_SCHEMA.md
head -1 docs/DEPLOY_CHECKLIST_RELEASE.md | grep -q spostato
```
