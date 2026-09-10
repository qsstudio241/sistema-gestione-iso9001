# DEPUTYTASK — Alert qualifiche: destinatario UI (Alert #3)

**Stato:** CHIUSO
**Aperto:** 07/09/2026 (post CM-5; priorità roadmap #2 post ISO-5b)
**Chiuso:** 10/09/2026 — PR [cursor/alert-personnel-roles-717c]
**Rischio:** Medio (UI+API additiva, nessun tocco a auth/RBAC/sync)

---

## Decisioni HITL applicate

1. **Destinatario esplicito** (opzione A): picker nella scheda personale azienda.
2. **Scope:** solo qualifiche in questa slice.
3. **Lista:** flag `QUAL_ALERT_RECIPIENT` in `personnel_roles`; tutte ricevono (prima come To, altre in CC).
4. **Fallback:** cascata attuale `resolveWeldingCoordinatorRecipients` se nessun record attivo.
5. **Tabella `personnel_roles`**: additiva, nessuna FK SQL esterna.

---

## File toccati

| File | Tipo modifica |
|------|--------------|
| `database/migrations/166_personnel_roles.sql` | NUOVO — CREATE TABLE idempotente + 2 indici |
| `backend/src/controllers/companyPersonnel.controller.js` | ADD — listPersonnelRoles, addPersonnelRole, removePersonnelRole |
| `backend/src/routes/company.routes.js` | ADD — 3 route GET/POST/DELETE roles |
| `backend/src/services/qualificationAlert.service.js` | MOD — STEP 0 personnel_roles prima della cascata |
| `app/src/services/apiService.js` | ADD — getPersonnelRoles, addPersonnelRole, removePersonnelRole |
| `app/src/components/CompanyPersonnelPanel.jsx` | MOD — colonna Ruoli, badge blue, dropdown, rimozione inline |

## Cosa NON toccare (invariato)

- CONS-7 / auth offline
- ING-5 / VC-5 / Compliance Map
- SB-2 (slot DEPUTYTASK2)
- Scheduler cron nuovi
- Migrazioni esistenti (165 e precedenti)

## Esito

TEST OK — 247 file, 1629 test verdi · build Vite OK
