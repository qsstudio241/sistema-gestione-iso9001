# DEPUTYTASK1 — Provisioning nuovo studio (auditor_org + organization) da UI

**Stato:** APERTO
**Priorità:** P1 — gap segnalato dal committente (10/08/2026): "ho provato a generare l'anagrafica per un nuovo studio ma non compare nella lista"
**Branch base:** `main`
**Creato da:** Lead 10/08/2026

> **Allineamento Git (autonomo)**: prima di leggere questo brief eseguire `git fetch origin main` e `git pull origin main` (o partire da `origin/main` aggiornato). **Non** chiedere al committente di farlo.

---

## Contesto (leggere prima)

Diagnosi confermata con query dirette in produzione (10/08/2026): esistono oggi **solo 4 studi** (`AI.Admin`/`Al.project`, `QS Studio`/`QS_Studio`, `Mason`/`MASON_Srl`, `ERAM`/`ERAM`), tutti correttamente collegati (`auditor_orgs.organization_id = organizations.organization_id`, nessuna riga orfana). **Non esiste nel prodotto alcuna funzione di creazione di un nuovo studio/tenant dall'interfaccia** — solo script SQL manuali one-off (`database/scripts/split_tenants_phase1_insert_four_organizations.sql` + `split_tenants_phase2_map_auditor_orgs_template.sql`), usati per lo split iniziale di aprile 2026. Questo gap è già annotato in `docs/ARCHITETTURA_UTENTI_RBAC.md` §8.3 riga "Provisioning multi-tenant (creazione nuova `organizations` da UI) — Fuori §7 fino a decisione". Il committente ha ora chiesto esplicitamente di implementarlo.

**Modello dati (da non cambiare, solo usare):**
- `organizations` = tenant (cliente pagante della piattaforma).
- `auditor_orgs` = studio operativo dentro il tenant (oggi 1:1 con `organizations`, ma lo schema non impone unicità — non introdurre vincoli che rompano questa flessibilità).
- Un "nuovo studio" nel linguaggio del committente = una nuova coppia `organizations` + `auditor_orgs` collegata (nuovo tenant cliente).

**Pagina di riferimento**: `app/src/components/UsersAdminPage.jsx`, sezione "Licenze moduli per studio" (righe ~765-840), alimentata da `GET /auditor-orgs` (`backend/src/controllers/auditorOrg.controller.js`, `backend/src/routes/auditorOrg.routes.js` — oggi solo `GET`, nessun `POST`).

## Cosa NON toccare

- Schema tabelle `organizations` / `auditor_orgs` (nessuna migrazione: colonne già sufficienti).
- Logica di creazione `companies` (`company.controller.js` — resta scoped a `auditor_org_id` esistente).
- Task parallelo `docs/agent-tasks/DEPUTYTASK.md` (ADR-018 profilo azienda) — file e branch disgiunti, nessuna sovrapposizione prevista (tabelle diverse).
- Flusso `POST /admin/users` esistente (creazione utenti) — va **riusato** com'è per il primo admin del nuovo studio (S3), non duplicato.
- `moduleLicense.service.js` / `licenseUtils.js` — il nuovo studio deve nascere con `licensed_modules = NULL` (default = tutti i moduli), nessuna logica nuova di licensing.

---

## Slice S1 — API creazione studio (BE)

**File previsti:**
- `backend/src/controllers/auditorOrg.controller.js` (+ nuova funzione `createAuditorOrg`)
- `backend/src/routes/auditorOrg.routes.js` (nuova `router.post('/auditor-orgs', ...)`)
- Test Jest: `backend/src/controllers/auditorOrg.controller.test.js` (nuovo o esteso se già esiste equivalente)

**Endpoint:** `POST /api/v1/auditor-orgs` — **solo superadmin** (riusare pattern `authorize('superadmin')` come in `admin.routes.js` riga 16, non l'attuale `router.use(authenticate)` generico che vale per GET).

**Body:**
```json
{
  "organization_name": "Nome Cliente Srl",   // obbligatorio
  "studio_name": "Nome breve studio",         // obbligatorio (colonna auditor_orgs.name)
  "studio_email": "referente@cliente.it",     // obbligatorio, valido, univoco su auditor_orgs.email
  "subscription_plan": "standard"             // opzionale, default 'standard'
}
```

**Logica (transazione unica, rollback su qualsiasi errore):**
1. Validare i 3 campi obbligatori (trim, non vuoti); validare formato email.
2. Verificare univocità case-insensitive di `organization_name` su `organizations` e di `studio_email` su `auditor_orgs` → **409** con messaggio chiaro se duplicato.
3. Generare `organization_code` nel formato esistente `ORG_%05d` (vedi valori attuali `ORG_00001`..`ORG_00004` in `admin.controller.js` riga ~728) calcolando il prossimo numero libero (`MAX` + 1, non riusare codici cancellati).
4. `INSERT organizations (organization_code, organization_name, is_active, created_at, updated_at) VALUES (..., ..., 1, GETDATE(), GETDATE())` con `licensed_modules` lasciato `NULL` (default = tutti i moduli).
5. `INSERT auditor_orgs (organization_id, name, email, subscription_plan, is_active, created_at, updated_at) VALUES (@new_organization_id, ..., ..., ..., 1, GETDATE(), GETDATE())`.
6. Rispondere `201` con la stessa forma-riga della `listAuditorOrgs` (join `organizations`, incluso `licensed_modules: null`) così il FE può fare append diretto senza re-fetch.

**DoD:** test 403 non-superadmin; test 400 campo mancante; test 409 nome/email duplicati; test 201 con verifica che la riga appaia poi in `GET /auditor-orgs` (join corretto); transazione verificata (se il secondo INSERT fallisce, il primo va in rollback — niente `organizations` orfane).

**Nota deploy backend**: nuova route sullo stesso file esistente (`auditorOrg.routes.js`), nessun nuovo file — non serve toccare `deploy-manifest.json`. Verificare comunque prima del deploy VPS.

---

## Slice S2 — UI form "Nuovo studio" (FE)

**File previsti:**
- `app/src/components/UsersAdminPage.jsx` (nuova sotto-sezione dentro "Licenze moduli per studio")
- `app/src/services/apiService.js` (nuovo metodo `createAuditorOrg(payload)` → `POST /auditor-orgs`)
- `app/src/components/UsersAdminPage.css` (riuso classi form esistenti, es. `.form-hint`, `.btn-primary` — niente CSS parallelo)

**Cosa fare:**
1. Sopra la lista `auditorOrgs.map(...)` (dentro la `<section className="org-licenses-section">`, prima del `.map`), aggiungere un pulsante "+ Nuovo studio" (visibile solo `isSuperadmin`) che apre/chiude un mini-form inline (pattern `<details>` già usato per ogni riga studio, o toggle `useState`).
2. Campi form: Nome cliente/organizzazione, Nome studio, Email referente, Piano abbonamento (select con default "standard", opzionale).
3. Submit → `apiService.createAuditorOrg(...)`; in caso di successo: **append** la riga ritornata a `auditorOrgs` (no re-fetch necessario, l'API la restituisce già nel formato corretto — vedi S1 punto 6) e mostra messaggio "✅ Studio creato." con `auto-hide` (pattern già usato in `orgLicenseMsg`, righe ~208-209).
4. Errori (400/409/500) mostrati inline nel form, **mai** silenziosi (niente `catch (_) {}`).
5. Dopo la creazione, il nuovo studio deve apparire **immediatamente** nella lista sotto, con badge "Tutti i moduli (default)" — verifica visuale che confermi la chiusura del bug segnalato dal committente.

**DoD:** Vitest (`usersAdminPage.test.jsx`): submit valido → nuova entry in lista; validazione client-side campi vuoti; messaggio errore su 409 mock. `npm run build` OK.

**Riuso UI:** niente componente form parallelo — stile coerente con il form "Nuovo utente" già presente più in alto nella stessa pagina.

---

## Slice S3 (dopo S1+S2) — Collegamento primo admin del nuovo studio

**Nessun file nuovo previsto** — solo verifica/piccolo hint UX.

**Cosa fare:**
1. Verificare che, dopo la creazione del nuovo studio (S2), il form esistente "Nuovo utente" (stessa pagina, più in alto) mostri subito il nuovo studio nel proprio selettore `auditor_org_id` (dipende solo dall'aggiornamento dello stato `auditorOrgs` già fatto in S2 — non serve altro codice se S2 è fatto bene).
2. Se utile, aggiungere un hint testuale sotto il messaggio di successo S2: "Ora puoi creare il primo utente admin per questo studio nel modulo Nuovo utente qui sopra, selezionando «Nome studio»."

**DoD:** verifica manuale/Vitest che il dropdown esistente includa il nuovo studio senza refresh pagina.

---

## Fuori scope di questo brief

- Fatturazione/gestione reale abbonamenti (`subscription_plan` resta un campo testo libero, nessuna integrazione a pagamento).
- Cancellazione/disattivazione studio da UI (oggi non richiesta dal committente).
- Lookup automatico dati aziendali (InfoCamere/P.IVA) — eventualmente riusabile da ADR-018 (`docs/agent-tasks/DEPUTYTASK.md`), non duplicare qui.
- Modifica di `organization_code` dopo la creazione.

---

## Verifica chiusura

Alla fine di ogni slice: TEST OK (Jest per S1, Vitest+build per S2/S3) oppure FIX NON APPLICABILI con motivo.

Smoke finale suggerito: creare uno studio di test dal pannello superadmin in produzione (o staging se disponibile), verificare che compaia subito con badge default, poi eventualmente disattivarlo/rinominarlo via SQL se era solo un test — annotare l'operazione in `docs/GUIDA_CONSOLIDATA.md` se emerge una lezione nuova.

---

## Comando deputy (dopo push di questo brief su `origin/main`)

```
Leggi docs/agent-tasks/DEPUTYTASK1.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```

Il deputy allinea Git da solo all'avvio (`git fetch` / `git pull origin main`).
