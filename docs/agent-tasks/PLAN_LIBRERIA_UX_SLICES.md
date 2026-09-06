# Piano slice — Libreria UX (full-width + alert in-app gap)

> **Destinazione**: (1) la pagina Libreria usa tutta la larghezza viewport utile (griglie `SgqDataGrid` al 100% del contenitore, mobile OK); (2) i **superadmin** vedono un segnale **in-app** (badge menu e/o conteggio coda) per gap piattaforma aperti, oltre all’email già attiva (LG-1).
>
> **Sequel di**: [`PLAN_LIBRERIA_NORME_SLICES.md`](PLAN_LIBRERIA_NORME_SLICES.md) (LN COMPLETATO) · [`PLAN_LIBRERIA_GAP_SLICES.md`](PLAN_LIBRERIA_GAP_SLICES.md) (LG-1…5 COMPLETATO; LG-6 push mobile resta nebbia).
>
> **Brief attivi (paralleli)**: [`DEPUTYTASK1.md`](DEPUTYTASK1.md) = **LUX-A** · [`DEPUTYTASK2.md`](DEPUTYTASK2.md) = **LUX-B**
>
> **Mappa creata**: 06/09/2026 · Lead (wayfinder) · solo pianificazione, niente codice applicativo in questa sessione

---

## Fuori scope (questa tornata)

- Nascondere/rimuovere selettore **Ambito** su Libreria (opzionale/bassa priorità — decisioni chiuse)
- Convertire banner in «pulsante richiesta superadmin» (superfluo — **non fare**)
- Nuovo form richiesta umana / ripristino form LN-5 locale
- Push notification mobile (LG-6)
- Toccare `SgqDataGrid` globale se basta il contenitore pagina
- Context 1M di default

## Non ancora specificato

- Se dopo LUX-A serve un secondo passaggio su header/azioni densità colonne (nebbia: solo se UX post-merge lo richiede)
- Polling badge: riuso intervallo 5 min di `AppLayout` vs refresh on focus — default LUX-B: stesso poll degli altri badge alert

## Decisioni già prese (analisi + HITL 06/09/2026)

- Ambito: lasciare **globale**; non rimuovere in questa tornata
- Banner → pulsante richiesta SA: **superfluo**, non fare
- Griglie a tutto schermo: oggi `.nl-page { max-width: 1100px }` — allargare = design voluto
- Alert SA: oggi solo email; manca badge/notifica in-app su voce Libreria / coda gap
- Due slice **parallele** con file **disgiunti** (CSS pagina vs menu+API)

## Mappa slice

| Slice | Tema | Perimetro (file/layer) | Dipende da | Tipo | Stato |
|-------|------|------------------------|------------|------|-------|
| **LUX-A** | Griglie Libreria full-width | FE CSS: `NormLibraryPage.css` (togli/alza max-width `.nl-page`); test L1 CSS contract; **no** `SgqDataGrid` globale; **no** JSX salvo wrapper minimo comprovato necessario | — | AFK | **APERTO** → [`DEPUTYTASK1.md`](DEPUTYTASK1.md) |
| **LUX-B** | Badge/alert in-app gap SA | FE: `AppLayout` badge su voce Libreria (pattern `sidebar-badge` già usato Documenti/Reclami); BE: count gap piattaforma aperti (`librarySourceRequest.*` + route); `apiService`; test L1 + BE; opz. conteggio header coda in `NormLibraryPage.jsx` **senza** toccare CSS | LG-1…3 già in main | AFK | **CHIUSO TEST OK** → [`DEPUTYTASK2.md`](DEPUTYTASK2.md) · branch `cursor/lux-b-libreria-gap-badge-1afa` |

**Stato piano:** LUX-A ancora APERTO; LUX-B CHIUSO TEST OK (06/09/2026).

## Disgiunzione file (prova overlap)

| Path | LUX-A | LUX-B |
|------|:-----:|:-----:|
| `app/src/pages/NormLibraryPage.css` | sì | no |
| `app/src/tests/normLibraryPage.fullWidth.test.js` (nuovo) | sì | no |
| `app/src/layouts/AppLayout.jsx` | no | sì |
| `app/src/layouts/AppLayout.css` | no | solo se serve tweak badge esistente |
| `app/src/services/apiService.js` | no | sì (metodo count / riuso queue) |
| `backend/src/services/librarySourceRequest.service.js` | no | sì |
| `backend/src/controllers/librarySourceRequest.controller.js` | no | sì |
| `backend/src/routes/librarySourceRequest.routes.js` | no | sì |
| `backend/src/services/librarySourceRequest.service.test.js` | no | sì |
| `app/src/tests/appLayoutLibraryGapBadge.test.jsx` (nuovo) | no | sì |
| `app/src/pages/NormLibraryPage.jsx` | **no** (CSS-only) | sì solo se conteggio in-page coda (opz.) |
| `app/src/components/SgqDataGrid*` | no | no |
| `docs/agent-tasks/DEPUTYTASK1.md` / `DEPUTYTASK2.md` | ciascuno il proprio | |

## Comandi lancio deputy (dopo brief su `origin/main`)

```text
Leggi docs/agent-tasks/DEPUTYTASK1.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```

```text
Leggi docs/agent-tasks/DEPUTYTASK2.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```

Due Cloud Agent / due chat in parallelo (VM isolate). Prima di codice: `git fetch` + `git show origin/main:docs/agent-tasks/DEPUTYTASKN.md` → `Stato: APERTO` e titolo LUX-*.
