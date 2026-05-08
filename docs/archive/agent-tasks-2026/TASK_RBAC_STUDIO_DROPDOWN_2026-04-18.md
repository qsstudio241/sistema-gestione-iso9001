# Task — RBAC studio: dropdown vuoto (2026-04-18)

## In sintesi

| Problema | Effetto in UI |
|----------|----------------|
| Menu **Studio (auditor org)** in Gestione utenti senza voci | Solo “— Nessuno —”, anche quando in DB ci sono studi |
| Utenti senza `auditor_org_id` | Vedono tutti gli audit dell’organizzazione (manca segregazione per studio) |

La causa principale era un **bug backend** (variabile sbagliata) + **catch silenzioso** nel frontend.

---

## Cosa non andava (tecnico)

### Backend

File: `backend/src/controllers/auditorOrg.controller.js`, funzione `listAuditorOrgs`.

- Era usata **`isSuperadmin`**, non definita in quel file.
- Effetto: **ReferenceError** → risposta **500** su `GET /api/v1/auditor-orgs` per gli admin che devono vedere tutti gli studi del tenant.
- Fix: usare **`isOrgWideAdmin`** (già calcolata nel controller).

### Frontend

File: `app/src/components/UsersAdminPage.jsx`.

- C’era un `.catch(() => ({ data: [] }))` che **nascondeva** l’errore API.
- Effetto: lista studi sempre vuota in UI, senza messaggio utile.
- Fix: non mascherare l’errore; mostrare un messaggio se il caricamento studi fallisce.

### RBAC audit (contesto)

Se `auditor_org_id` è **NULL**, il filtro per studio sugli audit spesso **non si applica** (resta il filtro per `organization_id`). Assegnare lo studio agli utenti è quindi importante; il dropdown deve funzionare.

---

## Fix in codice (già su `main`)

| Layer | Modifica |
|-------|----------|
| Backend | `isSuperadmin` → `isOrgWideAdmin` in `listAuditorOrgs` |
| Frontend | Caricamento `getAuditorOrgs` senza catch che azzera la lista |

Merge: **PR #9** (squash), commit principale **`f0940b9`**.

---

## Stato rilascio e DoD

| Voce | Stato | Note |
|------|-------|------|
| Merge su `main` | Fatto | PR #9, CI app verde sulla PR |
| Deploy **Netlify** (frontend) | Automatico | Dopo ogni push su `main`; controllare dashboard *Published* |
| Deploy **VPS** (backend) | Manuale | Obbligatorio per il fix su `auditor-orgs`: copia file + restart (vedi sotto) |
| Smoke manuale L3 | Dopo VPS | Login admin → Gestione utenti → dropdown → assegna studio → verifica lista audit |

### Deploy VPS — passi (PowerShell, root repo)

**Opzione A — variabile d’ambiente**

```powershell
$env:SGQ_PUTTY_SESSION = "NomeSessioneSalvataInPuTTY"
.\backend\scripts\deploy-controllers-to-vps.ps1
```

**Opzione B — file locale (una riga, non in Git)**

1. Crea il file **`backend/config/.putty-session.local`** (è in `.gitignore`).
2. Scrivi **solo** il nome della sessione PuTTY, una riga, senza virgolette.
3. Esegui:

```powershell
.\backend\scripts\deploy-controllers-to-vps.ps1
```

Se vedi ancora errore *batch mode* / *password*: apri **Pageant** con la chiave, oppure verifica la sessione PuTTY (host `www.fr-busato.it`, porta **1122**, utente corretto).

Dettaglio: `docs/GUIDA_CONSOLIDATA.md` (deploy) e `docs/DEPLOY_CHECKLIST_RELEASE.md`.

---

## Smoke già eseguibili senza login (solo rete)

| Controllo | Risultato atteso |
|-----------|------------------|
| `GET https://www.fr-busato.it:8443/api/v1/health` | JSON `healthy`, DB OK |
| `GET …/auditor-orgs` **senza** cookie | **401**, codice tipo `AUTH_TOKEN_MISSING` |
| `GET https://systemgest.netlify.app/` | **200** (su Windows: `curl.exe --ssl-no-revoke …` se compare errore revoca certificato) |

Questi controlli **non** sostituiscono lo smoke con login sull’endpoint `auditor-orgs` come admin org-wide.

---

## Smoke manuale L3 (dopo deploy VPS)

1. Aprire `https://systemgest.netlify.app` (meglio finestra privata dopo deploy).
2. Login come **admin org-wide**.
3. **Gestione utenti** → aprire un utente → campo **Studio**: deve comparire l’elenco degli `auditor_orgs` (se esistono in DB).
4. Salvare uno studio per un utente di prova.
5. Logout, login con quell’utente: la **lista audit** deve rispettare lo scope studio (vedi `docs/GUIDA_CONSOLIDATA.md` e `docs/ARCHITETTURA_UTENTI_RBAC.md`).

Se il dropdown è ancora vuoto **e** l’API risponde 200 con array vuoto: verificare che in tabella **`auditor_orgs`** esistano righe per l’organizzazione.

---

## Nota (chiarezza vs sicurezza)

- La **riscrittura** di questo brief per renderlo più leggibile **non** era motivata da una vulnerabilità introdotta in questi task: serviva a struttura e tabellare i passi.
- Il file opzionale **`backend/config/.putty-session.local`** contiene solo il **nome** della sessione PuTTY (etichetta in PuTTY), **non** la password SSH, ed è in `.gitignore`.
- **Non** si inseriscono in repository password SSH, token o segreti per consentire deploy “in autonomia” all’agente: restano su vault / macchina committente (sessione PuTTY, Pageant, variabili d’ambiente). Se in passato sono finite password in chiaro in `docs/archive/` o in commit, **ruotare** le credenziali coinvolte; la storia Git può ancora contenerle fino a un eventuale rewrite esplicito della history.

---

## Riferimenti

- `docs/ARCHITETTURA_UTENTI_RBAC.md`
- `docs/GUIDA_CONSOLIDATA.md` (sezione A, deploy)

## Prompt delega (breve)

> Seguire `docs/agent-tasks/TASK_RBAC_STUDIO_DROPDOWN_2026-04-18.md`: deploy VPS, smoke Gestione utenti / studio.
