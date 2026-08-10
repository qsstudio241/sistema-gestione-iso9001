# DEPUTYTASK4 — Modulo Saldatura (Procedure WPS/WPQR): regola "Filtri, singola fonte di verità"

**Stato:** CHIUSO — TEST OK (10/08/2026)
**Priorità:** P2 — stessa classe di bug UX già corretta in Qualifiche (PR #368), Scadenzari (PR #371/#375), NC (PR #374) — non urgente, nessun dato invisibile noto finché non verificato
**Branch base:** `main`
**Creato da:** Lead 10/08/2026
**Spec:** [`.cursor/rules/sgq-operating-memory.mdc` § Filtri: singola fonte di verità](../../.cursor/rules/sgq-operating-memory.mdc) — leggere per intero la regola e i 3 precedenti già risolti prima di iniziare

> **Allineamento Git (autonomo)**: prima di leggere questo brief eseguire `git fetch origin main` e `git pull origin main`. **Non** chiedere al committente di farlo.

---

## Contesto (leggere prima)

Il committente ha segnalato (10/08/2026, screenshot pagina "Procedure di Saldatura") lo stesso pattern di card statistiche duplicate da tendine di filtro, già risolto in tre moduli in questa stessa sessione:

- **Qualifiche** (PR #368): card "Non attiva" aggiunta, tendina "Filtra per situazione" rimossa.
- **Scadenzari** (PR #371 + #375): card "Archiviate"/"Prese in carico" aggiunte, tendina "Stato" rimossa, azioni mancanti per raggiungere quegli stati aggiunte in un secondo giro di audit.
- **Non Conformità** (PR #374): card "Chiuse" aggiunta, due tendine ridondanti rimosse.

**Questo modulo NON è mai stato toccato** in nessuna delle sessioni precedenti — è un caso nuovo, non una regressione.

## Cosa verificare (file: `app/src/pages/WeldingProceduresPage.jsx`)

Il modulo ha **due sotto-tab distinti** (WPS e WPQR), ognuno con i propri filtri — la card statistica in alto (`Valide`/`Scad. 60 gg`/`Scad. 30 gg`/`Scadute`/`Da approvare`, righe ~1155-1159) sembra condivisa/adiacente a entrambi i tab. **Prima cosa da fare**: capire a quale tab (o a entrambi) si applicano davvero quelle 5 card, leggendo dove viene popolato l'oggetto `stats` e da quale chiamata API.

Punti già individuati (verificarli, non assumerli):

1. **Tab WPS** (righe ~1281-1294): dropdown `wpsFilters.status` con opzioni da `WPS_STATUSES` (riga ~41) + dropdown `wpsFilters.welding_process` ("Tutti i processi"). Il secondo filtro (processo) è una **dimensione diversa** dallo stato — non è ridondante, non toccarlo. Verificare se le opzioni di `WPS_STATUSES` coincidono con le 5 card o hanno valori extra (come "sospesa"/"revocata" lo erano per Qualifiche prima del fix).
2. **Tab WPQR** (righe ~1421-1427): dropdown `wpqrFilters.approval_status` con opzioni hardcoded `bozza`/`approvata`/`rifiutata` — verificare se questi 3 valori corrispondono (in tutto o in parte) alla card "Da approvare", o se rappresentano una dimensione a sé (workflow di approvazione) distinta dal semaforo scadenza (`Valide`/`Scad. 60/30`/`Scadute`).
3. Verificare se le card sono già cliccabili/filtranti (come negli altri 3 moduli corretti) o sono solo contatori statici — se sono solo contatori, valutare se renderle cliccabili fa parte di questo slice o è fuori scope (decidere in base a quanto trovato, documentare la scelta).

## Come procedere (stesso metodo degli slice precedenti — non copiare la soluzione alla cieca)

1. Elencare ESATTAMENTE tutti i valori distinti gestiti da ciascuna card e da ciascuna tendina (per entrambi i tab WPS e WPQR separatamente).
2. Se una tendina ha opzioni **non** coperte da nessuna card, **non limitarsi a rimuoverla** — valutare se aggiungere la card mancante (pattern "Non attiva"/"Archiviate"+"Prese in carico"/"Chiuse" già usato) o se lasciare quella tendina perché rappresenta davvero una dimensione distinta (come "processo" per WPS).
3. Solo dopo questa mappatura completa, decidere cosa consolidare. Se il risultato dell'analisi è "qui le tendine non sono ridondanti, sono dimensioni diverse" — è un esito legittimo: chiudere con **FIX NON APPLICABILI** e documentare perché (non forzare una rimozione se l'analisi non la giustifica).
4. Se si interviene sul backend (`backend/src/controllers/welding.controller.js`), verificare se esistono già bug analoghi a quelli trovati negli altri moduli (es. calcolo card basato su una data diversa da quella del semaforo per-riga, valori di stato "orfani" non riconosciuti in UI) — stesso tipo di verifica incrociata fatta per Scadenzari/Qualifiche.

## DoD

- Nessuna funzionalità di filtro persa rispetto a oggi.
- Se si tocca il backend: nuovi test L1 di regressione (pattern già usato: `qualifications.controller.test.js`, `deadlines.controller.test.js`).
- Se si tocca il frontend: nuovo test per il comportamento delle card (pattern già usato: `ncPage.filterCards.test.jsx`, `deadlinesPage.filterCards.test.jsx`).
- Aggiornare `docs/GUIDA_CONSOLIDATA.md` (sintesi) e la tabella priorità in `docs/PROJECT_ROADMAP.md § Stato attuale e priorità` (rimuovere o chiudere la riga corrispondente).

**Test L1 mirato (adattare al modulo reale trovato):**
```bash
cd app && NODE_ENV=test npx vitest run src/tests/weldingProcesses4063.test.js src/tests/weldingProceduresP2bLegacyUpload.test.jsx
cd backend && npx jest welding.controller --silent
```

---

## Verifica di chiusura (gate)

Suite Vitest completa (`NODE_ENV=test npm run test:run`) + suite Jest backend + `npm run build` verdi prima di aprire la PR. Se si tocca il backend: deploy VPS (`bash backend/scripts/deploy-to-vps.sh`) dopo il merge, con verifica PID/health — o segnalare al committente/Lead che serve.

Chiudere con **TEST OK** o **FIX NON APPLICABILI** (motivare con la mappatura fatta al punto 1-3 sopra).

---

## Esito (10/08/2026) — TEST OK

**Mappatura (punti 1-3)**:
- Le 5 card (Valide/Scad.60/Scad.30/Scadute/Da approvare) sono calcolate **solo** su `wpqr_records` (`getWPQRStats`) — nessun legame con il tab WPS. Erano però mostrate sempre, anche fuori contesto (fix: gate `activeTab === "wpqr"`).
- Tab WPS: `status` (`WPS_STATUSES`: attiva/bozza/sospesa/revocata) e `welding_process` sono due dimensioni distinte tra loro e **non correlate** alle card WPQR — nessuna card le duplica, nessuna azione necessaria. Confermato: non è una regressione, è un caso realmente diverso dai 3 precedenti.
- Tab WPQR: tendina `approval_status` (bozza/approvata/rifiutata) duplicava **esattamente** la card "Da approvare" (bozza); "rifiutata" era un valore **orfano** invisibile in ogni card (stesso gap di "Sospesa"/"Revocata" in Qualifiche); "approvata" non aveva una card 1:1 (unione di Valide+Scad.60+Scad.30+Scadute).
- Bug trovato in aggiunta (punto 4 del brief): il bucket SQL "scadute" non filtrava per `approval_status='approvata'` a differenza degli altri 3 bucket — un WPQR bozza/rifiutata scaduto finiva contato in "Scadute" (rosso) mentre a riga il semaforo lo mostra grigio "Non approvata".

**Fix applicati**:
1. Backend (`welding.controller.js`, `getWPQRStats`): bucket "scadute" ora richiede `approval_status='approvata'`; aggiunti bucket "rifiutate" e "approvate".
2. Frontend (`WeldingProceduresPage.jsx`): barra statistiche mostrata solo su `activeTab==="wpqr"`; tendina `approval_status` rimossa, sostituita da 3 card cliccabili con toggle (Da approvare/Approvate/Rifiutate); le 4 card semaforo scadenza restano informative (nessuna tendina le duplicava — introdurre filtri backend per bucket di scadenza è fuori scope minimo di questa slice, non c'è perdita di funzionalità rispetto a oggi).
3. Nessuna funzionalità di filtro persa: tutti i valori prima raggiungibili solo dalla tendina (bozza/approvata/rifiutata) restano raggiungibili dalle nuove card.

**Test**: `welding.controller.wpqrStats.test.js` (4 test, backend) + `weldingProceduresPage.filterCards.test.jsx` (5 test, frontend) + suite Vitest completa (1044 test) + suite Jest `welding.controller*` (10 test) + `npm run build` verdi. Suite Jest backend completa: 8 suite falliscono per cause **preesistenti su `main`, non correlate** (config `database.json` assente nel Cloud Agent + bug preesistente in `customChecklist.legislativoSicurezza.test.js`, verificato con `git stash` sul commit base).

**Doc aggiornata**: `GUIDA_CONSOLIDATA.md` (nuova riga lezioni apprese) + `PROJECT_ROADMAP.md` § Stato attuale e priorità (chiusa anche la riga NC, già risolta da PR #374 ma non ancora rimossa dalla tabella).

---

## Comando deputy

```
Leggi docs/agent-tasks/DEPUTYTASK4.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```
