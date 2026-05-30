# PROMPT RIPRESA — Modulo NC post-Hardening

> Generato 30/05/2026 — usare come primo messaggio in una nuova chat Cursor.

---

## Stato completato

**NC Hardening H1–H6 — TEST OK** (push custom, approvazione RQ, export CSV, azioni cross-NC, migrazione 072).

| Item | Valore |
|------|--------|
| Branch | `main` |
| Migrazione 072 | OK VPS — `source_custom_item_id`, `approved_by`, `approved_at` |
| Email NC | `NC_ALERT_ENABLED=true` + SMTP VPS |
| Frontend | https://systemgest.netlify.app/nc |

---

## Comando iniziale nuova sessione

```
Leggi docs/GUIDA_CONSOLIDATA.md (sezione NC Hardening), docs/agent-tasks/PROMPT_RIPRESA_NC.md.
Prossimo task opzionale: agente AI CAPA (Fase 2) oppure export PDF registro NC.
Segui sgq-operating-memory.
```

---

## Backlog residuo

1. **Agente AI CAPA** — bozza azioni da root cause + suggerimenti ISO 10.2 (Fase 2, escluso da Hardening)
2. **Export PDF/Word** registro NC completo
3. **Smoke L3 email NC** — verificare ricezione reale casella `notifications_config.recipients_email` (job 08:05)

---

## Memoria operativa essenziale

| Risorsa | Dettaglio |
|---------|-----------|
| Workflow NC | open ? in_progress ? resolved ? verified ? **approvazione RQ** ? closed |
| Gate chiusura | `verification_notes` + `approved_at` obbligatori |
| Push audit | ISO + custom checklist in un unico POST push-to-nc-register |
| API nuove | `POST .../approve-closure`, `GET .../actions/due` |
| Test L1 | `nc*.test.js`, `nc.controller.test.js` |

---

## Note simulazione Hardening 30/05/2026

- Backend deploy + migrazione 072 verificati su VPS.
- Frontend: push su `main` ? Netlify ~2 min.
- Ruolo esecutore: workflow NC + azioni; ruolo verificatore/admin: «Approva chiusura (RQ)» poi «Chiudi NC».
