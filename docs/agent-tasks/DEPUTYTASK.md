# DEPUTYTASK — Collegamento anagrafica personale ↔ qualifiche — 10/06/2026

**Stato:** IN CORSO — PR draft su branch `cursor/personnel-qualifications-link-9647`

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

## Post-merge (da eseguire sul VPS)

```bash
scp -P 1122 -i $KEY backend/scripts/run-migration-088-vps.js spascarella@www.fr-busato.it:/tmp/
ssh -p 1122 -i $KEY spascarella@www.fr-busato.it "node /tmp/run-migration-088-vps.js"
backend/scripts/deploy-to-vps.sh
```

---

Leggi questo file ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
