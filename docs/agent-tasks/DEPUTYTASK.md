# DEPUTYTASK — Qualifiche: company_id obbligatorio (ambito azienda) — 10/06/2026

**Stato:** TEST OK — Completato e mergiato (PR #106 → `main`, deploy VPS + migration 087 OK 10/06/2026)

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

## Deploy eseguito (cloud agent 10/06/2026)

- Migration 087 su VPS: OK (`company_id NOT NULL`, indice `UX_qualif_org_company_cert_person_active`)
- Backend deploy + health 200
- Frontend: Netlify build automatica su push `main` — hard-refresh PWA

---

Leggi questo file ed eseguilo solo se lo stato non è già TEST OK.
