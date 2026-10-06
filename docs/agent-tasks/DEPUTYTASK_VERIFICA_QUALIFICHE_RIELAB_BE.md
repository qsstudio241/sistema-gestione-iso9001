# DEPUTYTASK_VERIFICA_QUALIFICHE_RIELAB_BE — VQ-8: Rielaborazioni BACKEND `kind:'verify'` (loader DB tollerante + servizio candidati/report + voce `verify_9606_1`)

**Stato:** CHIUSO — TEST OK (07/10/2026 — slice VQ-8, PR draft su `cursor/vq-8-rielab-be-b8ef`)  
**Aperto:** 06/10/2026  
**Piano:** [`PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md`](PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md) § 1.2 · § 1.3 (contratto congelato) · § 2 (voce Rielaborazioni di tipo verifica) · § 6.2 riga VQ-8 · § 6.3 VQ-8  
**Dipende da:** VQ-1 (nucleo `qualificationVerify/` su `main`); FE VQ-4 (`BillingDashboardPage.jsx`) già su `main` — forma della risposta allineata in sola lettura  
**Rischio:** **Medio** — BE additivo, solo superadmin, **sola lettura** (nessuna scrittura, nessuna AI, nessun PDF letto, nessuna migrazione). Diventa **Alto** (stop + conferma) se per farlo quadrare serve toccare ingest, `auth.middleware`, sync, schema DB o le whitelist di scrittura.  
**Stream:** `DEPUTYTASK_VERIFICA_QUALIFICHE_*.md` (epic verifica qualifiche vs norma; non riusare questo file per altri epic)  
**Branch:** `cursor/vq-8-rielab-be-b8ef`  
**Contesto consigliato:** default/basso (non 1M)

---

## Obiettivo (una slice = un risultato verificabile)

Nel registro delle Rielaborazioni esiste una voce **di verifica** (`kind: 'verify'`, chiave `verify_9606_1`): `GET /admin/reprocess-tasks` espone `kind` e il numero di record con avvisi norma; `POST /admin/reprocess-tasks/verify_9606_1/run` risponde con un **report in sola lettura** (nessuna proposta in coda, nessuna AI, nessun file, nessuna scrittura). Il loader DB è tollerante alle colonne assenti (migrazione 168 **non** assunta applicata). Il frontend VQ-4 consuma già questa forma.

## Gate norme (dichiarato)

Nessuna regola nuova: la slice è il **trasporto** dei finding già prodotti dall'engine (`verifyQualification` in `mode:'db'`). Le clausole arrivano dai pack (VQ-5/VQ-6). Con i pack ancora parziali/stub i candidati possono essere 0: la voce compare nel pannello solo se candidati > 0 (regola Rielaborazioni).

## Checklist dato ↔ norma ↔ UI ↔ API

| Dato | Clausola / fonte | UI | API / persistenza |
|------|------------------|----|-------------------|
| Finding di verifica per record DB | come i singoli finding (pack VQ-5/VQ-6) | tabella «Verifica qualifiche vs norma» in Fatturazione → Rielaborazioni + CSV (VQ-4, già su `main`) | `GET /admin/reprocess-tasks` (campo `kind`) · `POST /admin/reprocess-tasks/:key/run` (risposta `kind:'verify'`) · **nessuna persistenza** |

Nessuna nuova colonna, nessun campo AI-estraibile nuovo, nessuna voce nelle whitelist di scrittura.

## Contratto della risposta

`GET /admin/reprocess-tasks` → ogni task ha `kind` (`'backfill'` per le voci storiche, `'verify'` per le nuove). `total_candidates` **esclude** le voci `verify`.

`POST /admin/reprocess-tasks/verify_9606_1/run` (body opzionale `{organization_id, limit}`):

```text
{
  success: true, kind: 'verify', field: 'verify_9606_1',
  recordsChecked:      n,   // record della famiglia 9606-1 controllati (non revocati)
  recordsWithWarnings: n,   // candidati: >= 1 finding warn verificabile
  findingsByCode:      { '<code>': n },            // solo warn, su tutti i record controllati
  notVerifiable:       { dato_mancante: n, fonte_mancante: n },  // finding non verificabili (tutti i record controllati)
  items: [ { id, organization_id, person_name, certificate_number, findings: [Finding warn…] } ],  // max `limit` (default 100, tetto 1000)
  hasMore: bool,            // altri candidati oltre `items`, oppure lettura troncata a 5000 record
  missingColumns: [ … ]     // colonne opzionali assenti sul DB (es. quelle della 168)
}
```

## File toccati

- *Nuovi* `backend/src/services/qualificationVerify/{verifyRecordLoader,verifyReprocess.service}.js` + test (`verifyRecordLoader.test.js`, `verifyReprocess.service.test.js`, `verifyReadOnly.test.js`, `verifyReprocess.cli.test.js`)
- *Nuovo* `backend/src/services/qualificationReprocess.verify.test.js`
- *Modificati* `backend/src/data/reprocessableFields.js` (+ `.test.js`) · `backend/src/services/qualificationReprocess.service.js` (ramo verify prima del backfill) · `backend/src/controllers/reprocessTasks.controller.js` (+ `.test.js`) · `backend/scripts/reprocess-qualifications.js` · `backend/scripts/deploy-manifest.json` (solo le due righe nuove)
- *Modificato (necessario)* `backend/src/services/qualificationVerify/moduleStructure.test.js`: il test «modulo puro» vietava `config/database` a **tutti** i file della cartella; ora ammette solo `verifyRecordLoader.js` (il perimetro DB è verificato da `verifyReadOnly.test.js`)
- Solo lettura: `app/src/pages/BillingDashboardPage.jsx` (forma attesa), `qualificationRecordView.js`, `verifyEngine.js`

## Cosa NON toccare (rispettato)

Ingest, pack, registry/engine, `reprocessTableAdapters.js`, whitelist di scrittura (`REPROCESSABLE_FIELDS`, `WPQR_REPROCESSABLE_FIELDS`), `ingest_staging`, qualsiasi file `app/`, `database/migrations/**`, route, auth/sync/JWT.

## Garanzie di sicurezza e test che le provano

| Garanzia | Test |
|----------|------|
| Nessuna chiave `verify_*` nelle whitelist di scrittura; sync registro ↔ whitelist **per kind** (le voci backfill invariate) | `reprocessableFields.test.js` (a/b/c) |
| `verifyFamily` di ogni voce verify presente in `listRulePacks()`; nessuna chiave duplicata tra kind | `reprocessableFields.test.js` |
| Nessuno statement di scrittura / `fs` / `ingest_staging` / whitelist / AI nei due moduli DB; ogni `query(` è una `SELECT` | `verifyReadOnly.test.js` |
| Solo il loader importa `config/database` | `verifyReadOnly.test.js` · `moduleStructure.test.js` |
| Ramo verify: nessuna AI, nessun file, nessuna proposta; i backfill non passano dal ramo verify | `qualificationReprocess.verify.test.js` |
| CLI rifiuta `verify_*` (senza connettersi al DB) | `verifyReprocess.cli.test.js` |
| Loader tollerante (INFORMATION_SCHEMA simulato: colonne 168 assenti ⇒ dato mancante, non errore SQL) | `verifyRecordLoader.test.js` · `verifyReprocess.service.test.js` |
| `total_candidates` non include le voci verify; il conteggio non scende dopo l'esecuzione | `reprocessTasks.controller.test.js` · `verifyReprocess.service.test.js` |
| Multi-tenant: `organization_id` come bind param; superadmin invariato (route non toccate) | `verifyRecordLoader.test.js` · controller test |

## Test L1

`cd backend && npx jest src/data/reprocessableFields src/services/qualificationReprocess src/controllers/reprocessTasks src/services/qualificationVerify` · repo: `node backend/scripts/check-harness-boot.js` e `node backend/scripts/check-utf8-encoding.js`.

## Rielaborazioni (Registro)

La voce `verify_9606_1` **è** la voce Rielaborazioni di questa slice (kind `verify`, nessuna whitelist di scrittura per costruzione). Nessun campo AI nuovo.

## DoD

- [x] `kind:'verify'` nel registro; voce `verify_9606_1`; voci senza `kind` invariate
- [x] `GET /admin/reprocess-tasks` espone `kind`; `total_candidates` esclude le voci verify
- [x] Ramo verify in `countReprocessCandidates`/`runReprocessForField` prima del backfill
- [x] `verifyRecordLoader` tollerante (INFORMATION_SCHEMA simulato nei test) · `verifyReprocess.service` con report conforme al FE VQ-4
- [x] Test sync esteso (a/b/c) + test strutturale «nessuna scrittura» + CLI che rifiuta `verify_*`
- [x] `deploy-manifest.json`: righe dei due file nuovi
- [x] L1 verde (`npx jest …`), `check-harness-boot.js`, `check-utf8-encoding.js`
- [x] Nessun file FE, nessuna route, nessuna migrazione nel diff
- [ ] Branch allineato a `origin/main` prima di push/PR; `bugbot run` **una sola volta** a slice chiusa (gestito dal committente/ProgettoISO per undraft e gate)

## Rischi / decisioni aperte

- Con i pack 9606-1 ancora stub/parziali (VQ-5/VQ-6 in parallelo) i candidati sono 0: la voce non compare finché i pack non producono `warn`.
- Lettura limitata a 5000 record per scansione (`hasMore` lo segnala); oltre serve paginazione (non in questa slice).
- `notVerifiable` conta i **finding** non verificabili, non i record.
- `deploy-manifest.json`: VQ-7 aggiunge altre righe — in caso di conflitto tenere **entrambe**.

## Comando di avvio

`Leggi docs/agent-tasks/DEPUTYTASK_VERIFICA_QUALIFICHE_RIELAB_BE.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Handoff

_(vuoto — slice chiusa)_
