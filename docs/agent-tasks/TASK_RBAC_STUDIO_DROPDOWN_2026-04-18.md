# Task — RBAC studio: dropdown vuoto e visibilità contenuti (2026-04-18)

## Contesto (sintesi)

Segnalazione: più account vedono **tutti** i contenuti; in **Gestione utenti** il menu a tendina **Studio (auditor org)** non offre opzioni.

## Verifica tecnica effettuata

### 1) Dropdown studio senza opzioni

- **Frontend** (`app/src/components/UsersAdminPage.jsx`): le opzioni derivano da `GET /api/v1/auditor-orgs`. In caricamento iniziale era presente `.catch(() => ({ data: [] }))` che **nascondeva qualsiasi errore API** e mostrava lista vuota → solo “— Nessuno —”.
- **Backend** (`backend/src/controllers/auditorOrg.controller.js`): in `listAuditorOrgs` la condizione usava la variabile **`isSuperadmin`**, **non definita** nel file (dovrebbe usarsi `isOrgWideAdmin`, già calcolata). Risultato: **ReferenceError** → risposta **500** per gli admin org-wide che devono vedere tutti gli studi del tenant.

### 2) “Tutti vedono tutti i contenuti”

- Con `users.auditor_org_id` **NULL**, il filtro RBAC per studio sugli audit in `audit.controller.js` **non viene applicato** (condizione `if (!isSuperadmin && auditor_org_id)`). Resta il solo filtro `organization_id` → tutti gli utenti **della stessa organizzazione** senza studio assegnato vedono **tutti gli audit dell’org**.
- Se il dropdown non permette di assegnare lo studio (punto 1), gli utenti restano senza `auditor_org_id` → effetto cumulativo: **nessuna segregazione per studio**.

## Fix già applicati in repository (branch `cursor/fix-auditor-org-list-19a8`)

| Area | Modifica |
|------|----------|
| Backend | `listAuditorOrgs`: `if (isSuperadmin)` → `if (isOrgWideAdmin)` |
| Frontend | Caricamento `getAuditorOrgs` senza mascherare l’errore; messaggio visibile se l’API studi fallisce; lista utenti resta utilizzabile se solo gli studi falliscono |

## Definition of Done per il master / agente desktop

- [x] Merge PR verso `main` dopo CI verde (workflow app su PR). — **Fatto** 2026-04-18 (PR #9 squash → `f0940b9`; PR era in bozza → `gh pr ready` poi merge).
- [ ] **Deploy backend** su VPS: copiare `auditorOrg.controller.js` + restart servizio (vedi `docs/GUIDA_CONSOLIDATA.md` sezione deploy / `deploy-controllers-to-vps.ps1`). — **Da fare sul PC committente**: nell’ambiente agente Cursor non risulta `SGQ_PUTTY_SESSION` né chiave SSH batch; eseguire in PowerShell dalla root repo:
  ```powershell
  $env:SGQ_PUTTY_SESSION = "NOME_SESSIONE_PUTTY"   # come da guida / vault
  .\backend\scripts\deploy-controllers-to-vps.ps1
  ```
- [x] **Deploy frontend** Netlify da `main` — **Automatico** al merge; smoke remoto 2026-04-18: `GET https://systemgest.netlify.app/` → **200** (bundle attuale es. `index-Gntmzb7e.js`). Verificare in dashboard Netlify che l’ultimo deploy da `main` sia *Published*.
- [ ] **Smoke manuale** (L3): login come admin org-wide → **Gestione utenti** → dropdown Studio popolato con gli `auditor_orgs` dell’organizzazione; assegnare uno studio a un utente test → **logout/login** → verificare che la lista audit si limiti allo studio (cfr. matrice RBAC in `GUIDA_CONSOLIDATA.md`). — **Dopo** deploy VPS (senza fix backend l’API può ancora rispondere 500 agli admin org-wide autenticati).
- [ ] **Dati**: se in DB non esistono righe in `auditor_orgs` per l’organizzazione, creare almeno uno studio (o script/migrazione) altrimenti il dropdown resterà vuoto per motivi legittimi.

### Smoke parziale già eseguito (rete, senza login)

| Controllo | Esito | Dettaglio |
|-----------|-------|-----------|
| `GET /api/v1/health` | OK | `status: healthy`, DB OK |
| `GET /api/v1/auditor-orgs` senza cookie | OK | **401** `AUTH_TOKEN_MISSING` (rotta raggiungibile; non testa ancora `listAuditorOrgs` con admin) |
| `GET https://systemgest.netlify.app/` | OK | **200** (su Windows usare `curl.exe --ssl-no-revoke` se schannel segnala errore revoca certificato) |

## Riferimenti

- `docs/ARCHITETTURA_UTENTI_RBAC.md` — scope, Fase 1 allineamento read/write.
- `docs/GUIDA_CONSOLIDATA.md` — tabella problemi sezione A (riga aggiornata su `auditor-orgs`).

## Prompt pronto (delega)

> Leggi e segui `docs/agent-tasks/TASK_RBAC_STUDIO_DROPDOWN_2026-04-18.md`: merge, deploy backend+frontend, smoke dropdown e assegnazione studio.
