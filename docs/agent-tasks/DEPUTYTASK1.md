# DEPUTYTASK1 — LUX-A: Griglie Libreria full-width

**Stato:** APERTO  
**Aperto:** 06/09/2026  
**Piano:** [`PLAN_LIBRERIA_UX_SLICES.md`](PLAN_LIBRERIA_UX_SLICES.md) § LUX-A  
**Rischio:** Basso — solo CSS pagina (+ test L1 CSS); niente backend, auth, sync, `SgqDataGrid` globale  
**Branch suggerito:** `cursor/lux-a-libreria-fullwidth-1afa` (o `cursor/<desc>-1afa` secondo policy Cloud)  
**Parallelo a:** LUX-B su [`DEPUTYTASK2.md`](DEPUTYTASK2.md) — **file disgiunti** (CSS vs menu/API)  
**Slot precedente:** CONS-2 CHIUSO su `origin/main` (sovrascrittura consentita)

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK1.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`  
> Brief da eseguire solo se su `origin/main` questo file ha **Stato: APERTO** e titolo **LUX-A**.

---

## Perché

Oggi `.nl-page { max-width: 1100px }` comprime catalogo e griglie. Decisione prodotto: Libreria a **piena larghezza** viewport utile; le griglie `SgqDataGrid` restano `width: 100%` del contenitore. Mobile già gestito (`@media ≤768px`): non rompere lo stack.

## File previsti

- `app/src/pages/NormLibraryPage.css` — alza/rimuovi `max-width: 1100px` su `.nl-page` (desktop); mantieni padding/responsive; **non** allargare forzatamente elementi che devono restare stretti (es. form digitize `max-width: 480px`, testo header `52rem` se ancora leggibile)
- `app/src/tests/normLibraryPage.fullWidth.test.js` (**nuovo**) — assert CSS: `.nl-page` senza cap 1100px desktop (o con max-width ≥ viewport / `none` / `100%` secondo scelta minima); media mobile ancora OK
- `docs/agent-tasks/DEPUTYTASK1.md` (questo brief — chiusura)
- Opz. aggiornamento checkbox in [`PLAN_LIBRERIA_UX_SLICES.md`](PLAN_LIBRERIA_UX_SLICES.md) a slice chiusa

**JSX:** toccare `NormLibraryPage.jsx` **solo** se un wrapper di layout è strettamente necessario e documentato; default = **solo CSS**.

## Cosa NON toccare

- `app/src/pages/NormLibraryPage.jsx` (salvo eccezione sopra)
- `app/src/layouts/AppLayout.jsx` / `AppLayout.css` (LUX-B)
- `app/src/services/apiService.js`
- Qualsiasi `backend/**`
- Componenti `SgqDataGrid` / grid globale
- Form «Aggiungi richiesta», Ambito, banner→pulsante SA
- `DEPUTYTASK2.md`, GUIDA, roadmap (in parallelo: bozza nel brief; sync hub dopo merge se serve)

## Criteri TEST OK

1. Desktop: `.nl-page` non è più limitato a `1100px`; contenuto/griglie usano la larghezza del layout app.
2. Mobile (≤768px): layout a colonna / scroll touch invariati (regressione CSS).
3. `cd app && NODE_ENV=test npm run test:run -- src/tests/normLibraryPage.fullWidth.test.js` verde (+ eventuale contract mobile già esistente se aggiornato).
4. `cd app && npm run build` OK.
5. Encoding UTF-8; niente tocco BE/deploy.

## Comando chiusura

`Leggi docs/agent-tasks/DEPUTYTASK1.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

Al termine: Stato **CHIUSO — TEST OK** (o FIX NON APPLICABILI), PR se Medio/basso FE, **non** mergiare su `main`.
