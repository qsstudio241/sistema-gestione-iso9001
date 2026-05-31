# DEPUTYTASK — Chiusura Fase C Ricerca unificata

**Sessione:** 31/05/2026 — C1–C4 completati

## Stato

| Slice | Contenuto | Test | Esito |
|-------|-----------|------|-------|
| C1 | `GET /api/v1/search` backend | Jest 10 | **OK** |
| C2 | Pagina `/search`, scope azienda, deep link | Vitest 4 | **OK** |
| C3 | Tab Esatto / Significato (RAG) | Vitest 1 smoke | **OK** |
| C4 | Deploy VPS + push main + doc | smoke curl | vedi sessione |

## API

`GET /api/v1/search?q=...&companyId=&entityTypes=&limit=`

- Filtro tenant JWT obbligatorio
- `companyId` opzionale — match rigido (no OR NULL)
- Entità: NC, documenti, audit, reclami, rischi, qualifiche

## Frontend

- Route `/search` — tab **Esatto** (GET search) e **Significato** (POST `/ai/chat` + citazioni)
- Dropdown scope: Tutto lo studio | Azienda (anagrafiche)
- Link header + voce sidebar "Ricerca"
- Mapping deep link: `app/src/utils/searchResultLinks.js`

## Deploy VPS

File: `search.routes.js`, `search.controller.js`, `unifiedSearch.service.js`, `server.js`  
Script: `backend/scripts/deploy-controllers-to-vps.ps1`  
Restart: `systemctl restart sgq-backend` — verificare PID cambiato

## Smoke

```bash
curl -sk https://www.fr-busato.it:8443/api/v1/health
curl -sk -H "Authorization: Bearer $TOKEN" "https://www.fr-busato.it:8443/api/v1/search?q=NC&limit=3"
```

*Chiuso 31/05/2026 — TEST OK.*
