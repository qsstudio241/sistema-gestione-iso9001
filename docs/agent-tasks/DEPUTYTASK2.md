# DEPUTYTASK2 — LUX-B: Badge/alert in-app gap piattaforma (superadmin)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 06/09/2026  
**Chiuso:** 06/09/2026  
**PR:** (draft) branch `cursor/lux-b-libreria-gap-badge-1afa` — link dopo create  
**Piano:** [`PLAN_LIBRERIA_UX_SLICES.md`](PLAN_LIBRERIA_UX_SLICES.md) § LUX-B  
**Rischio:** Medio — FE menu + endpoint count additivo; niente auth middleware rewrite, niente migrazioni, niente form richiesta umana  
**Branch:** `cursor/lux-b-libreria-gap-badge-1afa`  
**Parallelo a:** LUX-A su [`DEPUTYTASK1.md`](DEPUTYTASK1.md) — **file disgiunti** (non toccato)  
**Prerequisito prodotto:** LG-1…LG-5 già in `main` (email SA + coda `platform-queue`)

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK2.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`  
> Brief da eseguire solo se su `origin/main` questo file ha **Stato: APERTO** e titolo **LUX-B**.

---

## Esito

**TEST OK**

- BE: `countOpenPlatformGaps()` → `GET /library/source-requests/platform-gap-count` (superadmin-only, prima di `:id`)
- FE: poll 5 min in `AppLayout` solo `role === 'superadmin'` + `sidebar-badge` su voce Libreria (cap 99+)
- Email SA invariata (canale mail non toccato)
- L1: BE service 15/15; FE `appLayoutLibraryGapBadge.test.jsx` 4/4; `npm run build` OK
- Non toccati: `NormLibraryPage.css`, form richiesta umana, Ambito, `DEPUTYTASK1`

## Perché

I superadmin ricevono già **email** sui gap piattaforma (`closure_path=platform`). Manca un segnale **in-app** sulla voce menu **Libreria** (e/o conteggio in coda) così il gap non dipende solo dalla casella di posta. Riuso: `sidebar-badge` già usato per Documenti/Reclami in `AppLayout`.

## File previsti

- `backend/src/services/librarySourceRequest.service.js` — helper `countOpenPlatformGaps()` (o equivalente): `closure_path=platform` + `status IN ('open','in_progress')` → `COUNT`; **preferire COUNT** rispetto a scaricare tutta la coda ogni poll
- `backend/src/controllers/librarySourceRequest.controller.js` — handler count (o estensione minima della queue se il Lead deputy dimostra che `count` dalla list è accettabile **e** documenta il costo)
- `backend/src/routes/librarySourceRequest.routes.js` — route superadmin-only, **prima** di `:id` se path parametrizzato (stesso ordine di `platform-queue`)
- `backend/src/services/librarySourceRequest.service.test.js` — test count / filtro status
- `app/src/services/apiService.js` — metodo client per il count (o riuso documentato di `getLibraryPlatformQueue` **solo** se si evita payload pesante in poll)
- `app/src/layouts/AppLayout.jsx` — per `role === 'superadmin'`: poll (stesso intervallo alert ~5 min) + `badge` sulla voce `{ to: "/settings/libreria", … }`
- `app/src/layouts/AppLayout.css` — **solo** se il badge esistente non basta (preferire riuso `.sidebar-badge`)
- `app/src/tests/appLayoutLibraryGapBadge.test.jsx` (**nuovo**) — superadmin vede badge con N>0; non-superadmin no; N=0 nessun badge
- Opz.: `app/src/pages/NormLibraryPage.jsx` — conteggio numerico sull’header sezione coda SA (dati già caricati / stesso count); **non** toccare `NormLibraryPage.css`
- `docs/agent-tasks/DEPUTYTASK2.md` (chiusura) + checkbox PLAN

Se aggiungi file `.js` nuovi sotto `backend/src/`: aggiorna `backend/scripts/deploy-manifest.json`.

## Cosa NON toccare

- `app/src/pages/NormLibraryPage.css` (LUX-A)
- `app/src/tests/normLibraryPage.fullWidth.test.js` / contract full-width
- Form richiesta umana, Ambito, banner→pulsante SA
- `auth.middleware.js`, JWT, sync, migrazioni SQL
- Push mobile (LG-6)
- `SgqDataGrid` globale
- `DEPUTYTASK1.md` (slot parallelo)

## Criteri TEST OK

1. Superadmin con ≥1 gap piattaforma open/in_progress: badge numerico sulla voce **Libreria** (cap 99+ come gli altri badge).
2. Superadmin con 0 gap aperti: nessun badge (o non visibile).
3. Admin/non-superadmin: nessun badge gap (endpoint count resta superadmin-only).
4. Email esistente invariata (non rimuovere né sostituire il canale mail).
5. Test BE service count verde; test L1 AppLayout badge verde.
6. `cd app && NODE_ENV=test npm run test:run -- src/tests/appLayoutLibraryGapBadge.test.jsx` + `cd app && npm run build`.
7. Backend: test mirato `librarySourceRequest.service.test.js` (o suite BE equivalente già usata dal modulo).
8. PR: gate Medio — non dire «pronta» senza CI + Bugbot + Security Review su quello SHA. **Non** mergiare.

## Comando chiusura

`Leggi docs/agent-tasks/DEPUTYTASK2.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`
