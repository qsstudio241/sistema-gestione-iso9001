# PROMPT RIPRESA — Modulo NC post-Fase 1

> Generato 30/05/2026 — usare come primo messaggio in una nuova chat Cursor.

---

## Stato completato

**NC Fase 1 — TEST OK** (ISO §10.2 registro cross-audit, workflow, gate verifica, migrazione 071).

| Item | Valore |
|------|--------|
| Branch | `main` |
| Commit feature | `b23f79d` (slice 6–11), `d80dafa` (fix griglia + alert + modal audit) |
| Migrazione 071 | OK — `verification_responsible` su VPS |
| Deploy VPS | OK — health API 200, `sgq-backend` active |
| Frontend | https://systemgest.netlify.app/nc |

---

## Comando iniziale nuova sessione

```
Leggi PROJECT_CONTEXT.md, docs/GUIDA_CONSOLIDATA.md (sezione «Modulo NC organizzativo — Fase 1»),
docs/agent-tasks/PROMPT_RIPRESA_NC.md e docs/PROJECT_ROADMAP.md.
Prossimo task suggerito: Fase 2 agente AI CAPA oppure push custom checklist (backlog roadmap).
Segui sgq-operating-memory.
```

---

## Backlog P2 (priorità suggerita)

1. **SMTP alert NC** — attivare `NC_ALERT_ENABLED` + `ALERT_ENABLED` + credenziali SMTP VPS; smoke L3 email
2. **Push custom checklist** — allineamento pending issues custom ? registro NC (roadmap)
3. **Export CSV/PDF** registro NC
4. **Agente AI CAPA** — bozza azioni da root cause + suggerimenti ISO 10.2
5. **NcCreateModal** — dropdown sezioni per `standard_id` audit (evita FK su audit 14001/3834)

---

## Memoria operativa essenziale

| Risorsa | Dettaglio |
|---------|-----------|
| **Manuale utente NC** | [docs/how-to/MANUALE_UTENTE_NC.md](../how-to/MANUALE_UTENTE_NC.md) |
| App produzione | https://systemgest.netlify.app |
| Modulo NC | `/nc` — griglia `SgqDataGrid`, dettaglio `NcDetailPanel`, workflow `status-btn` |
| API NC | `GET/POST /api/v1/non-conformities`, `PUT /non-conformities/:id` |
| Credenziali test | `backend/config/.ssh-deploy.local.ps1` (gitignored) |
| Deploy backend | `backend/scripts/deploy-controllers-to-vps.ps1` + restart `sgq-backend` |
| Deploy frontend | push su `main` ? Netlify ~2 min |
| Test L1 NC | `app/src/tests/nc*.test.js` |
| Deep-link NC | `/nc?select=<nc_id>` |
| Gate ISO | `verification_notes` obbligatorie per stati `verified` / `closed` |

### Componenti UI NC (riuso obbligatorio)

- Griglia: `SgqDataGrid` theme `plain`
- Dettaglio: `NcDetailPanel`, `ActionsList`, `NcAttachmentsSection`
- Creazione: `NcCreateModal`
- Workflow: classi `status-btn` da `ChecklistModule.css`
- Note: classe `notes-textarea`

---

## Note simulazione 30/05/2026

- Workflow completo verificato su NC `1043` (manuale, chiusa con note verifica).
- Griglia produzione: 3 NC totali, 1 aperta.
- Fix FK sezione: HTTP 400 `INVALID_SECTION_FOR_STANDARD` (non più 500 generico).
