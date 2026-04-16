# TASK — WebDAV Round-trip Office (Sprint rapido)

## Contesto

Il progetto SGQ richiede una funzionalita' "apri in Word/Excel desktop e salva direttamente sul server" per clienti PMI (Windows + Office attivo), con infrastruttura nostra.

Riferimento funzionale/tecnico:  
`docs/MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md`

---

## Obiettivo deputy (PR unica, scope ridotto ma solido)

Creare un **PoC tecnico integrabile** senza toccare deploy produzione:

1. Backend:
   - endpoint `POST /documents/:id/webdav-link` (auth richiesta),
   - modulo token breve `dt` (sign/verify),
   - skeleton route WebDAV:
     - `GET /webdav/:orgId/:docId/:filename`
     - `PUT /webdav/:orgId/:docId/:filename`
     - `PROPFIND /webdav/:orgId/:docId/:filename`
     - `LOCK /webdav/:orgId/:docId/:filename`
     - `UNLOCK /webdav/:orgId/:docId/:filename`
   - per ora puo' usare storage locale di test (`backend/tmp/webdav-poc/`) e lock in-memory.

2. Frontend:
   - aggiungere in `apiService` la chiamata `createWebdavLink(documentId)`,
   - nuovo componente minimo `OfficeEditor.jsx` (o bottone in vista documento) che:
     - richiede il link,
     - costruisce `ms-word:ofe|u|...` / `ms-excel:ofe|u|...`,
     - gestisce fallback con messaggio chiaro.

---

## Vincoli obbligatori

- Nessun segreto hardcoded.
- No librerie commerciali.
- Nessuna modifica distruttiva su moduli esistenti.
- Nessun deploy VPS nel task deputy.
- PR verso `main` con CI verde (`.github/workflows/ci-app-pr.yml`).

---

## File attesi (indicativi)

- `backend/src/routes/webdav.routes.js`
- `backend/src/controllers/webdav.controller.js`
- `backend/src/services/webdavToken.service.js`
- update mount in `backend/src/server.js`
- update document route/controller per `POST /documents/:id/webdav-link`
- `app/src/components/OfficeEditor.jsx`
- `app/src/services/apiService.js` (nuovo metodo)
- eventuale doc breve in `docs/agent-tasks/REPORT_*.md` con esito e limiti PoC

---

## Criteri di completamento (DoD deputy)

- Endpoint `POST /documents/:id/webdav-link` risponde con payload:
  - `webdav_url`,
  - `office_scheme_word`,
  - `office_scheme_excel`,
  - `expires_at`.
- Route WebDAV rispondono con status coerente (anche mock/skeleton) per i metodi richiesti.
- Frontend genera correttamente URI Office.
- README/commenti minimi su cosa e' PoC e cosa manca per produzione.

---

## Prompt pronto per Cursor web

Implementa il task descritto in `docs/agent-tasks/TASK_WEB_DAV_ROUND_TRIP.md` seguendo i vincoli e la mini-spec `docs/MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md`.  
Lavora su branch dedicato `feat/webdav-roundtrip-poc`, apri PR verso `main`, includi nel body:
- summary delle modifiche,
- limiti residui per produzione,
- test eseguiti e output sintetico.
