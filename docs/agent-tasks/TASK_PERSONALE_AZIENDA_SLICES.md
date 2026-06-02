# TASK — Anagrafica Personale per Azienda (slice verticali)

**Stato:** IN CORSO — S4+S5 completate; prossima slice **S6** (overview studio)  
**Creato:** 02/06/2026  
**Collegamento:** [ADR-012](../adr/ADR-012-company-personnel-anagrafica.md); open point roadmap «NC — rubrica dual-level»

---

## Comando da incollare in nuova chat

```
Leggi in ordine:
1) docs/agent-tasks/TASK_PERSONALE_AZIENDA_SLICES.md
2) docs/PROJECT_ROADMAP.md (open point Personale / NC dual-level)
3) docs/ARCHITETTURA_UTENTI_RBAC.md

Esegui la SLICE indicata sotto (parti da S1 se non specificato).
Una slice alla volta: implementa ? test L1/L2 ? checkpoint ? commit/PR ? attendi OK committente.
Chiudi ogni slice con TEST OK o elenco FIX residui.
```

**Slice corrente consigliata:** `S6` (overview studio con filtro ambito)

---

## Decisione modello (target)

- **Nuova tabella** `company_personnel` (nome, mansione, email opzionale, `company_id`, flag attivo)
- **Bridge** verso `notification_contacts` (email/alert NC) — referenti studio restano rubrica con `company_id` NULL
- **UI:** scheda Azienda ? tab **Personale** (`SgqDataGrid`); overview studio con filtro ambito (pattern registro documenti)

---

## Slice (ordine dipendenze)

| # | Slice | Obiettivo | TEST OK |
|---|-------|-----------|---------|
| S1 | Schema + regole | ADR breve, regole duplicati studio/azienda, GDPR minimo | ? [ADR-012](../adr/ADR-012-company-personnel-anagrafica.md) |
| S2 | Migration DB | `company_personnel` + colonne bridge su `notification_contacts` | ? `078_company_personnel.sql` |
| S3 | API CRUD | `GET/POST/PUT/DELETE /companies/:id/personnel` + RBAC studio | ? Jest `companyPersonnel.controller.test.js` |
| S4 | Scheda azienda | Route `/companies/:id`, tab Anagrafica + Personale | ? Vitest `companyDetailPage.test.jsx` (3 test) |
| S5 | Griglia Personale | CRUD griglia per singola azienda | ? `CompanyPersonnelPanel` + API |
| S6 | Overview studio | Filtro tutte le aziende / singola (Ambito) | Scope come documentRegistry |
| S7 | Bridge rubrica | Flag attuazione/verifica ? sync `notification_contacts` | FK NC intatti |
| S8 | Select NC | Dropdown filtrati per `audit.company_id` (+ studio verifica) | ncResponsibleSelect + API |
| S9 | Migrazione legacy | Script dry-run da NC/rubrica esistente | Report created/skipped |
| S10 | Audit picker | Partecipanti da anagrafica (opzionale v1.1) | Word export invariato |

**Release minima utile:** S1 ? S2 ? S3 ? S4 ? S5 ? S7 ? S8 ? S9

---

## Cosa NON fare in v1

- Login automatici dal personale (RBAC Fase 4)
- Rimuovere «referente esterno» NC prima di S8+S9
- Unificare con registro Qualifiche 3834
- Email obbligatoria su ogni dipendente
- Delete fisico referenti collegati a NC (solo disattivazione)

---

## Pattern UI da riusare

`SgqDataGrid`, tab `StudioSettingsPage`, `NotificationContactsPanel`, `documentRegistryCompanyScope`, RBAC `company.controller.js`

---

## Deploy VPS (02/06/2026)

- Migration **078** applicata (`run-migration-078-vps.js`); tabella `company_personnel` verificata
- Deploy `companyPersonnel.controller.js`, `company.routes.js`; health `https://www.fr-busato.it:8443/api/v1/health` OK
