# Stato funzionalità (2026-03-01) — storico, superato

> Estratto da `PROJECT_CONTEXT.md` il 13/08/2026 (dieta harness).
> **Non usare** per «a che punto siamo». Fonte corrente: [PROJECT_ROADMAP.md § Stato attuale e priorità](../PROJECT_ROADMAP.md#stato-attuale-e-priorità-fonte-unica).

Traccia di come è partito il progetto (audit/checklist/Word/sync a marzo 2026). I moduli successivi (Saldatura, Qualifiche v2, SAL, Alert, Registro obblighi, Material Compliance, ecc.) non sono in questo file.

## Completate (2026-03-02)

| Funzionalità | Commit | Note |
|---|---|---|
| Auth JWT cookie (login/register/refresh) | — | httpOnly, SameSite=None |
| Gestione audit CRUD multi-tenant | — | |
| Checklist ISO 9001:2015 (35 domande, id 87-121) | migration-010 | standard_id=1 |
| Checklist ISO 14001:2015 (46 domande, id 122-167) | migration-012 | standard_id=2, sezioni `14001_s4`/`14001_s5` |
| Risposte conformità (C/NC/OSS/OM/NA/NV) | — | CHECK constraint fisso in DB |
| Non conformità CRUD | — | |
| Allegati upload/download/preview/replace/delete | `0520182` | fetch blob + URL.createObjectURL (NON img src) |
| Export Word (template-based) ISO 9001 | `975ed3e` | Template editabile in Word |
| Logo nel report Word | `57aabcf` | File template committato |
| Rilievi pendenti tra audit | migration-018 | tabella `pending_issues`, FK NO ACTION |
| `check-reaudit` API + UI selector | — | deployato su VPS |
| Sync offline-first (IndexedDB → server) | — | standard_id intero (fix `9894ed5`) |
| Fix 4 bug selezione standard | `9894ed5` | norms→selectedStandards, accordion _2015, standard_id |
| Manuale Utente v1.1 | `5fec508` | `docs/MANUALE_UTENTE.md` |

## Multi-standard (marzo 2026)

| Standard | DB | Frontend | Sync | Export Word |
|---|---|---|---|---|
| ISO 9001:2015 | sì | sì | sì | sì |
| ISO 14001:2015 | sì | sì | sì (fix `9894ed5`) | backlog |
| ISO 45001:2018 | sì (id 276-328) | sì | no a quella data | backlog |

## Backlog Fase 2 (marzo 2026, non aggiornato)

Voci storiche (export Word 14001, rilievi in Word, modal re-audit, auth mobile ADR-004, sync allegati). Verificare in roadmap se una voce è ancora aperta prima di lavorarla.
