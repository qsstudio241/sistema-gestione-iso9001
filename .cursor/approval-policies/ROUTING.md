# Routing PR — ProgettoISO

> Letto da **PR Routing & Approval** (Cursor Automations) per instradare le PR al reviewer giusto.
> Priorità: una `APPROVAL_POLICY.md` nella directory più prossima ai file modificati vince su questo
> file generale.

## Aree e routing

| Area | Path | Note routing |
|---|---|---|
| Documentazione / governance agente | `docs/**`, `.cursor/rules/**`, `AGENTS.md` | Basso rischio — vedi policy locale |
| Backend controller/service/middleware | `backend/src/**` | Sempre review umana — vedi `backend/src/APPROVAL_POLICY.md` |
| Migrazioni DB | `database/migrations/**` | Sempre review umana, mai approvazione — vedi policy locale |
| Frontend | `app/src/**` | Basso se 1–2 file non sync/auth (vedi `sgq-git-autonomy.mdc`); altrimenti review umana |
| Script deploy/VPS | `backend/scripts/deploy-*`, `backend/scripts/run-migration-*-vps.js` | Sempre review umana — tocca produzione |

## Non fare mai

- Approvare automaticamente una PR che tocca più di un'area con livelli di rischio diversi nello
  stesso diff (regola di declassamento: vale il livello più alto).
- Approvare automaticamente se Bugbot non ha potuto eseguire — nessun segnale non equivale a "pulito".
- Approvare automaticamente PR aperte da fork (comunque non supportato dal trigger di Automations per
  motivi di sicurezza, salvo evento `Pull request merged`).
