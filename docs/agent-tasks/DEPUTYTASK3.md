# DEPUTYTASK3 — Shell dialog di revisione ingest: consolidare il guscio duplicato

**Stato:** CHIUSO — TEST OK (10/08/2026, PR [#377](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/377) — Bugbot: nessun rilievo critico, pronta per il merge umano)
**Priorità:** P2 — debito tecnico, nessun bug funzionale, basso rischio
**Branch base:** `main`
**Creato da:** Lead 10/08/2026
**Spec:** nessun ADR dedicato — contesto completo in [`docs/PROJECT_ROADMAP.md` § Backlog parcheggiato](../PROJECT_ROADMAP.md#backlog-parcheggiato-task-futuri--fonte-unica) (riga "Shell dialog di revisione ingest") e [`docs/GUIDA_CONSOLIDATA.md` § Lezioni apprese](../GUIDA_CONSOLIDATA.md#lezioni-apprese-consolidate-fonte-unica)

> **Allineamento Git (autonomo)**: prima di leggere questo brief eseguire `git fetch origin main` e `git pull origin main`. **Non** chiedere al committente di farlo.

---

## Contesto (leggere prima)

Il committente ha segnalato (10/08/2026) di ricordare una duplicazione tra il dialog di revisione ingest iniziale e quello della coda di rielaborazione. Verificato nel codice — la sostanza:

- `app/src/components/IngestReviewDialog.jsx` e il dialog interno `ReprocessGroupDialog` (dentro `app/src/components/ReprocessQueueBanner.jsx`) **condividono già** `IngestSourcePreview`, `FieldInput` (importato da `IngestReviewDialog.jsx`) e l'hook `useIngestReviewSplit` — riuso reale, fatto in una sessione precedente (09/08/2026, vedi header di `ReprocessQueueBanner.jsx`).
- Resta duplicato solo il **guscio visivo**: overlay fullscreen (`role="dialog"`, `aria-modal`), header con pulsante "Ingrandisci affiancato"/"Riduci", grid preview+resizer+contenuto, gestione Escape. CSS quasi clone: `.ingest-review__*` (`IngestReviewDialog.css`) vs `.reprocess-dialog__*` (`ReprocessQueueBanner.css`) — circa 60-80 righe di markup/CSS ripetute.
- **Non è lo stesso componente riducibile a uno**: `IngestReviewDialog` gestisce un intero documento con logica di confidenza adattiva (readonly/editable, "Modifica"/"Annulla modifica") e azioni batch (Conferma tutto/Scarta); `ReprocessGroupDialog` gestisce N campi in rielaborazione sullo stesso documento con conferma/scarto **per campo**, via API staging diversa. Il dominio resta distinto — **non fondere i due flussi**.
- **Nota di scala**: il pattern "ogni dialog reinventa il proprio overlay CSS" è sistemico su molti altri modal del progetto (`NcCreateModal.jsx`, `RisksPage.jsx`, `QualificationForm.jsx`, `DeadlineImportDialog.jsx`, …) — **questo slice NON affronta quel problema più ampio**, tocca solo il guscio dei due dialog ingest. Se in futuro si vuole un `Modal.jsx`/`Dialog.jsx` di base condiviso da tutto il progetto, serve una sessione dedicata separata (stima più ampia, non uno slice).

## Obiettivo dello slice

Estrarre il guscio comune (overlay + header con expand + layout preview/resizer/contenuto + gestione Escape) in un componente condiviso, usato da **entrambi** `IngestReviewDialog.jsx` e `ReprocessQueueBanner.jsx`, senza cambiare il comportamento visibile né la logica di business di nessuno dei due.

**Approccio consigliato** (non prescrittivo — il deputy può proporre un'alternativa se più pulita):
1. Leggere per intero entrambi i file (`IngestReviewDialog.jsx`, `ReprocessQueueBanner.jsx`) e i rispettivi CSS, elencando riga per riga cosa è identico e cosa differisce (props necessarie: titolo, contenuto preview, contenuto centrale, footer/azioni — quelli restano specifici di ciascun dialog, passati come children/props).
2. Creare `app/src/components/IngestDialogShell.jsx` (nome indicativo) che accetta: `title`, `onClose`, `previewSlot` (o props per `IngestSourcePreview`), `contentSlot`, `footerSlot`, e gestisce internamente overlay/expand/resizer/Escape (riusando `useIngestReviewSplit`).
3. Un solo file CSS condiviso (es. `IngestDialogShell.css`) con le classi base (`.ingest-dialog-shell__*`), sostituendo `.ingest-review__*`/`.reprocess-dialog__*` dove sono puro guscio (le classi specifiche di contenuto restano nei rispettivi file).
4. Riscrivere `IngestReviewDialog.jsx` e `ReprocessGroupDialog` (in `ReprocessQueueBanner.jsx`) per usare la shell condivisa, mantenendo intatta la logica di campi/conferma/scarto di ciascuno.

**Se durante l'analisi risulta che l'estrazione forza un'API scomoda o rischia di introdurre regressioni sottili** (es. il resizer o l'expand hanno comportamenti leggermente diversi tra i due dialog che non è ovvio unificare), fermarsi e chiudere con **FIX NON APPLICABILI**, motivando con dettaglio — non forzare un'astrazione se il costo supera il beneficio (debito basso, non c'è un bug da risolvere).

## DoD

- Nessuna regressione visiva o funzionale su entrambi i dialog (screenshot prima/dopo se possibile via `computerUse`, o quantomeno verifica manuale che espandi/riduci, resizer, conferma/scarto funzionino identici a prima).
- Test esistenti che coprono `IngestReviewDialog`/`ReprocessQueueBanner` continuano a passare senza modifiche forzate al loro comportamento osservabile.
- Diff CSS: eliminazione delle righe duplicate identificate, non semplice aggiunta di ulteriore codice sopra l'esistente.

**Test L1 mirato:**
```bash
cd app && NODE_ENV=test npx vitest run src/tests/reprocessQueueBanner.test.jsx src/tests/ingestReviewDialog.test.jsx src/tests/useIngestReviewSplit.test.js
cd app && npm run build
```

---

## Verifica di chiusura (gate)

Suite Vitest completa (`NODE_ENV=test npm run test:run`) + `npm run build` verdi prima di apire la PR. Nessuna migrazione, nessun backend coinvolto in questo slice.

Chiudere con **TEST OK** o **FIX NON APPLICABILI** (motivare in dettaglio se l'estrazione non risulta pulita — vedi nota sopra).

---

## Comando deputy

```
Leggi docs/agent-tasks/DEPUTYTASK3.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```
