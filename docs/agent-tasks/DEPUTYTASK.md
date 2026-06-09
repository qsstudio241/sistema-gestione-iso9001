# DEPUTYTASK — Modulo Qualifiche v2 (architettura consolidata) — 09/06/2026

**Stato:** IN ESECUZIONE

---

## Contesto e decisioni di prodotto prese

### Architettura UI: schede separate specializzate
- `/qualifiche` ha **tab per tipo** di qualifica, ognuna con griglia e colonne specifiche
- Tipi: Saldatori (ISO 9606-1/2), Operatori (ISO 14732), NDT (ISO 9712), Coordinatori (ISO 14731), Abilitazioni (PES/PAV), Generiche
- Ogni tab ha export dedicato (Excel) → per audit DNV/RINA/TÜV
- **Non** una griglia ibrida: ogni tipo ha le proprie colonne rilevanti

### Vista "Copertura Commessa" (separata)
- Pulsante nel modulo Riesame Requisiti (`/contract-reviews`) e in Commesse (`/saldatura/commesse`)
- Query incrociata: qualifiche personale + WPS/WPQR vs requisiti commessa → tabella gap evidenziati
- Questa è la F4 automatizzata del riesame §8.2.3

### Flusso operativo
1. Azienda cliente carica PDF certificato → **import batch AI** (pattern `import_jobs`)
2. AI estrae campi specializzati per tipo di qualifica
3. Record creato con `approval_status = 'bozza'`
4. **Coordinatore di saldatura** approva → `approval_status = 'approvata'` → diventa attiva
5. Scadenzario esistente gestisce gli alert
6. Rinnovo = **nuovo record** con `previous_qualification_id` FK → storico completo

### Multi-tenant
- `organization_id` = tenant (Studio Mason)
- `company_id` = azienda cliente (MANITOU, Camellini...)

---

## Slice di implementazione

| # | Slice | Stato |
|---|-------|-------|
| 1 | Migration 084 — Estensione `qualifications` | ☐ |
| 2 | Migration 085 — `projects` versionata + FK handoff | ☐ |
| 3 | Backend qualifiche: approve/reject/renew/coverage + NDT types | ☐ |
| 4 | Backend project_welders: POST/DELETE endpoints | ☐ |
| 5 | Import batch AI — tipo `qualification` | ☐ |
| 6 | Frontend QualificationsPage schede specializzate | ☐ |
| 7 | Vista Copertura Commessa | ☐ |
| 8 | Deploy VPS + smoke test | ☐ |

---

## Schema DB (riferimento)

### Migration 084 — Estensione `qualifications`
Colonne aggiunte (idempotente, `IF NOT EXISTS COL`):
- `previous_qualification_id`, `approval_status`, `approved_by`, `approved_at`, `rejection_reason`, `certificate_file_url`
- Saldatori: `welding_process`, `joint_type`, `material_group`, `thickness_range`, `pipe_diameter`, `position_range`, `filler_material`, `shielding_gas`, `equipment_type`
- NDT: `ndt_method`, `ndt_level`, `ndt_sector`, `certification_scheme`
- Coordinatori: `coordinator_title`, `diploma_number`, `cpd_valid_until`
- PES/PAV: `patent_type`, `training_body`
- Generico: `course_name`, `training_hours`, `examiner_body`

### Migration 085 — projects + FK
- Verifica esistenza `projects`, `project_welders`
- Aggiunge `commercial_case_id` FK a `commercial_cases`
- Aggiunge `previous_qualification_id` FK su `qualifications`

---

## Regole operative
- PowerShell: usa `;` non `&&`
- Idempotenza obbligatoria per tutte le migration
- Riusa componenti esistenti: griglia standard, `useAttachmentManager`, RBAC `organization_id`
- RBAC: rispetta `organization_id` scope su tutti gli endpoint
- Commit per ogni slice completata
- Fermati e segnala se: credenziali mancanti, schema DB inatteso, breaking change non previsto

Workspace: `G:/Il mio Drive/Sistema Gestione ISO 9001/`
