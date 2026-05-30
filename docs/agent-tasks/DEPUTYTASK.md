# DEPUTYTASK — NC Hardening H1–H6

**Stato:** **CHIUSO / TEST OK NC Hardening** — 30/05/2026 · commit `ac9b1a8`

---

## Tabella slice | stato | commit

| Slice | Descrizione | Stato | Note |
|-------|-------------|-------|------|
| H1 | Push checklist custom → registro NC + contatore ISO+custom | ✅ | `pushAuditToNcRegister` + migrazione 072 `source_custom_item_id` |
| H2 | Email remind NC (`runNcDueAlertJob`) | ✅ | `NC_ALERT_ENABLED=true` attivato VPS; SMTP già configurato |
| H3 | Approvazione RQ chiusura (`approved_by/at`) | ✅ | API gate `NC_APPROVAL_REQUIRED` + UI «Approva chiusura» |
| H4 | NcCreateModal sezioni dinamiche per standard audit | ✅ | `GET /checklist/sections?standard_id=` |
| H5 | Export CSV registro NC (filtri griglia) | ✅ | Client-side `ncExportHelpers.js` |
| H6 | Filtro azioni cross-NC | ✅ | `GET /non-conformities/actions/due` + tab UI |
| Migrazione 072 | VPS produzione | ✅ | colonne verificate via SSH |
| Deploy backend | nc.controller + nc.routes | ✅ | restart `sgq-backend` |
| Test L1 | Vitest + Jest NC | ✅ | 23 Vitest + 8 Jest |
| Simulazione | Produzione `/nc` post-deploy Netlify | ✅ | API workflow + UI Export CSV / tab azioni |

---

## Comando deputy standard

```
Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```

---

*Aggiornato 30/05/2026 — NC Hardening*
