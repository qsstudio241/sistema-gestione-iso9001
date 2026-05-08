# Case study 01 — Verifica gestione utenti (admin)

**Chiusura tecnica** (22 marzo 2026): deploy VPS ok; health uptime basso dopo restart; commit deploy ~8c40d1f.

**Stato**: **completato (tecnico + deploy)** — codice su `main`; chiusura documentata sotto; branch web `docs/case-study-01-chiusura` integrato.  
**Rischio per stabilità**: basso se si seguono i vincoli sotto (nessuna modifica distruttiva a `main` senza PR). **Backend VPS**: da PowerShell (con PuTTY/sessione configurata come da guida deploy) eseguire `backend/scripts/deploy-controllers-to-vps.ps1` — copia anche `admin` e `auditorOrg` + restart. Senza deploy API aggiornate la UI darà errore sulle nuove rotte.

## Contesto funzionale

- **Frontend**: `app/src/components/UsersAdminPage.jsx` — CRUD UI (crea, modifica, disattiva/riattiva, standard).
- **API**: `POST/PATCH/DELETE /api/v1/admin/users` (`backend/src/controllers/admin.controller.js`, `admin.routes.js`).
- **Client API**: `app/src/services/apiService.js` — `createAdminUser`, `patchAdminUser`, `deactivateAdminUser`.
- **Lista studi**: `GET /auditor-orgs` — fix `superadmin` senza studio in `auditorOrg.controller.js`.

## Vincoli (golden rules)

- Non committare `.env`, password, stringhe di connessione DB.
- Non disattivare l’ultimo admin reale su produzione durante i test.
- Preferire account di **test** o ambiente **development** per creare/disattivare utenti fittizi.

## Checklist verifica manuale (browser)

Esegui loggato come **admin** (o superadmin) della stessa organizzazione.

| # | Azione | Esito atteso |
|---|--------|----------------|
| 1 | Apri pagina gestione utenti | Lista utenti caricata senza errore |
| 2 | **Nuovo utente** — ruolo Viewer, password ≥ 8 | 201 / utente visibile in lista |
| 3 | Modifica **nome** e **Salva dati utente** | Messaggio ok, nome aggiornato dopo refresh |
| 4 | **Nuova password** (opzionale) ≥ 8 caratteri | Login con nuova password funziona |
| 5 | **Disattiva** l’utente di test (non te stesso) | Account disattivato, non può loggare |
| 6 | **Riattiva** | Account di nuovo attivo |
| 7 | **Standard** — spunta 1–2 checkbox e **Salva standard** | Persiste dopo reload |
| 8 | Admin **con** studio collegato | Non può creare ruolo “admin org” (UI + 403 backend) |
| 9 | Admin **senza** studio | Può creare altro admin (se previsto dal modello) |

## Verifica automatica (locale o CI)

Nella cartella `app/`:

```powershell
$env:NODE_ENV = "test"; npm run test:run
npm run build
```

Su **Pull Request** che tocca `app/`, il workflow GitHub Actions esegue gli stessi passi (vedi `GUIDA_CONSOLIDATA.md`, sezione Netlify / CI).

## Delega a Cursor web (opzionale)

**Branch suggerito**: `case-study/01-users-admin-verify` (solo doc/min fix se emergono, mai forzare su `main`).

**Prompt da incollare in Cursor web** (adatta il nome file se sposti il task):

```text
Leggi e segui docs/agent-tasks/CASE_STUDY_01_USERS_ADMIN.md.
Non toccare segreti né .env. Se devi cambiare codice, usa il branch case-study/01-users-admin-verify, commit, apri PR verso main con riepilogo e esito checklist (cosa hai potuto verificare senza backend locale).
```

**Nota**: senza backend e DB raggiungibili dall’ambiente web, l’agente web può comunque: allineare doc, eseguire `npm run test:run` e `npm run build` se il runner lo consente, aprire PR. I passi **1–9** della tabella richiedono **browser + API** attive (locale o VPS aggiornato).

## Definizione di “case study superato”

- Checklist **1–7** OK su un ambiente con backend allineato (dev o VPS con file admin deployati).
- `npm run test:run` + `npm run build` in `app/` verdi (locale e/o CI sulla PR).

## Chiusura / skills

A conclusione positiva, aggiornare `docs/GUIDA_CONSOLIDATA.md` (riga su delega multi-agente se manca) e considerare questo file come **template** per `CASE_STUDY_02_*.md`.
