# DEPUTYTASK — Anagrafica Personale Azienda + RBAC Fase 4

**Stato:** TEST OK — hotfix viewer + **RBAC Fase 4** (02/06/2026)  
**Piano personale:** [TASK_PERSONALE_AZIENDA_SLICES.md](TASK_PERSONALE_AZIENDA_SLICES.md)  
**Piano RBAC:** [TASK_RBAC_FASE4_SLICES.md](TASK_RBAC_FASE4_SLICES.md)  
**ADR:** [ADR-012](../adr/ADR-012-company-personnel-anagrafica.md)

## Completato

| Slice | Commit | Note |
|-------|--------|------|
| NC rubrica-only | `4a999f2` | Responsabile NC solo select |
| S1 schema | `64925cb` | ADR-012 |
| S2+S3 backend | `a80fecb` | Migration 078 + API CRUD, Jest 11/11 |
| S4 scheda azienda | `90e13dc` | Route `/companies/:id`, tab Anagrafica + Personale |
| S5 griglia CRUD | `15cc73c` | `CompanyPersonnelPanel` + API personnel |
| VPS deploy 078 | `35d865b` | Migration 078 prod; health OK |
| Hotfix viewer | `7042532` | CRUD personale bloccato per viewer studio |
| RBAC Fase 4 | `99c6803` | Migration 081 `user_company_access` |
| VPS deploy RBAC 081 | *(sessione corrente)* | Migration prod + deploy + link test users |
| S6 API overview | `3829f92` / `a3a1cd1` | `GET /api/v1/personnel?company_id=` |
| Doc deploy 081 | `267b94f` | UTF-8 task + nota GUIDA |

## Prossima slice

**S6** — Overview studio personale con filtro ambito (pattern registro documenti).

## Gap test 02/06/2026 — chiusi

| Gap | Stato |
|-----|-------|
| Viewer POST personnel → 403 | ✅ |
| UI CRUD personale nascosto per viewer | ✅ |
| Cliente azienda scope singola company | ✅ Fase 4 |
| company_access write/read | ✅ API + test |

## Comando deputy S6

```
Leggi docs/agent-tasks/TASK_PERSONALE_AZIENDA_SLICES.md ed esegui slice S6.
Overview studio: filtro tutte le aziende / singola azienda.
Chiudi con TEST OK o FIX NON APPLICABILI.
```
