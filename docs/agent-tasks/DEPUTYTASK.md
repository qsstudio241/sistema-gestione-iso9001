# DEPUTYTASK — CND-1: verbale VT usabile in tasca

**Stato:** CHIUSO — TEST OK  
**Aperto:** 23/08/2026  
**Chiuso:** 23/08/2026  
**Branch:** `cursor/cnd-1-marche-mobile-d554`  
**Piano:** [`PLAN_CND_SLICES.md`](PLAN_CND_SLICES.md)  
**Rischio:** Basso — solo frontend (layout marche su `NdtReportsPage`); niente schema, auth, sync, Word, 9712.  
**Slot precedente:** IA-16 CHIUSO [#534](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/534)
**Parallelo a:** CND-4 (`DEPUTYTASK2.md`) e CND-11 (`DEPUTYTASK1.md`) — non toccare Template report né ingest.

## Perché

Il verbale CND esiste e in officina al tavolo funziona. In campo (telefono, studio Mason dal cliente) l’elenco marche è una **tabella da 10 colonne** con scroll orizzontale: l’operatore non chiude il ciclo pezzo → giudizio → foto. Questa slice è il tracciante «hello world» dell’epic: **stesso verbale VT, stessa API, marche a scheda sul viewport stretto**.

## File previsti

- `app/src/pages/NdtReportsPage.jsx`
- `app/src/pages/NdtReportsPage.css`
- `app/src/tests/` — test L1 mirato sul rendering marche (nuovo file solo se serve; preferire test accanto a pattern già usati)
- `docs/agent-tasks/DEPUTYTASK.md` (questo brief, chiusura)
- `docs/agent-tasks/PLAN_CND_SLICES.md` (spunta CND-1 a slice chiusa)

## Cosa NON toccare

- `ndtReports.controller.js`, migrazioni, `auth.middleware`, `syncService`
- Gate 9712 (è **CND-2** / ISO-9)
- Parametri MT/PT/UT, ruoli strumenti, Word (flag/placeholder = CND-3 / CND-4, catalogo in appendice PLAN), registro documenti, ingest `report_ndt`
- `ReportTemplatesAdminPage.jsx` / `reportTemplate.service.js` (**CND-4**)
- `NdtItemAttachments.jsx` salvo import/uso già presente (hardening foto = **CND-6**)
- `EquipmentPage.jsx`, Qualifiche, RDP, Welding Book
- GUIDA / roadmap hub (questa chat è in parallelo potenziale dopo il merge della mappa: traccia nel brief)
- Nuova pagina `/cnd/...`, nuovo componente «NdtMobileApp», nuova tabella, IndexedDB

## Riuso obbligatorio (niente oggetti nuovi)

- Esito A / R / S: `status-btn` di `ChecklistModule.css` (in pagina oggi c’è `status-btn`: stessa famiglia, **non** una terza classe)
- Note difetto: `notes-textarea`
- Foto riga: `NdtItemAttachments.jsx` già montato
- Autosave: `useNdtAutoSave.js` invariato (zero campi nuovi)
- Sezioni: restano le 5 sezioni collassabili del verbale; non copiare un secondo layout
- DNA: schermata 3 (scheda a fasi, drawer NC) per la **singola marca** su `max-width: 768px`; desktop può restare tabella
- Token `:root` di `AppLayout.css` — niente palette nuova

## Slice (unica, questa sessione)

1. Sotto `768px`, ogni riga marca è una **scheda** (posizione, pezzo, % , difetto, A/R/S a pollice, foto, note se R/S). Niente `min-width: 720px` come unico modo per compilare.
2. Desktop (≥768px): tabella attuale invariata nel contenuto (stessi campi, stessi salvataggi).
3. Stesso payload `PUT` / autosave `useNdtAutoSave.js` — zero campi nuovi.
4. Touch: bersagli ≥ ~36px già accennati nel CSS; bottoni A/R/S e foto usabili col pollice.
5. Hint «scorri le colonne» diventa superfluo sul telefono (le schede non richiedono scroll orizzontale).

## Acceptance

- L1: `cd app && NODE_ENV=test npm run test:run` (mirato se aggiungi test) + `npm run build`
- Viewport 390×844: si compila una marca VT (codice, giudizio R, nota, si vede il controllo foto) senza scroll orizzontale della tabella
- Viewport desktop: elenco marche ancora tabellare, salvataggio invariato
- Nessuna API nuova; Network tab: stessi endpoint verbali

## Comando di lancio

`Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

---

## Esito (23/08/2026) — TEST OK

**Fatto:**
- Elenco marche VT: ogni riga è `tbody.ndt-mark-card` con `data-label` sulle celle (Pos./Codice, Q.tà, descrizione, parte, superficie, % Ctrl, difetti, giudizio A/R/S, foto, note se R/S).
- Viewport sotto 768px: layout a scheda (token AppLayout, DNA scheda a fasi). Bottoni A/R/S e foto ~44px. Hint «Scorri per vedere tutte le colonne» rimosso. Niente `min-width: 720px` sulla tabella marche.
- Desktop ≥768px: tabella invariata (`thead` visibile, `display: table-row-group`).
- Stesso verbale, stessa API. Riuso `status-btn` + `NdtItemAttachments` già montato. `useNdtAutoSave` non toccato.

**Test:**
- Vitest `ndtReportsMarksMobile.test.jsx` + `ndtReportsInstruments.test.jsx`: 6/6
- `cd app && npm run build`: OK

**Non toccato:** `ndtReports.controller`, migrazioni, auth, sync, 9712, MT/PT, Template report, ingest `report_ndt`, `useNdtAutoSave`, EquipmentPage, Qualifiche, GUIDA/roadmap hub, `DEPUTYTASK1.md`, `DEPUTYTASK2.md`.

**Non «pronta»:** manca lettura CI + Bugbot + Security Review su questa revisione. Merge solo click umano. `gh pr create` non disponibile da questo Cloud Agent (GraphQL createPullRequest). Branch pushata: `cursor/cnd-1-marche-mobile-d554`.
