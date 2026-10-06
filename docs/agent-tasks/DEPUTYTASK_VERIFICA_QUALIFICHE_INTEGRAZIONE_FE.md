# DEPUTYTASK_VERIFICA_QUALIFICHE_INTEGRAZIONE_FE — VQ-9: integrazione FE della verifica qualifiche vs norma (ingest review + form + riepilogo batch)

**Stato:** CHIUSO — TEST OK (06/10/2026, branch `cursor/vq-9-integrazione-fe-b8ef`; PR draft, merge/undraft del teammate ProgettoISO)  
**Aperto:** 06/10/2026  
**Piano:** [`PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md`](PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md) § 1.3 (contratto) · § 1.5 (dove si aggancia) · § 6.2 riga VQ-9 · § 6.3 VQ-9  
**Dipende da:** VQ-2 (`QualificationVerifyPanel`), VQ-7 (`POST /qualifications/verify`, `verification` nell'ingest); VQ-5/VQ-6 per esiti reali (già su `main`)  
**Rischio:** **Medio** — solo FE, additivo, nessuna migrazione/auth/sync/BE. Il percorso Qualifiche + ingest è critico: smoke `SGQ_SMOKE_PATHS=login,qualifiche` previsto dopo il deploy (VQ-12), non eseguito in questa slice.  
**Stream:** `DEPUTYTASK_VERIFICA_QUALIFICHE_*.md` (epic verifica qualifiche vs norma; non riusare questo file per altri epic)  
**Contesto consigliato:** default/basso (non 1M)

---

## Obiettivo (una slice = un risultato verificabile)

Il pannello `QualificationVerifyPanel` (VQ-2, solo presentazionale) è montato nei due punti di revisione dei dati (dialog di revisione ingest e form qualifica) con la chiamata fatta dal genitore via `apiService.verifyQualification`, più un riepilogo avvisi nel caricamento batch. Gli esiti sono **sempre non bloccanti**: non disabilitano nessun pulsante, non toccano `form`/auto-save, non riscrivono nessun campo (la validità scritta sul certificato prevale). Decisioni D1–D8 confermate (D3 no: nessuna «presa visione»; D7 no: nessun campo Annex A nuovo).

## Gate norme (dichiarato)

Non norm-touching: nessuna soglia/clausola codificata (il testo delle clausole arriva dal motore BE, VQ-5/VQ-6). La slice consuma solo il contratto `VerifyResult` (§ 1.3).

## Checklist dato ↔ norma ↔ UI ↔ API

| Dato | Clausola / fonte MD | UI | API / persistenza |
|------|---------------------|----|-------------------|
| `VerifyResult.findings[]` (qualifica saldatore 9606 / operatore 14732) | citata nel `message_it` e in `source.clause` dal motore BE | `QualificationVerifyPanel` in `IngestReviewDialog` e `QualificationForm`; conteggio `summary.warn` in `QualificationUploadButton` | `POST /qualifications/verify` stateless (VQ-7) · `verification` nelle risposte ingest/confirm · **nessuna persistenza**, nessun nuovo `fetch` |

Nessuna nuova colonna, nessun campo AI-estraibile nuovo (nessuna voce Rielaborazioni).

## File toccati

- *M* `app/src/components/IngestReviewDialog.jsx` — hook esportato `useQualificationVerify` (+ `buildVerifyFields`, `isVerifiableDocType`), pannello montato sopra i campi, niente duplicazione degli avvisi già nel pannello
- *M* `app/src/pages/QualificationForm.jsx` — sezione «Verifica rispetto alla norma» (pulsante «Verifica» + pannello), blur con debounce dopo una modifica utente
- *M* `app/src/components/QualificationUploadButton.jsx` — `summarizeNormVerification` + riga di riepilogo avvisi nei risultati; inoltra `verification` e `onVerificationChange` al dialog
- *M/N* test: `ingestReviewDialog.test.jsx`, `qualificationUploadButton.test.jsx`, nuovo `qualificationFormVerify.test.jsx`
- **Non toccati (dichiarato):** `QualificationsPage.jsx`, `QualificationVerifyPanel.*`, `jointTypeProfiles.js`, BE, `BillingDashboardPage`, CSS

## Comportamento per punto di integrazione

- **`IngestReviewDialog`** (solo `docType` `patentino_saldatore` / `qualifica_14732`): se arriva la prop `verification` la mostra senza chiamate; altrimenti **una** chiamata all'apertura. Poi si aggiorna al **blur** sui campi (debounce 600 ms); mai a ogni tasto; la stessa combinazione di campi già verificata (o in volo) non viene richiesta di nuovo; le risposte superate da una richiesta più recente sono ignorate. Loading/errore/offline sono gli stati del pannello; «Conferma e salva», «Scarta», «Chiudi» restano sempre attivi. Gli altri tipi documento (NDT, WPS, WPQR, norme, SAL) non cambiano.
- **`QualificationForm`** (tipi con «9606» o «14732»): nessuna chiamata all'apertura. Verifica a pulsante «Verifica» o al **blur dopo una modifica dell'utente** (debounce), con firma sui soli campi rilevanti (blur su nome/note non rilancia). L'hook non modifica `form`: l'auto-save (800 ms) resta indipendente, anche con verifica in errore/offline/API assente.
- **`QualificationUploadButton`**: riga «Verifica norma: N avvisi in X su Y file verificati — gli avvisi non impediscono il salvataggio» solo per i risultati che hanno già `verification` (dall'estrazione, dalla revisione tramite `onVerificationChange`, dalla conferma). Nessun esito → nessuna riga (nessun conteggio inventato).
- **`QualificationsPage`**: **nessun badge in lista**. Il record della lista (`getQualifications`) non porta né `verification` né `warnings`; mostrare un badge richiederebbe una chiamata per riga a `/qualifications/verify` (loop su liste, vietato) o un nuovo campo BE (fuori scope). Il dettaglio è già coperto dal pannello nel form aperto dalla pagina. Se il committente vuole il badge in lista: slice BE separata (conteggio avvisi persistito/calcolato lato lista).

## Test L1

- `cd app && NODE_ENV=test npx vitest run` sui file: `ingestReviewDialog`, `qualificationFormVerify`, `qualificationUploadButton`, `qualificationForm*` (inclusi `ConditionalFields`, `Autosave`, `14732`, `JointProfiles`), `qualificationsPage*`, `qualificationVerifyPanel`, `routerContext.match`, `reprocessQueueBanner`, `normUploadButton`, `batchUploadButtonsNoCompany`, `salAiSuggest`, `normLibraryPage`, `weldingProcedures*` → 20 file / 178 test verdi
- `npm run build` verde · `node backend/scripts/check-harness-boot.js` OK · `node backend/scripts/check-utf8-encoding.js` 0 issue
- La suite completa `vitest run` in questa VM va in OOM (limite noto della suite, non legato alla slice): L1 = test mirati + build.

## DoD

- [x] Pannello montato in `IngestReviewDialog` (usa `verification` se presente, altrimenti chiama l'endpoint) e in `QualificationForm` (blur / pulsante)
- [x] Mai a ogni keystroke; stati loading/errore/offline dal pannello; mai bloccante; auto-save invariato
- [x] Riepilogo avvisi in `QualificationUploadButton`
- [x] Badge in `QualificationsPage`: non fattibile senza nuove chiamate → dichiarato, non inventato
- [x] Nessun nuovo `fetch` (solo `apiService`), nessun link nuovo (`routerContext.match.test.js` verde), pulsanti operativi sempre visibili
- [x] Nessun cambio di comportamento quando la verifica non risponde (test: errore, offline, `verifyQualification` assente)

## Rischi / decisioni aperte

- **BE (fuori scope VQ-9):** `uploadBatch` in `qualifications.controller.js` non inoltra `verification` nell'entry `pending_review` (inoltra solo `warnings`, che già contengono i `message_it`). Effetto: il dialog fa una chiamata all'apertura invece di usare l'esito dell'estrazione, e il riepilogo batch compare dopo la revisione/conferma. Fix a una riga lato BE: aggiungere `verification: extracted.verification` all'`entry`.
- Hook `useQualificationVerify` esportato da `IngestReviewDialog.jsx` (non in un file `hooks/`) per restare nei file della riga VQ-9 § 6.2; spostarlo in `app/src/hooks/` è un refactor a costo zero quando serve riusarlo altrove.
- Il dialog dedupe visivamente i `warnings` identici ai `message_it` del pannello solo quando l'esito è `ready`; in errore/offline restano i warning dell'ingest.
- Coda Rielaborazioni FE (VQ-4): `ReprocessQueueBanner` importa solo `FieldInput` dal dialog, non lo monta → non toccato.

## Comando di avvio

`Leggi docs/agent-tasks/DEPUTYTASK_VERIFICA_QUALIFICHE_INTEGRAZIONE_FE.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Handoff

_(vuoto — slice chiusa)_
