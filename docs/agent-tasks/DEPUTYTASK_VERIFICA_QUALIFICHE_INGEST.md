# DEPUTYTASK_VERIFICA_QUALIFICHE_INGEST — VQ-7: aggancio dell'engine di verifica all'ingest qualifiche + endpoint `POST /qualifications/verify` + check gas spostato sul registry

**Stato:** CHIUSO — TEST OK (06/10/2026) — PR draft `cursor/vq-7-ingest-verify-b8ef`; smoke su TEST dovuto dopo il deploy (vedi § Verifiche post-deploy)  
**Aperto:** 06/10/2026  
**Piano:** [`PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md`](PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md) § 1.1 (riuso) · § 1.3 (contratto) · § 1.5 (dove si aggancia) · § 6.2/6.3 VQ-7  
**Dipende da:** VQ-1 (nucleo `qualificationVerify/` su `main`)  
**Rischio:** **Medio** — percorso ingest critico, modifica additiva e difensiva; nessuna migrazione, nessuna nuova scrittura, nessuna modifica a middleware/auth/sync/`ingest_staging`. Diventerebbe **Alto** (stop + conferma) se servisse toccare `qualifications.controller.js`, middleware, schema o staging.  
**Stream:** `DEPUTYTASK_VERIFICA_QUALIFICHE_*.md` (epic verifica qualifiche vs norma; non riusare questo file per altri epic)  
**Branch:** `cursor/vq-7-ingest-verify-b8ef`  
**Contesto consigliato:** default/basso (non 1M)

---

## Obiettivo (una slice = un risultato verificabile)

1. `extractQualificationFromPdf` e `commitQualificationFromFields` chiamano `verifyQualification` in modo **additivo e mai bloccante**: le frasi `message_it` dei finding vanno accodate a `warnings` (già persistiti in `ingest_staging.warnings_json`) e l'oggetto strutturato è esposto come campo nuovo `verification` del risultato del servizio. Nessun cambio di `status`, nessun campo esistente alterato. Qualunque errore dell'engine (anche il `require` del modulo) viene assorbito con `logger.warn` e fallback «nessun finding».
2. `POST /qualifications/verify` (stateless, nessuna scrittura, nessun DB) con body `{ fields, qualification_type }` e risposta `{ verification: VerifyResult }`, registrata **prima** delle rotte `:id`.
3. Il check gas ISO 14175 non vive più in `checkQualificationPlausibility`: la fonte è il registry. Nessun doppio avviso (vedi § Decisione gas).

## Gate norme (dichiarato)

Non è norm-touching in senso stretto: la slice **non codifica soglie né clausole**, collega l'engine VQ-1 ai flussi.

- **Coperte:** nessuna regola nuova; il testo degli avvisi arriva dai pack (VQ-5/VQ-6).
- **Mancanti:** invariato (piano § 3).
- **Si parte su:** aggancio + endpoint + gas.

## Checklist dato ↔ norma ↔ UI ↔ API

| Dato | Clausola / fonte MD | UI | API / persistenza |
|------|---------------------|----|-------------------|
| `verification` (`VerifyResult`, contratto § 1.3) | dai pack (VQ-5/6) | `QualificationVerifyPanel` (VQ-2, montaggio in VQ-9) | risposta di `POST /qualifications/verify` (`{ verification }`) · campo `verification` del risultato di `extractQualificationFromPdf` / `commitQualificationFromFields` · **nessuna persistenza** |
| `message_it` dei finding | come il finding | toast/riepilogo avvisi esistenti | accodati a `warnings` (→ `warnings_json` di staging, già esistente) |
| Gas ISO 14175 sconosciuto | ISO 14175:2008 (`NORMA_00012`) | stesso avviso di prima | `warnings` (fonte: registry; fallback storico in ingest finché il registry non copre il campo) |

Nessuna nuova colonna. Nessun campo AI-estraibile nuovo.

## Contratto della risposta di `POST /qualifications/verify`

- Richiesta: `{ fields: object, qualification_type?: string }` (contratto di `apiService.verifyQualification`). `fields` = oggetto non vuoto (≤ 200 chiavi), valori scalari o array di scalari (stringhe ≤ 5000 caratteri, array ≤ 50 elementi); `qualification_type` stringa ≤ 200 caratteri, fusa nei campi. Chiavi `__proto__`/`constructor`/`prototype` scartate.
- `200` → `{ verification: VerifyResult }` con `mode: 'review'` (profilo, standard, `findings[]`, `summary`, `engine_version`) esattamente come lo legge `QualificationVerifyPanel` (`severity`, `status`, `message_it`, `read_value`, `expected_value`, `source{norm,edition,clause,text_status}`, `direction`).
- `400` body non valido (vuoto, tipo errato, troppo grande) · `403` utente senza `organization_id` · `401` non autenticato / licenza modulo (middleware del router, invariati) · `500` generico se l'engine lancia (messaggio senza dettagli interni).
- Nessuna scrittura, nessun accesso al DB.

## Decisione gas (§ 1.1 / § 6.3 / rischio 5 del piano)

`checkShieldingGasKnown` è **rimosso da `checkQualificationPlausibility`** (come da piano). La regola gas del registry (`CORR.GAS_14175`, riga della tabella § 4.2 → pack correttezza, VQ-6) **non esiste ancora su `main`**: per non perdere copertura nell'intervallo, `qualificationIngest.service.js` mantiene un fallback `legacyGasWarning` che emette il vecchio avviso **solo se il registry non produce alcun finding sul campo `shielding_gas`** (pack senza regola gas, profili non 9606-1 come 14732, engine in errore). Quando il registry copre il gas il fallback tace: un solo avviso, mai due. Quando VQ-6 sarà su `main` il fallback resta per i profili senza regola gas; eventuale rimozione = decisione di una slice successiva. `checkShieldingGasKnown` resta esportato da `ingestPlausibilityChecks.js` (usato da `wpqrIngest`/`wpsIngest` e dal fallback): file e relativo test **non modificati**.

## File previsti (toccati)

- *Modificato* `backend/src/services/qualificationIngest.service.js` + `.test.js` (helper `runQualificationVerification`, `legacyGasWarning`; gas tolto dalla plausibilità; `verification` in extract/commit; dedupe `warnings` nel flusso legacy)
- *Nuovo* `backend/src/controllers/qualificationVerify.controller.js` + `.test.js`
- *Modificato* `backend/src/routes/qualifications.routes.js` (una riga route + import, prima delle rotte `:id`)
- *Modificato* `backend/scripts/deploy-manifest.json` (**solo** la riga del controller; VQ-8 aggiunge altre righe: in conflitto tenere **entrambe**)
- *Nuovo* questo brief
- Non toccato (richiesto dal piano ma non necessario): `ingestPlausibilityChecks.js` + test (la funzione resta per WPQR/WPS e per il fallback)

## Cosa NON toccare

`qualifications.controller.js`, pack, registry/engine, Rielaborazioni (`reprocessableFields.js` & co.), FE, `capabilityCoverage/**`, middleware auth/licenza, `database/migrations/**`, schema/servizio `ingest_staging`, `PLAN_*`, GUIDA, `PROJECT_ROADMAP.md`.

## Rielaborazioni (Registro)

**Esenzione dichiarata:** nessun campo AI-estraibile, nessuna colonna, nessun valore persistito. La voce `verify_9606_1` nasce in **VQ-8**.

## Esito test (L1, 06/10/2026)

- `cd backend && npx jest src/services/qualificationIngest src/utils/ingestPlausibilityChecks src/controllers/qualificationVerify src/services/qualificationVerify` → 8 suite, 199 test verdi (test esistenti di ingest/plausibilità invariati tranne il test gas, aggiornato perché il piano sposta il check).
- Test nuovi: engine che lancia in extract e in commit non rompe l'ingest (status invariato, `verification: null`, gas storico mantenuto); risultato engine malformato ignorato; rumore `SOURCE_MISSING` escluso per documenti non-saldatura (NDT/PES/coordinatori) ma EN 287-1 mantiene l'avviso informativo; nessun duplicato gas (registry vs fallback); legacy `ingestQualificationFromPdf` senza warning doppi; controller: body vuoto/enorme/tipo errato → 400, senza org → 403, 401 senza auth, 500 generico, nessun accesso al DB, `__proto__` scartato; route registrata prima di `:id`; risposta con le chiavi lette dal pannello FE.
- `node backend/scripts/check-harness-boot.js` e `node backend/scripts/check-utf8-encoding.js` verdi.
- Nota: `backend/scripts/reprocess-qualifications.test.js` ha 3 test rossi **già presenti su `main`** senza queste modifiche (verificato con stash): estraneo alla slice.

## Verifiche post-deploy dovute (NON eseguite: richiedono il codice su TEST)

- `node backend/scripts/smoke-ingest-e2e-test.js` (ingest critico: upload PDF qualifica → `pending_review`, `status` invariato, warnings presenti, conferma commit).
- `POST /qualifications/verify` su TEST con `{ fields, qualification_type }` noti (200, `verification` valido) e con body vuoto (400).
- `SGQ_SMOKE_PATHS=login,qualifiche node backend/scripts/smoke-percorsi-critici.mjs` dopo il deploy.
- Smoke dedicato `smoke-qualifica-verifica-test.js`: slice VQ-12.

## Rischi / decisioni aperte

- **`verification` non arriva alla risposta di `uploadBatch`**: il controller `qualifications.controller.js` (fuori perimetro) costruisce `entry` campo per campo senza `verification`. Il campo è nel risultato del servizio; la UI di review ottiene l'oggetto strutturato con `POST /qualifications/verify` (flusso previsto dal piano, VQ-9) e i `message_it` sono già in `warnings`. Se si vuole `verification` anche nella risposta di `uploadBatch`, serve una riga in `qualifications.controller.js` (slice dedicata o VQ-9).
- Il fallback gas è transitorio: da riesaminare dopo VQ-6.
- Gli avvisi di verifica aumentano il numero di `warnings` mostrati/persistiti in staging quando i pack VQ-5/VQ-6 saranno su `main`; sono tutti non bloccanti.

## Comando di avvio

`Leggi docs/agent-tasks/DEPUTYTASK_VERIFICA_QUALIFICHE_INGEST.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Handoff

_(vuoto — slice chiusa)_
