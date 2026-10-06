# DEPUTYTASK_VERIFICA_QUALIFICHE_RIELAB_FE — VQ-4: riga «Verifica qualifiche vs norma» in Fatturazione → Rielaborazioni (FE)

**Stato:** APERTO — lanciabile **solo dopo il merge su `origin/main`** della PR di charting (gate DEPUTYTASK: `git show origin/main:docs/agent-tasks/DEPUTYTASK_VERIFICA_QUALIFICHE_RIELAB_FE.md` deve mostrare `APERTO`)  
**Aperto:** 06/10/2026  
**Piano:** [`PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md`](PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md) § 2 (voce Rielaborazioni di tipo verifica) · § 6.3 VQ-4  
**Dipende da:** il **contratto API di § 2.2** (campo `kind`, risposta `kind:'verify'`), congelato nel piano. Il BE arriva in VQ-8: qui si lavora su mock  
**Rischio:** **Medio** — solo FE, superadmin, percorso fatturazione/rielaborazioni esistente; nessun cambio BE né a `apiService`. Diventa **Alto** se per farlo serve toccare `reprocessTasks.controller.js` o il registro BE.  
**Stream:** `DEPUTYTASK_VERIFICA_QUALIFICHE_*.md` (non riusare per altri epic)  
**Branch suggerito:** `cursor/vq-4-rielab-fe-<suffisso>`  
**Contesto consigliato:** default/basso

---

## Obiettivo (una slice = un risultato verificabile)

In `BillingDashboardPage` le voci Rielaborazioni con `kind: 'verify'` compaiono (solo se `candidate_count > 0`, come ogni voce) in una **sotto-sezione «Verifica qualifiche vs norma»**, **fuori** dal totale «dati AI mancanti», con:

- etichetta propria del conteggio («record con avvisi norma»);
- testo esplicito «sola lettura: nessuna modifica ai record, nessuna AI»;
- pulsante «Esegui verifica» (sempre visibile; `disabled` + `title` in corso/nessun candidato);
- al termine, tabella esiti (`items[].findings`: record, finding, letto/atteso, clausola) + «Scarica CSV» (client-side) + riepilogo (`recordsChecked`, `recordsWithWarnings`, `findingsByCode`, `notVerifiable`);
- messaggio «Il numero non scende dopo la verifica: si azzera correggendo i record in Qualifiche».

Le voci **senza** `kind` (backfill) si comportano **esattamente come oggi** (test esistenti verdi senza modifiche).

## Gate norme (dichiarato)

Slice di sola presentazione: **non** aggiunge soglie né clausole; mostra `source.clause`, `message_it`, `read_value`, `expected_value` come arrivano dal BE.

- **Coperte / mancanti:** non applicabile al codice (le clausole stanno nei pack, VQ-5/6/10/11).
- **Si parte su:** voce `verify_9606_1` (prima onda BE); le altre (`verify_9606_2`, `verify_14732`) compariranno da sole quando il BE le espone: il FE itera per `kind`, nessun elenco hard-coded di chiavi.

## Checklist dato ↔ norma ↔ UI ↔ API

| Dato | Clausola / fonte MD | UI | API / persistenza |
|------|---------------------|----|-------------------|
| `kind` della voce (`'verify'` vs assente) | — | partizione della lista: backfill (come oggi) · sotto-sezione «Verifica qualifiche vs norma» | `GET /admin/reprocess-tasks` (campo `kind` aggiunto da VQ-8) |
| `candidate_count` delle voci verify | — | riga con etichetta «record con avvisi norma»; **non** sommato a `total_candidates` né all'alert «dati AI mancanti» | idem |
| Report `kind:'verify'` (`recordsChecked`, `recordsWithWarnings`, `findingsByCode`, `notVerifiable`, `items[]`, `hasMore`) | clausola per finding (`source.clause`) | tabella esiti + CSV | `POST /admin/reprocess-tasks/:key/run` (esistente, risposta estesa da VQ-8) · **nessuna persistenza** |

Nessuna nuova colonna. Nessun campo AI nuovo.

## File previsti

- *Modificato* `app/src/pages/BillingDashboardPage.jsx`
- *Modificato* `app/src/pages/BillingDashboardPage.css`
- *Modificato* `app/src/tests/billingDashboardReprocess.test.jsx` (**solo aggiungere** casi; gli esistenti non si modificano)
- Solo lettura/riuso: `app/src/services/apiService.js` (`getReprocessTasks`, `runReprocessTask` **esistenti**), `app/src/design-system/README.md`, `docs/reference/LIBRERIA_UI_SGQ.md`

## Cosa NON toccare

`apiService.js` (nessun metodo nuovo: si usano `getReprocessTasks`/`runReprocessTask`), `ReprocessQueueBanner.*`, qualsiasi file `backend/`, `QualificationVerifyPanel.*` (VQ-2), `IngestReviewDialog.jsx`, `QualificationForm.jsx`, `RouterContext`, `database/migrations/**`, `PROJECT_CONTEXT.md`.

## Cosa fare

1. Leggere **prima di scrivere markup** `app/src/design-system/README.md` e `docs/reference/LIBRERIA_UI_SGQ.md`; copiare lo schema delle righe Rielaborazioni già presenti (nessun look nuovo, classi esistenti, badge `sq-tag`).
2. Partizionare `tasks` per `kind === 'verify'`. Il calcolo del totale e l'alert «N record possono essere aggiornati con dati AI mancanti» usano **solo** le voci backfill (invariato per costruzione).
3. Sotto-sezione «Verifica qualifiche vs norma», mostrata solo se esiste almeno una voce verify con `candidate_count > 0`; nota fissa «Sola lettura: nessuna modifica ai record, nessuna AI, nessun costo» e «Consigliato: eseguire prima i backfill dei dati di prova, poi la verifica» (i record senza dati di prova risultano «non verificabili»).
4. «Esegui verifica» per voce: chiama `runReprocessTask(key, …)` con gli stessi parametri della riga backfill (organizzazione se già selezionabile); durante la chiamata `disabled` + `aria-busy`; errore → `role="alert"` con messaggio, pulsante di nuovo disponibile.
5. Risultato: riepilogo + tabella `items` (colonne: Persona/Certificato · Avviso (`message_it`) · Letto · Atteso dalla norma · Clausola), `hasMore` → nota «Mostrati i primi N record»; «Scarica CSV» costruito client-side (separatore `;`, escape delle virgolette, BOM UTF-8 nel file scaricato perché Excel legga gli accenti; il BOM è nel blob, non nei sorgenti); nessun link nuovo (se serve il link al record, usare il pattern `?select=` e rispettare «URL: query ≠ pagina» + `routerContext.match.test.js`).
6. Dopo l'esecuzione il conteggio **non** viene decrementato localmente e il messaggio lo dichiara.
7. Testi italiani con accenti corretti; eventuali `\u` solo dentro stringhe JS in espressione.

## Test L1

Comandi: `cd app && NODE_ENV=test npx vitest run src/tests/billingDashboardReprocess.test.jsx` + `npm run build` + `node backend/scripts/check-utf8-encoding.js`.

- Voci senza `kind` → rendering identico a oggi (i test esistenti passano senza ritocchi).
- Voce `kind:'verify'` con `candidate_count > 0` → compare nella sotto-sezione, **non** nel totale «dati AI mancanti»; con `candidate_count = 0` non compare.
- «Esegui verifica» chiama `runReprocessTask` con la chiave giusta; stato in corso (`disabled`/`aria-busy`); risposta `kind:'verify'` → riepilogo + righe `items` con clausola; `hasMore` → nota; CSV generato (contenuto/escape); errore → `role="alert"` e pulsante riutilizzabile.
- Il conteggio non scende dopo la verifica; testo «sola lettura» presente.
- Fixture mock costruite dal contratto di piano § 2.2.

## Rielaborazioni (Registro)

**Esenzione dichiarata per questa slice:** è FE; la voce (`verify_9606_1`) e il test di sincronia sono **VQ-8**. Nessun campo AI, nessuna colonna, nessun valore persistito.

## DoD

- [ ] Sotto-sezione «Verifica qualifiche vs norma» con riga/etichetta propria, fuori dal totale «dati AI mancanti»
- [ ] «Esegui verifica» sempre visibile (`disabled` + `title`), tabella esiti + CSV, nota «sola lettura»
- [ ] Il conteggio non scende dopo l'esecuzione (messaggio esplicito)
- [ ] Voci backfill invariate; test esistenti non modificati e verdi
- [ ] DNA UI rispettato, nessun `fetch` diretto, nessun nuovo metodo `apiService`
- [ ] `NODE_ENV=test npx vitest run src/tests/billingDashboardReprocess.test.jsx` verde + `npm run build` OK; **nessun file in `backend/`** nel diff
- [ ] `check-utf8-encoding.js` e `check-harness-boot.js` OK
- [ ] Branch allineato a `origin/main` prima di push/PR; `bugbot run` **una sola volta** a slice chiusa

## HITL

Nessuno. Nota per il committente nel body PR: la voce comparirà in produzione solo dopo VQ-8 + deploy; fino ad allora il FE non mostra nulla di nuovo (nessuna voce `kind:'verify'` dal BE).

## Comando di avvio

`Leggi docs/agent-tasks/DEPUTYTASK_VERIFICA_QUALIFICHE_RIELAB_FE.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Handoff

_(vuoto)_
