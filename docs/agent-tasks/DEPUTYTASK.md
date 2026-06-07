# DEPUTYTASK — Accesso VPS Windows permanente (no SGQ_SSH_KEY_B64)

**Stato:** ✅ TEST OK — chiuso il 07/06/2026

**Task:** Evitare che l'agente locale si blocchi con *"SGQ_SSH_KEY_B64 vuota"* e debba passare al Cloud Agent per query/deploy sul VPS.

**Cosa fatto:**
- Script `backend/scripts/vps-preflight.ps1`, `run-on-vps.ps1`, modulo `lib/vps-ssh.ps1` (PuTTY + `.ssh-deploy.local.ps1`).
- Regole agente: `sgq-operating-memory.mdc`, `sgq-sysadmin.mdc` — Windows prima di cloud secrets.
- Doc: `ACCESSO_DEPLOY_AGENTS.md`, `GUIDA_CONSOLIDATA.md`, `.ssh-deploy.local.ps1.example`.
- Fix health check in `deploy-controllers-to-vps.ps1` (PowerShell 5.1).

**Verifica L3 (PC committente, 07/06/2026):**
- PuTTY + `.ssh-deploy.local.ps1` → `plink` `FUNZIONA`
- `vps-preflight.ps1` → `VPS_ACCESS_OK`
- `deploy-controllers-to-vps.ps1` → deploy + backend `active (running)`, health API 200
- `run-on-vps.ps1 -Command hostname` → `fr-sql1`

**Setup utente richiesto (già completato):** `backend/config/.ssh-deploy.local.ps1` gitignored + `RemoteSigned` execution policy.

**Commit:** (questa sessione) su `main`.
