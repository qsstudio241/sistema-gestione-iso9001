# DEPUTYTASK — Collegamento anagrafica personale ↔ qualifiche — 10/06/2026

**Stato:** TEST OK — Completato e operativo (PR #107 → `main`, deploy 10/06/2026)

---

## Obiettivo

Collegare `company_personnel` e `qualifications` via `personnel_id`, con tipi salute mansione ISO 3834 e UI import/link/pannello certificati.

## Implementato (slice A–D)

| Area | File / azione |
|------|----------------|
| DB | `database/migrations/088_qualifications_personnel_link.sql` + `run-migration-088-vps.js` |
| Service | `backend/src/services/personnelQualificationLink.service.js` |
| API | `companyPersonnel.controller.js`, `qualifications.controller.js`, `company.routes.js` |
| Tipi salute | `occupationalQualificationTypes.js` (backend + frontend) |
| UI qualifiche | `QualificationsPage.jsx` (tab Salute mansione), `QualificationForm.jsx` (picker) |
| UI personale | `CompanyPersonnelPanel.jsx` (import, link, modal certificati) |
| Test L1 | `personnelQualificationLink.test.js` |

## Deploy eseguito (cloud agent 10/06/2026)

- PR [#107](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/107) mergiata su `main`
- Migration 088 su VPS: OK (5 batch)
- Backend deploy + restart PID 568473, health API 200
- Netlify produzione: tab Salute mansione + API import/link attive nel bundle

---

Leggi questo file ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
