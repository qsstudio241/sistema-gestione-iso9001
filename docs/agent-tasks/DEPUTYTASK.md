# DEPUTYTASK — NC Fase 1 · Slice 5 (ISO 10.2 audit-ready)

**Stato:** **COMPLETATO** — lead, 30/05/2026

**Slice 1–4:** ✅ COMPLETATE (commit b941481)

---

## Obiettivo Slice 5 (riorientata)

Pilastri ISO 10.2 audit-ready sul registro NC (`/nc`):

| Pilastro | Campi / componente | Stato |
|----------|-------------------|-------|
| **Attuazione** | `nc_actions.responsible` + `due_date` — label «Responsabile attuazione» | ✅ |
| **Verifica efficacia** | `verification_notes` + `verification_responsible` (NC) · `verification_note` (azione) | ✅ |
| **Evidenze** | `NcAttachmentsSection` con `nc_id` (upload/list/delete) | ✅ |
| **Gate workflow** | Blocco UI+API passaggio a Verificata/Chiusa senza note verifica NC | ✅ |

**Non** in scope Slice 5: creazione NC manuale, link reclamo, push audit.

---

## Struttura campi (tabella)

| Entità | Campo | Tipo | UI | Note |
|--------|-------|------|-----|------|
| NC | `description` | testo | NcDetailPanel | obbligatorio |
| NC | `root_cause` | testo | NcDetailPanel | ISO 10.2.1b |
| NC | `verification_notes` | testo | NcDetailPanel | **gate** verified/closed |
| NC | `verification_responsible` | testo | NcDetailPanel | migrazione 071 |
| NC | `responsible_person` | testo | NcDetailPanel | responsabile NC |
| NC | `due_date` | data | NcDetailPanel | scadenza NC |
| NC | allegati | file | NcAttachmentsSection | `nc_id`, categoria evidence |
| Azione | `responsible` | testo | ActionsList form + meta | responsabile attuazione |
| Azione | `due_date` | data | ActionsList form + meta | scadenza azione |
| Azione | `verification_note` | testo | ActionsList inline form | **gate** passaggio verified |

---

## File modificati (Slice 5)

| File | Modifica |
|------|----------|
| `database/migrations/071_nc_verification_responsible.sql` | Colonna `verification_responsible` |
| `backend/scripts/run-migration-071.js` | Runner locale |
| `backend/scripts/run-migration-071-vps.js` | Runner VPS |
| `backend/src/controllers/nc.controller.js` | Campo + gate API |
| `backend/src/controllers/attachment.controller.js` | Fix scope org list `nc_id` |
| `app/src/utils/ncWorkflow.js` | Gate UI testabile |
| `app/src/components/NcDetailPanel.jsx` | Verifica + allegati |
| `app/src/components/NcAttachmentsSection.jsx` | Allegati NC |
| `app/src/pages/NCPage.jsx` | ActionsList verifica + gate NC |
| `app/src/pages/NCPage.css` | Stili form verifica azione |
| `app/src/tests/ncActionsResponsibility.test.js` | Gate workflow |
| `app/src/tests/ncDetailPanel.test.js` | Campi Slice 5 |
| `app/src/tests/ncAttachmentsSection.test.js` | Allegati NC |

---

## Definition of Done

- [x] Responsabile attuazione azione (UI + API)
- [x] Responsabile verifica NC (`verification_responsible`)
- [x] Note verifica NC + azione con gate
- [x] Allegati evidenze NC
- [x] Test L1 verdi + build Vite OK
- [x] Migrazione 071 su DB
- [x] Deploy controller backend se modificato

---

## Slice 6 — Creazione NC manuale + tracciabilità

1. Pulsante «Nuova NC» + form/modal (`POST /non-conformities`, `source_type: manual`)
2. Badge/link `source_complaint_id` → reclamo origine
3. Allineamento `PendingIssuesCascade` con `verification_notes` (solo display, no push flow)
4. Test `ncCreate.test.js`

---

## Slice 7 — Report e dashboard NC

1. Export registro NC (CSV/PDF)
2. KPI verifica efficacia (% NC verificate entro scadenza)
3. Filtri avanzati per responsabile verifica

---

## Slice 8 — Scadenze NC/azioni + remind email (bozza)

**Stato:** PROPOSTA — non avviare finché SMTP VPS non è configurato e testato (vedi GUIDA § Alert Engine).

### Obiettivo

Completare monitoraggio scadenze oltre i filtri UI già presenti:

| Voce | Stato attuale | Target |
|------|---------------|--------|
| Filtro NC scadute | ✅ API `overdue=true` + UI | — |
| Filtro NC in scadenza (7 gg) | ❌ | API `due_within_days=7` + dropdown UI |
| Filtro azioni scadute/in scadenza (registro) | ⚠️ solo per singola NC (UI) | API cross-NC opzionale |
| Email remind giornaliero | ❌ (solo documenti) | Estendere `alertScheduler.js` |

### Backend

1. `GET /non-conformities`: query param `due_within_days` (NC aperte con scadenza entro N giorni, non ancora scadute)
2. Statistiche: campo `due_soon` in `/statistics/overview`
3. `alertScheduler.js`: job `runNcDueAlertJob()` alle 08:00 (stesso slot documenti o +5 min)
   - Query NC + `nc_actions` con scadenza passata o entro 7 gg, stati non terminali
   - Destinatari: `notifications_config.recipients_email` (org) + opz. mappatura `responsible` → email utente (fase 2)
4. Template HTML: riuso pattern `buildEmailHtml` (tabella NC + azioni)

### Frontend

1. NCPage: opzione filtro «In scadenza (7 gg)» accanto a «Solo scadute»
2. HomePage: card «In scadenza» per NC (oggi solo documenti)
3. Allineare etichetta Home «Azioni NC in ritardo» → chiarire se NC o azioni

### Prerequisiti

- `.env` VPS: `ALERT_ENABLED=true`, `SMTP_*` compilati (GUIDA_CONSOLIDATA §1775)
- Tabella `notifications_config` con `enabled=1` e `recipients_email`
- Test manuale: `sendAlertEmail` con 1 NC di prova

### DoD

- [ ] Migrazione non richiesta (campi `due_date` già presenti)
- [ ] Test L1 backend filtri + test unitari template email (mock SMTP)
- [ ] Smoke L3: email ricevuta su casella test org 1001
- [ ] GUIDA aggiornata con soglie NC

### Effort stimato

| Blocco | Giorni |
|--------|--------|
| API filtri scadenza NC | 0,5 |
| UI filtri registro | 0,5 |
| Job email NC/azioni | 1 |
| SMTP + smoke | 0,5 (dipende da committente) |

---

## Comando deputy standard

```
Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```

---

*Aggiornato 30/05/2026 — Slice 5 ISO 10.2 completata; Slice 6 = creazione manuale + reclamo*
