# DEPUTYTASK_VERIFICA_QUALIFICHE_PANEL_FE — VQ-2: `QualificationVerifyPanel` (FE presentazionale) + `apiService.verifyQualification`

**Stato:** CHIUSO — TEST OK (06/10/2026, mergiata [#716](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/716))  
**Aperto:** 06/10/2026  
**Piano:** [`PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md`](PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md) § 1.3 (contratto) · § 4 (esiti UI) · § 6.3 VQ-2  
**Dipende da:** il **contratto `Finding`/`VerifyResult` congelato nel piano** (non da VQ-1: il pannello lavora su fixture del contratto)  
**Rischio:** **Basso** — solo FE additivo, componente presentazionale non montato in nessuna pagina (il montaggio è VQ-9). Nessun BE, nessuna migrazione.  
**Stream:** `DEPUTYTASK_VERIFICA_QUALIFICHE_*.md` (non riusare per altri epic)  
**Branch suggerito:** `cursor/vq-2-pannello-fe-<suffisso>`  
**Contesto consigliato:** default/basso

---

## Obiettivo (una slice = un risultato verificabile)

Esiste `QualificationVerifyPanel`: dato un `VerifyResult` (o stato `loading`/`error`/`offline`) mostra gli avvisi di verifica raggruppati per severità, con colonne **Letto / Atteso dalla norma / Clausola**, gli stati non verificabili con il motivo, il vuoto «Nessun avviso», e il testo che chiarisce che **gli avvisi non impediscono il salvataggio e che la validità letta sul certificato resta quella del certificato**. In più `apiService.verifyQualification(fields, { qualificationType })` → `POST /qualifications/verify` (l'endpoint arriva in VQ-7; qui si testa col mock).

Il pannello **non** è montato in nessuna pagina in questa slice.

## Gate norme (dichiarato)

Slice di sola presentazione: **non** aggiunge soglie, clausole né regole; mostra `source.clause` e `message_it` così come arrivano dal motore, senza reinterpretarli né ammorbidirli.

- **Coperte / mancanti:** non applicabile al codice; il testo normativo arriva dai pack (VQ-5/6/10/11).
- **Si parte su:** solo UI dei campi del contratto (`code`, `family`, `severity`, `status`, `field`, `direction`, `read_value`, `expected_value`, `source{norm,edition,clause,text_status,ref}`, `message_it`).

## Checklist dato ↔ norma ↔ UI ↔ API

| Dato | Clausola / fonte MD | UI | API / persistenza |
|------|---------------------|----|-------------------|
| `findings[]` (warn/info) | `source.clause` del singolo finding (nessun testo nuovo) | gruppi per severità; `info` ripiegate di default; colonne Letto / Atteso dalla norma / Clausola | `POST /qualifications/verify` (da VQ-7) → `{ verification: VerifyResult }` · **nessuna persistenza** |
| `status ≠ verificabile` | — | riga «Non verificabile» con motivo (norma/edizione non coperta · dato di prova mancante) | idem |
| `summary` | — | intestazione «N avvisi · M informazioni · K non verificabili» | idem |

Nessuna nuova colonna. Nessun campo AI nuovo.

## File previsti

- *Nuovi* `app/src/components/QualificationVerifyPanel.jsx` + `QualificationVerifyPanel.css`
- *Nuovo* `app/src/tests/qualificationVerifyPanel.test.jsx`
- *Modificato* `app/src/services/apiService.js` (**solo** il metodo `verifyQualification`)
- *Modificato* `docs/reference/LIBRERIA_UI_SGQ.md` (**una riga** per il nuovo componente)
- Solo lettura/riuso: `app/src/design-system/README.md`, `docs/reference/LIBRERIA_UI_SGQ.md`, `app/src/components/CoverageVerifyPanel.jsx` (+ `.css`, schema `sq-cov-panel` da copiare), `app/src/pages/QualificationsPage.css` (primitivi `sq-tag`, `sq-error`)

## Cosa NON toccare

`IngestReviewDialog.jsx`, `QualificationForm.jsx`, `QualificationsPage.jsx`, `QualificationUploadButton.jsx`, `BillingDashboardPage.*`, `CoverageVerifyPanel.*` (solo lettura), qualsiasi file `backend/`, `RouterContext`, `database/migrations/**`, `PROJECT_CONTEXT.md` (il pannello è dentro la riga «Qualifiche»; la bussola è di VQ-1).

## Cosa fare

1. Leggere **prima di scrivere markup**: `app/src/design-system/README.md` e `docs/reference/LIBRERIA_UI_SGQ.md`. Copiare lo schema del pannello copertura (`sq-cov-panel` / `sq-cov-body`, schermata 2 del DNA): **nessun look nuovo**, nessuna card KPI, classi/colori esistenti, badge `sq-tag`, nessuna emoji decorativa.
2. Componente con props `{ result, status = 'ready'|'loading'|'error'|'offline', errorMessage, onRetry }` (nessun fetch dentro: i dati li passa il chiamante, così VQ-9 decide quando chiamare).
3. Contenuto: intestazione con `summary`; sezione **Avvisi** (`severity: warn`, aperta) e **Informazioni** (`info`, ripiegata di default, `aria-expanded`); per ogni finding: `message_it` + tabella/griglia «Letto» (`read_value`, «—» se null) · «Atteso dalla norma» (`expected_value`, etichettato come *informativo*: «la norma darebbe…») · «Clausola» (`source.norm` + `source.edition` + `source.clause`); badge `text_status` quando ≠ `md_integrale` (es. «estratto», «estratto OCR»); finding non verificabili con il motivo leggibile (`non_verificabile_fonte_mancante` = «norma/edizione non coperta dalla libreria»; `non_verificabile_dato_mancante` = «dato di prova assente sul certificato»).
4. Testo fisso, sempre visibile: «Gli avvisi non impediscono il salvataggio. Il campo di validità del certificato resta quello letto.»
5. Stati: *loading* (`aria-busy`, riuso testo/spinner esistenti), *vuoto* («Nessun avviso di verifica»), *errore* (`role="alert"`, pulsante «Riprova» sempre visibile, `disabled` + `title` finché `loading`), *offline* (messaggio «Verifica non disponibile offline: il salvataggio non dipende da essa»).
6. `apiService.verifyQualification(fields, { qualificationType })` → `POST /qualifications/verify` con payload `{ fields, qualification_type }`; stesso stile degli altri metodi Axios (nessun `fetch` diretto); restituisce `data` (con `verification`).
7. `LIBRERIA_UI_SGQ.md`: una riga («Avvisi di verifica vs norma» → `QualificationVerifyPanel.jsx`).
8. Testi italiani con accenti corretti (UTF-8; eventuali `\u` **solo** dentro stringhe JS in espressione, mai testo JSX grezzo).

## Test L1

Comandi: `cd app && NODE_ENV=test npx vitest run src/tests/qualificationVerifyPanel.test.jsx` + `npm run build` + `node backend/scripts/check-utf8-encoding.js`.

- Fixture di `VerifyResult` costruite **dal contratto del piano** (warn verificabile over_claim; info under_claim; `non_verificabile_fonte_mancante`; `non_verificabile_dato_mancante`; vuoto).
- Gruppi e ordinamento; colonne Letto/Atteso/Clausola; `info` ripiegate di default e apribili; badge `text_status`; testo «non impediscono il salvataggio» presente in ogni stato con risultato; stati loading/errore/offline/vuoto; «Riprova» sempre visibile (`disabled` + `title` in loading); nessun elemento che blocchi o disabiliti il salvataggio (il componente non riceve né emette callback di blocco).
- `apiService.verifyQualification`: payload e endpoint corretti (mock Axios).

## Rielaborazioni (Registro)

**Esenzione dichiarata:** nessun campo AI-estraibile, nessuna colonna, nessun valore persistito. La voce Rielaborazioni è in VQ-8 (BE) e VQ-4 (FE).

## DoD

- [ ] `QualificationVerifyPanel` presentazionale, non montato in nessuna pagina
- [ ] DNA UI rispettato (copia dello schema `sq-cov-*`, classi esistenti, nessun look nuovo, nessuna emoji decorativa)
- [ ] Gruppi warn/info, colonne Letto/Atteso/Clausola, non verificabili con motivo, stati loading/errore/offline/vuoto
- [ ] Testo «non impediscono il salvataggio / la validità letta resta quella del certificato» sempre presente
- [ ] Pulsanti operativi sempre visibili (`disabled` + `title` se manca il prerequisito); `aria` corretti
- [ ] `apiService.verifyQualification` (solo Axios, nessun `fetch`)
- [ ] Riga in `LIBRERIA_UI_SGQ.md`
- [ ] `NODE_ENV=test npx vitest run src/tests/qualificationVerifyPanel.test.jsx` verde + `npm run build` OK; **nessun file in `backend/`** nel diff (`git diff --stat origin/main -- backend` vuoto)
- [ ] `check-utf8-encoding.js` e `check-harness-boot.js` OK
- [ ] Branch allineato a `origin/main` prima di push/PR; `bugbot run` **una sola volta** a slice chiusa

## HITL

Nessuno. Se il contratto non basta a rappresentare un caso → handoff, non inventare campi.

## Comando di avvio

`Leggi docs/agent-tasks/DEPUTYTASK_VERIFICA_QUALIFICHE_PANEL_FE.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Handoff

_(vuoto)_
