# DEPUTYTASK — Export Word NC + Template report — 13/06/2026

**Stato:** TEST OK — Sessione chiusa

---

## Obiettivo

Verificare export NC (CSV + Word), risolvere pulsante Word non visibile, errore HTTP 404 e caratteri illeggibili su pagina Template report.

## Esito

| Verifica | Risultato |
|----------|-----------|
| Export CSV registro `/nc` | OK (già presente) |
| Export Word scheda singola | OK — pulsante in header drawer NC |
| Template report tab NC | OK — backend VPS deploy + migration 090 |
| Encoding «Non conformità» | OK — fix UTF-8 in JSX |
| L1 Vitest (23 test NC/template) | OK |
| Smoke produzione 13/06/2026 | OK — health API, route template 401, Netlify `91f9d05` live |

## Commit / deploy

- **`91f9d05`** — `fix(nc): export Word visibile, template admin e deploy VPS` (push `main`)
- Backend VPS: deploy manifest aggiornato + migration **090** (13/06/2026)
- Netlify: build automatica post-push OK

---

Leggi questo file ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
