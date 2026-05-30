# PROMPT RIPRESA — Modulo NC (post-chiusura sessione)

> Aggiornato 30/05/2026 — modulo **terminato**; ripresa solo per **bug da feedback** o **P2 opzionali**.

---

## Stato finale

| Item | Valore |
|------|--------|
| Stato sviluppo | ? **Completo** — attesa feedback utenti (Camellini e altri) |
| Branch | `main` |
| Migrazioni | **071** `verification_responsible` · **072** `source_custom_item_id`, `approved_by/at` |
| Email NC | `NC_ALERT_ENABLED=true` + SMTP VPS — job cron **08:05** |
| Frontend | https://systemgest.netlify.app/nc |
| Manuale | [how-to/MANUALE_UTENTE_NC.md](../how-to/MANUALE_UTENTE_NC.md) |
| Libreria UI | [reference/LIBRERIA_UI_SGQ.md](../reference/LIBRERIA_UI_SGQ.md) (Fase A ~55% copertura) |

### Commit recenti (sessione)

| Hash | Contenuto |
|------|-----------|
| `ac9b1a8` | Hardening H1–H6 — push custom, approvazione RQ, export CSV, azioni cross-NC |
| `327be94` | Dettatura + draft offline campi testo NC |
| `6810518` | Drawer guidato flusso operativo ISO 10.2 |
| `505e551` | Drawer laterale + encoding UI |
| `527a04d` | Layout pulsanti workflow nel drawer |
| `6129a9d` | Encoding manuale NC + doc post-hardening |
| `d80dafa` | Chiusura Fase 1 — simulazione TEST OK |

---

## Comando iniziale — nuova chat (bug o P2)

```
Leggi docs/GUIDA_CONSOLIDATA.md (sezione «Modulo NC» e «Sessione 30/05/2026 — Modulo NC chiusura»),
docs/agent-tasks/PROMPT_RIPRESA_NC.md e docs/how-to/MANUALE_UTENTE_NC.md se serve contesto utente.

Task: [descrivi bug da feedback OPPURE item P2 sotto].
Segui sgq-operating-memory. Non riaprire Fase 1/Hardening salvo regressione dimostrata.
```

---

## Backlog residuo (solo su richiesta)

| Priorità | Item | Note |
|----------|------|------|
| P2 | Agente **AI CAPA** | bozza azioni da root cause + suggerimenti ISO 10.2 |
| P2 | **Export PDF/Word** registro NC completo | CSV già in H5 |
| P2 | **LIBRERIA_UI** Fase B/C | consolidare modali, `.btn-primary` duplicati, badge — vedi catalogo |
| L3 | **Smoke email NC** | verificare ricezione reale `notifications_config.recipients_email` (job 08:05) |
| Campo | **Push custom reale** | audit Camellini con NC/OSS su checklist custom ? registro `/nc` |
| Campo | **Feedback UX** | drawer, flusso sezioni, dettatura, approvazione RQ |

---

## Memoria operativa essenziale

| Risorsa | Dettaglio |
|---------|-----------|
| Workflow NC | `open` ? `in_progress` ? `resolved` ? `verified` ? **approvazione RQ** ? `closed` |
| Gate chiusura | `verification_notes` + `approved_at` se `NC_APPROVAL_REQUIRED` |
| Push audit | ISO + custom in un POST `push-to-nc-register` (idempotenza 072) |
| Drawer | Shell `.doc-detail`; sezioni ordine ISO 10.2; `/nc?select=<id>` |
| Griglia | `SgqDataGrid` — `onRowSelect(rowKey, row)` |
| Campi testo | `RichTextField` (non textarea raw) |
| API | `POST .../approve-closure`, `GET .../actions/due`, export CSV client-side |
| Test L1 | `nc*.test.js`, `nc.controller.test.js`, `ncPage.drawer.test.js` |

---

## Cosa monitorare (committente)

1. **Email 08:05** — almeno un destinatario reale riceve remind NC in scadenza.
2. **Push custom** — da audit con rilievi custom, verificare righe in `/nc` con origine custom.
3. **Feedback Camellini** — usabilità drawer, testi, workflow RQ; aprire nuova chat con screenshot se serve fix.
