# PROJECT CONTEXT — SGQ ISO 9001

> Orientamento rapido per l'agente. **Non** è un inventario di tutti i file.
> **Stato e priorità ORA**: [docs/PROJECT_ROADMAP.md § Stato attuale e priorità](docs/PROJECT_ROADMAP.md#stato-attuale-e-priorità-fonte-unica)
> **Esperienza** (deploy, Word, sync): [docs/GUIDA_CONSOLIDATA.md](docs/GUIDA_CONSOLIDATA.md) — aprire **solo la sezione** del task.
> **RBAC**: [docs/ARCHITETTURA_UTENTI_RBAC.md](docs/ARCHITETTURA_UTENTI_RBAC.md) · **Alert/tipi doc**: [docs/AGENT_ALERTS_AND_DOC_TYPES.md](docs/AGENT_ALERTS_AND_DOC_TYPES.md)
> Dettaglio: [docs/README.md](docs/README.md) · [DB](docs/reference/DATABASE.md) · [API](docs/reference/BACKEND_API.md) · [Deploy](docs/how-to/deploy.md)

---

## Harness (Cursor Lead / Deputy)

[ADR-015](docs/adr/ADR-015-cursor-lead-deputy-workflow.md): Lead pianifica (`DEPUTYTASK*.md`); Deputy esegue slice + test L1 + PR.
Epic > 1 sessione: [`.cursor/skills/wayfinder-sgq/SKILL.md`](.cursor/skills/wayfinder-sgq/SKILL.md). Slice non chiusa: [`HANDOFF_TEMPLATE.md`](docs/agent-tasks/HANDOFF_TEMPLATE.md).
AI runtime prodotto: [ADR-010](docs/adr/ADR-010-ai-agentic-architecture.md). UI: [`app/src/design-system/README.md`](app/src/design-system/README.md).

---

## Cos'è il progetto

PWA offline-first per audit e SGQ ISO 9001:2015 (PMI italiane, multi-tenant su `organization_id`). Standard attivi: 9001 / 14001 / 45001; saldatura ISO 3834 in produzione.

**Checkout locale:** preferire disco reale (`C:\Dev\ProgettoISO` se c'è). Evitare Google Drive streaming (letture tool vs git disallineate). Fonte Git: `origin/main`. Dettaglio percorsi in [GUIDA](docs/GUIDA_CONSOLIDATA.md).

---

## Stack e produzione (minimo)

| Layer | Tecnologia |
|---|---|
| Frontend | React 18, Vite, PWA → Netlify da `main` |
| Offline | IndexedDB; sync `server-wins` su campi critici ([ADR-008](docs/adr/ADR-008-event-sourcing-sync.md)) |
| Backend | Node 20, Express; VPS `sistemi.fr-busato.it` porta 3000 → HTTPS 8443 |
| DB | SQL Server `SGQ_ISO9001` |
| Auth | JWT cookie httpOnly; mobile localStorage ([ADR-004](docs/adr/ADR-004-mobile-auth-localstorage.md)) |
| HTTP | solo Axios `withCredentials` — vietato `fetch` diretto |
| GitHub | `qsstudio241/sistema-gestione-iso9001` |

Deploy/SSH: [how-to/deploy.md](docs/how-to/deploy.md) + [ACCESSO_DEPLOY_AGENTS.md](docs/how-to/ACCESSO_DEPLOY_AGENTS.md). Backend sul VPS: `/var/www/sgq-backend` (copia, non clone). Restart: script `deploy-to-vps.sh` / `deploy-controllers-to-vps.ps1` + verifica PID.

---

## Bussola moduli

> Indice telefonico, non albero del repo. **Aggiornare solo** se nasce/si rinomina/sposta un modulo (stessa PR). Bugfix su file già in tabella: non toccare. Path in backtick = devono esistere (`node backend/scripts/check-harness-boot.js`).

<!-- MODULE_COMPASS_BEGIN -->

| Se lavori su… | Apri prima |
|---|---|
| Audit / checklist / sync | `backend/src/controllers/audit.controller.js`, `app/src/services/syncService.js`, `app/src/contexts/StorageContext.jsx`, `docs/adr/ADR-008-event-sourcing-sync.md` |
| Non conformità | `backend/src/controllers/nc.controller.js`, `app/src/pages/NCPage.jsx`, `app/src/components/NcDetailPanel.jsx` |
| Qualifiche / alert patentini | `backend/src/controllers/qualifications.controller.js`, `backend/src/services/qualificationAlert.service.js`, `app/src/pages/QualificationsPage.jsx`, `app/src/pages/QualificationForm.jsx` |
| Saldatura WPQR / WPS | `backend/src/controllers/welding.controller.js`, `backend/src/services/wpsGenerator.service.js`, `app/src/pages/WeldingProceduresPage.jsx` |
| Welding Book | `backend/src/controllers/weldingBooks.controller.js`, `app/src/pages/WeldingBooksPage.jsx` |
| Commesse ISO 3834 | `backend/src/controllers/projects.controller.js`, `app/src/pages/ProjectsPage.jsx` |
| ISO 3834 (completezza / processi) | `docs/agent-tasks/PLAN_3834_SLICES.md`, `docs/gap-reports/GAP_RDP_3834_2026-08-15.md`, `app/src/pages/WeldingDashboardPage.jsx`, `backend/src/controllers/rdp.controller.js` |
| SAL / gap requisiti | `backend/src/services/gapAnalysis.service.js`, `app/src/pages/SALModule.jsx`, `docs/specs/MODULO_SAL_SCOPO_E_ROADMAP.md` |
| Profilo azienda / company_profile | `docs/adr/ADR-018-company-profile-conformita-legislativa.md`, `docs/specs/COMPANY_PROFILE_CAMPI_E_TEMPLATE_EXCEL.md`, `backend/src/controllers/company.controller.js`, `backend/src/services/moduleLicense.service.js`, `app/src/pages/CompanyDetailPage.jsx` |
| Anagrafiche aziende | `backend/src/controllers/company.controller.js`, `app/src/pages/AnagrafichePage.jsx`, `app/src/pages/CompanyDetailPage.jsx` |
| Personale azienda | `backend/src/controllers/companyPersonnel.controller.js`, `docs/adr/ADR-012-company-personnel-anagrafica.md` |
| Registro documenti / scadenze | `backend/src/controllers/document.controller.js`, `app/src/components/DocumentRegistry.jsx`, `app/src/pages/DeadlinesPage.jsx` |
| Riesame di direzione | `backend/src/controllers/managementReviews.controller.js`, `app/src/pages/ManagementReviewsPage.jsx` |
| Riesame requisiti / contratto | `backend/src/controllers/contractReview.controller.js`, `app/src/pages/ContractReviewPage.jsx` |
| Ingest AI / import PDF | `backend/src/controllers/ingestStaging.controller.js`, `backend/src/data/documentTypeSchemas.js`, `app/src/data/documentTypeSchemas.js` |
| Auth / RBAC | `backend/src/middleware/auth.middleware.js`, `backend/src/controllers/auth.controller.js`, `app/src/contexts/AuthContext.jsx` |
| Alert / notifiche | `backend/src/controllers/alert.controller.js`, `backend/src/controllers/notifications.controller.js`, `app/src/pages/NotificationsSettingsPage.jsx` |
| Export Word verbale audit | `app/src/utils/wordExport.js`, `app/src/utils/wordExportHelpers.js` |
| UI / design system | `app/src/design-system/README.md`, `docs/reference/LIBRERIA_UI_SGQ.md` |
| Deploy VPS | `docs/how-to/deploy.md`, `backend/scripts/deploy-to-vps.sh`, `docs/how-to/ACCESSO_DEPLOY_AGENTS.md` |
| Material Compliance (epic) | `docs/specs/MODULO_MATERIAL_COMPLIANCE_AI.md`, `docs/specs/MATERIAL_COMPLIANCE_DATA_MODEL.md`, `docs/specs/MATERIAL_COMPLIANCE_UI.md`, `docs/specs/MATERIAL_COMPLIANCE_API.md` |
| Rischi / opportunità / obiettivi | `app/src/pages/RisksPage.jsx`, `backend/src/controllers/risks.controller.js`, `docs/specs/PROCESSO_ANALISI_RISCHI_OPPORTUNITA.md`, `docs/specs/M03_ANALISI_RISCHI_OPPORTUNITA.md`, `docs/agent-tasks/PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md` |

<!-- MODULE_COMPASS_END -->

---

## Regole operative critiche

1. Flusso end-to-end: nuovi campi su frontend **e** backend (persistenza, API, sync).
2. Prima di modificare backend: leggere il controller/route esistente.
3. `conformity_status`: `'C', 'NC', 'OSS', 'OM', 'NA', 'NV', NULL`.
4. `question_type` DB: `'TEXT'`, `'YES_NO'`, `'MULTIPLE_CHOICE'` (MAIUSCOLO).
5. `audit.status` DB: `'draft'`, `'in_progress'`, `'completed'`, `'approved'` (minuscolo).
6. Credenziali mai in repo. HTTP solo Axios.
7. Word: marker `CHECKLIST_MARKER` / `RILIEVI_MARKER`; `replaceMarker()` non deve matchare `<w:pPr>`. Dettaglio in GUIDA se il task è Word.

Storico marzo 2026 (non per lo stato attuale): [archive](docs/archive/PROJECT_CONTEXT_STATO_FUNZIONALITA_2026-03.md).
