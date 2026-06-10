# DEPUTYTASK — Qualifiche: company_id obbligatorio (ambito azienda) — 10/06/2026

**Stato:** TEST OK — Completato (PR `cursor/qualifiche-company-scope-9647`)

---

## Obiettivo

Garantire che ogni certificato/qualifica appartenga a **una sola azienda cliente**, allineato al pattern del registro documenti.

## Implementato

| Area | File / azione |
|------|----------------|
| Service API | `backend/src/services/qualificationCompany.service.js` |
| Controller | `qualifications.controller.js`, `importJobs.controller.js` |
| UI | `qualificationsCompanyScope.js`, `QualificationsPage.jsx`, `QualificationForm.jsx` |
| DB | `database/migrations/087_qualifications_company_required.sql` + `run-migration-087-vps.js` |
| Test L1 | `qualificationsCompanyScope.test.js`, `qualificationCompany.service.test.js` |

## Post-merge (desktop / VPS)

1. `node backend/scripts/run-migration-087-vps.js` su VPS (dopo scp)
2. Deploy backend + restart `sgq-backend`
3. Hard-refresh PWA Netlify

---

Leggi questo file ed eseguilo solo se lo stato non è già TEST OK.
