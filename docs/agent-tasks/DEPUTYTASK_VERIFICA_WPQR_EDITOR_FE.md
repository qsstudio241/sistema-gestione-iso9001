# DEPUTYTASK_VERIFICA_WPQR_EDITOR_FE — WV-6a: `WpqrTestRunsEditor` (FE presentazionale, tabella passate) + `apiService` (3 metodi WPQR)

**Stato:** CHIUSO — TEST OK (08/10/2026) — PR draft `cursor/wv-6a-editor-passate-wpqr-064b`; componente non montato (montaggio in WV-6b); rotte `test-runs`/`verify` nascono in WV-4a/WV-5c
**Aperto:** 07/10/2026  
**Piano:** [`PLAN_VERIFICA_WPQR_SLICES.md`](PLAN_VERIFICA_WPQR_SLICES.md) § 2.2 (colonne) · § 2.3 · § 6.3 WV-6a  
**Dipende da:** il **contratto API nel piano** (non da WV-3/WV-4: l'editor lavora su fixture; i metodi `apiService` precedono le rotte, come VQ-2 rispetto a `POST /qualifications/verify`)  
**Rischio:** **Basso** — solo FE additivo, componente presentazionale **non montato** in nessuna pagina (il montaggio è WV-6b). Nessun BE, nessuna migrazione.  
**Stream:** `DEPUTYTASK_VERIFICA_WPQR_*.md` (non riusare per altri epic)  
**Branch suggerito:** `cursor/wv-6a-editor-fe-<suffisso>`  
**Contesto consigliato:** default/basso

---

## Obiettivo (una slice = un risultato verificabile)

Esiste `WpqrTestRunsEditor`: componente **controllato** (`value`, `onChange`, `readOnly`, `standardFamily`) che mostra e modifica la **tabella passate** della seconda pagina della WPQR — Run (etichetta **testo**, es. `2 +n`), processo, Ø del filler (numerico), corrente A e tensione V (**valore singolo**), tipo corrente/polarità (può restare vuota: ripiego sulla testata), velocità di avanzamento (valore + unità), apporto termico (valore + unità: `kJ/mm`, `J/mm`, `kJ/cm`), trasferimento, note — con aggiunta/rimozione riga. La **velocità filo** (valore + unità) è **opzionale e fuori dalla vista di default** (0/18 righe nel campione dei 10 certificati PROD, 07/10/2026: piano «Evidenze dal campione»). Per `standardFamily = '14555'` mostra la **variante stud** (corrente, tempo, sporgenza, alzata; e, per scarica capacitiva, capacità, tensione di carica, gap/lift, forza molla). Non è montato in nessuna pagina in questa slice.

`apiService` guadagna tre metodi secondo il contratto del piano (le rotte nascono in WV-4/WV-5c): `getWpqrTestRuns(wpqrId)`, `saveWpqrTestRuns(wpqrId, runs)`, `verifyWpqr(fields, { runs, standardReference })`.

## Gate norme (dichiarato)

Slice di sola presentazione: **non** aggiunge soglie, clausole né regole. Le colonne rispecchiano il modulo (15614-1 Annex B pag. 2, 15614-2 Annex A, 14555 Annex C) come da piano § 2.2; le righe marcate `*` («if required») sono **opzionali** nell'interfaccia.

- **Coperte / mancanti:** non applicabile al codice.
- **Si parte su:** campi e unità del piano § 2.2. Nessuna validazione normativa nel componente (solo coerenza formale: unità presenti con il valore; corrente e tensione sono valori singoli, nessun controllo min ≤ max su di essi).

## Checklist dato ↔ norma ↔ UI ↔ API

| Dato | Clausola / fonte MD | UI | API / persistenza |
|------|---------------------|----|-------------------|
| Riga passata (colonne piano § 2.2) | 15614-1 Annex B pag. 2; 15609-1 §4.4.9 | tabella editabile con riga «Aggiungi passata» | `GET/PUT /welding/wpqr/:id/test-runs` (WV-4) → `{ runs }` · nessuna persistenza in questa slice |
| Variante stud (corrente, tempo, sporgenza, alzata; capacitiva) | 14555 Annex C | stesse righe, colonne stud | idem |
| `verifyWpqr` | — | consumato da WV-6b | `POST /welding/wpqr/verify` (WV-5c) → `{ verification }` |

Nessuna nuova colonna. Nessun campo AI nuovo.

## File previsti

- *Nuovi* `app/src/components/WpqrTestRunsEditor.jsx` + `WpqrTestRunsEditor.css`
- *Nuovo* `app/src/tests/wpqrTestRunsEditor.test.jsx`
- *Modificato* `app/src/services/apiService.js` (**solo** i tre metodi WPQR sopra)
- *Modificato* `docs/reference/LIBRERIA_UI_SGQ.md` (**una riga** per il nuovo componente)
- Solo lettura/riuso: `app/src/design-system/README.md`, `docs/reference/LIBRERIA_UI_SGQ.md`, `app/src/pages/WeldingProceduresPage.jsx` (classi `wp-*` e pattern del form WPQR, **solo lettura**), `app/src/components/QualificationVerifyPanel.jsx` (schema di stati), `app/src/components/CoverageVerifyPanel.jsx`

## Cosa NON toccare

`WeldingProceduresPage.jsx`, `IngestReviewDialog.jsx`, `WpqrUploadButton.jsx`, `BillingDashboardPage.*`, `QualificationVerifyPanel.*`, `QualificationForm.jsx`, qualsiasi file `backend/`, `RouterContext`, `database/migrations/**`, `PROJECT_CONTEXT.md`.

## Cosa fare

1. Leggere **prima di scrivere markup**: `app/src/design-system/README.md` e `docs/reference/LIBRERIA_UI_SGQ.md`. Copiare lo schema del form WPQR (classi `wp-form-*` / tabelle esistenti) o del pannello copertura: **nessun look nuovo**, classi e colori esistenti, nessuna emoji decorativa, nessuna card KPI.
2. Props `{ value = [], onChange, readOnly = false, standardFamily = '15614-1', disabled = false }`; nessun fetch dentro; `onChange(nextRuns)` a ogni modifica **confermata al blur** (mai a ogni tasto per la validazione; il valore digitato resta nello stato locale).
3. Righe: id locale stabile, ordine di inserimento = `run_no`; l'**etichetta di passata è un campo di testo** (`run_label`: nel campione 7/18 non sono interi, es. `2 +n`, `3-4`; `run_no` = primo intero, calcolato al confermare); pulsanti «Aggiungi passata» e «Rimuovi» **sempre visibili** (`disabled` + `title` se `readOnly`/`disabled`). Campi numerici con `inputMode="decimal"` e virgola/punto accettati; unità selezionabili (avanzamento: `mm/min`|`mm/s`|`cm/min`; apporto termico: `kJ/mm`|`J/mm`|`kJ/cm`; velocità filo: `m/min`|`mm/s`) — **nessuna conversione automatica**. La colonna **velocità filo** non è nella vista di default: si attiva con un controllo esplicito (es. «Mostra velocità filo»), sempre visibile e mai obbligatoria.
4. Validazione formale al blur: **unità obbligatoria se il valore è presente** (avanzamento, apporto termico, velocità filo); corrente e tensione sono **valori singoli** (nessun controllo min ≤ max); messaggio inline `role="alert"` sul campo; **la validazione non blocca `onChange`** (l'editor non decide sul salvataggio).
5. Testo fisso: «Valori di prova letti dalla seconda pagina della WPQR. Le righe contrassegnate con * nel modulo sono facoltative.» Stato vuoto: «Nessuna passata archiviata».
6. `apiService`: `getWpqrTestRuns(wpqrId)` → `GET /welding/wpqr/:id/test-runs`; `saveWpqrTestRuns(wpqrId, runs)` → `PUT /welding/wpqr/:id/test-runs` con `{ runs }`; `verifyWpqr(fields, { runs, standardReference })` → `POST /welding/wpqr/verify` con `{ fields, runs, standard_reference }`. Solo Axios, stesso stile degli altri metodi.
7. `LIBRERIA_UI_SGQ.md`: una riga («Tabella passate WPQR» → `WpqrTestRunsEditor.jsx`).
8. Testi italiani con accenti corretti (UTF-8; eventuali `\u` **solo** dentro stringhe JS in espressione, mai testo JSX grezzo).

## Test L1

Comandi: `cd app && NODE_ENV=test npx vitest run src/tests/wpqrTestRunsEditor.test.jsx` + `npm run build` + `node backend/scripts/check-utf8-encoding.js`.

- Render con `value` vuoto/popolato; aggiunta e rimozione riga; `onChange` al blur con payload atteso; `readOnly` (pulsanti visibili e disabilitati con `title`).
- Variante stud (`standardFamily='14555'`) mostra le colonne stud e non quelle ad arco.
- Validazione: unità mancante con valore presente segnalata, `onChange` comunque emesso; etichetta non intera (`2 +n`) conservata come testo; velocità filo assente dalla vista di default e attivabile.
- Separatore decimale (virgola/punto) e valore vuoto → `null`.
- `apiService`: endpoint e payload dei tre metodi (mock Axios).

## Rielaborazioni (Registro)

**Esenzione dichiarata:** nessun campo AI-estraibile, nessuna colonna, nessun valore persistito. Le voci Rielaborazioni sono in WV-4 (backfill) e WV-5c (verify).

## DoD

- [ ] `WpqrTestRunsEditor` controllato, presentazionale, **non montato** in nessuna pagina
- [ ] DNA UI rispettato (classi esistenti, nessun look nuovo, nessuna emoji decorativa); `aria` corretti
- [ ] Variante stud 14555 e variante arco; unità esplicite, nessuna conversione silenziosa
- [ ] Pulsanti operativi sempre visibili (`disabled` + `title` se manca il prerequisito)
- [ ] Tre metodi `apiService` (solo Axios, nessun `fetch`)
- [ ] Riga in `LIBRERIA_UI_SGQ.md`
- [ ] `NODE_ENV=test npx vitest run src/tests/wpqrTestRunsEditor.test.jsx` verde + `npm run build` OK; **nessun file in `backend/`** nel diff
- [ ] `check-utf8-encoding.js` e `check-harness-boot.js` OK
- [ ] Branch allineato a `origin/main` prima di push/PR; `bugbot run` **una sola volta** a slice chiusa

## HITL

Nessuno. Se una colonna di § 2.2 non basta a rappresentare un caso → handoff, non inventare campi.

## Comando di avvio

`Leggi docs/agent-tasks/DEPUTYTASK_VERIFICA_WPQR_EDITOR_FE.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Handoff

_(vuoto)_
