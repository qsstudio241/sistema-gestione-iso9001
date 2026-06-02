# DEPUTYTASK — Anagrafica Personale Azienda

**Stato:** TEST OK — slice **S4+S5** completate (02/06/2026)  
**Piano:** [TASK_PERSONALE_AZIENDA_SLICES.md](TASK_PERSONALE_AZIENDA_SLICES.md)  
**ADR:** [ADR-012](../adr/ADR-012-company-personnel-anagrafica.md)

## Completato

| Slice | Commit | Note |
|-------|--------|------|
| NC rubrica-only | `4a999f2` | Responsabile NC solo select |
| S1 schema | `64925cb` | ADR-012 |
| S2+S3 backend | `a80fecb` | Migration 078 + API CRUD, Jest 11/11 |
| S4 scheda azienda | `90e13dc` | Route `/companies/:id`, tab Anagrafica + Personale |
| S5 griglia CRUD | `15cc73c` | `CompanyPersonnelPanel` + API personnel |
| VPS deploy | `35d865b` | Migration 078 prod; health OK; MainPID 376032→380883 |

## Prossima slice

**S6** — Overview studio personale con filtro ambito (pattern registro documenti).

## Comando deputy S6

```
Leggi docs/agent-tasks/TASK_PERSONALE_AZIENDA_SLICES.md ed esegui slice S6.
Overview studio: filtro tutte le aziende / singola azienda.
Chiudi con TEST OK o FIX NON APPLICABILI.
```
