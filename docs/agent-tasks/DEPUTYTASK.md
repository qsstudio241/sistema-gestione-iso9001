# DEPUTYTASK — Stato sessione 2026-06-19 (fix licenza management-review)

## Stato: CHIUSO — TEST OK

---

## Fix 2026-06-19 sera — Bug modulo Riesame Direzione non accessibile

### Causa radice
`riesame_direzione` assente da `KNOWN_MODULE_KEYS` in `moduleLicense.service.js`.
Al login, il token utente riceveva la lista default senza quella chiave → menu filtrato, pagina bloccata.

### Fix applicato
| File | Modifica |
|---|---|
| `backend/src/services/moduleLicense.service.js` | Aggiunta chiave `riesame_direzione` in `KNOWN_MODULE_KEYS` + label in `LABELS_IT`; etichetta `sal` corretta |

### Deliverable
| # | Deliverable | Stato |
|---|---|---|
| 1 | Branch `fix/management-review-license-menu` + commit | ✅ |
| 2 | PR #122 — CI verde (smoke + Netlify) | ✅ |
| 3 | Merge su `main` | ✅ |
| 4 | Deploy VPS (`deploy-controllers-to-vps.ps1`) | ✅ |
| 5 | Verifica VPS: `INDEX: 5 LABEL: Riesame di Direzione (§9.3)` | ✅ |

### Note
- Menu e guard pagina erano già corretti nel frontend (AppLayout.jsx:61, App.jsx:139)
- Org con `licensed_modules = NULL`: il modulo è automaticamente incluso dopo re-login
- Org con lista esplicita: il modulo appare nella pagina Licenze moduli come disponibile

---

---

## Sessione 2026-06-19 — Migration 100 norm_requirements + AI Draft §9.3.2

### Obiettivo completato
Tabella `norm_requirements` integrata nel flusso del Riesame di Direzione ISO 9001:
- `GET /management-reviews/input-summary` restituisce `norm_coverage` con clausole ISO 9001:2015 reali e stato ok/gap
- Nuovo endpoint `POST /management-reviews/:id/generate-draft` per testi bozza §9.3.2 (deterministico + AI opzionale)
- Pulsante "✨ Genera bozza testo" nel widget `InputSummaryWidget` del frontend

### Deliverable consegnati

| # | Deliverable | Stato |
|---|---|---|
| 1 | Script migrazione 100 (local + vps) — idempotente, rileva schema preesistente | ✅ |
| 2 | Query `norm_coverage` in `getInputSummary` — usa `clause_ref` e `ISO_9001_2015` | ✅ PR #120 |
| 3 | Endpoint `POST /management-reviews/:id/generate-draft` con fallback deterministico | ✅ PR #120 |
| 4 | Frontend: pulsante "Genera bozza testo" + loading state + messaggio conferma | ✅ PR #120 |
| 5 | PR #120 mergiata su `main` — CI verde (smoke + Netlify Deploy Preview) | ✅ |
| 6 | Deploy VPS — `deploy-controllers-to-vps.ps1` eseguito 2× (fix clause_ref) | ✅ |
| 7 | Migrazione VPS: SKIP confermato (91 righe ISO 9001 preesistenti con `clause_ref`) | ✅ |
| 8 | Fix push diretto su `main` per adattamento schema reale DB | ✅ |

### Nota tecnica: schema norm_requirements
La tabella `norm_requirements` esiste già nel DB produzione con schema diverso da quello pianificato:
- Colonna: `clause_ref` (non `clause_number`)
- Filtro: `standard_code = 'ISO_9001_2015'` (non `ISO9001:2015`)
- Filtro livello clausola: `LEN(clause_ref) - LEN(REPLACE(clause_ref, '.', '')) = 1` → solo clausole di sezione (es. `4.1`, `8.2`)
- La tabella ha già 91 righe per `ISO_9001_2015` e 234 totali (multi-standard)

### Flusso operativo attivo
```
git checkout -b feat/nome
→ implementa modifiche
→ git push + gh pr create --fill
→ GitHub Actions: smoke DB test + health check backend test (~30s)
→ gh pr merge --merge --delete-branch
→ .\backend\scripts\deploy-controllers-to-vps.ps1
→ .\backend\scripts\run-on-vps.ps1 -Script backend\scripts\run-migration-100-vps.js (idempotente)
```
