# DEPUTYTASK — IA-12: ingest famiglia sui PDF già in NORME E LEGGI

**Stato:** APERTO  
**Aperto:** 21/08/2026  
**Piano:** [`PLAN_INGEST_ARCHIVIO_SLICES.md`](PLAN_INGEST_ARCHIVIO_SLICES.md) (IA-12; post IA-11)  
**Rischio:** Medio — endpoint additivo `ingest-from-folder` + UPDATE documento esistente; niente schema/auth/sync.  
**Branch:** `cursor/ingest-ia12-norme-famiglia-d492`  
**Precedente slot:** IA-11 CHIUSO [#523](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/523) (mergiata 21/08/2026, deploy VPS dopo merge)

---

## IA-11 (slot precedente) — CHIUSO

**Stato:** CHIUSO — TEST OK  
**Chiuso:** 21/08/2026  
**PR:** [#523](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/523)  
**Merge commit:** `f1046bb4df877360c4ecec37dac44506cf97b1ac`  
**Deploy:** PID `1163278` → `1176534`, health 200

---

## Perché

Dopo Import/Screening il PDF è già in **NORME E LEGGI** (allegato in registry). Oggi **Carica norme** chiede di riselezionare lo stesso file dal PC (doppio). L’ingest vero deve girare su quei file: `normIngest` + `IngestReviewDialog`, **senza** re-upload.

Destinazione (non questa slice): un solo wizard Ambito → albero → carico → posa → ingest (IA-14). Init albero in create azienda = IA-13.

## File previsti

- `backend/src/services/normIngest.service.js` (`applyNormToExistingDocument`, exclude self dal duplicate, lista PDF cartella)
- `backend/src/services/normIngest.service.test.js`
- `backend/src/controllers/normUpload.controller.js` (`ingestFromFolder`)
- `backend/src/controllers/normUpload.controller.test.js`
- `backend/src/routes/normUpload.routes.js`
- `backend/src/services/ingestStaging.service.js` (confirm/reject con `_target_document_id`; passa `user` + `expectedFolderId`)
- `backend/src/services/ingestStaging.service.test.js`
- `backend/src/controllers/ingestStaging.controller.js` (passa `req.user`; 403 su AUTH_FORBIDDEN)
- `backend/src/controllers/ingestStaging.controller.test.js`
- `app/src/components/NormUploadButton.jsx` (pulsante «Ingest dalla cartella»)
- `app/src/components/NormUploadButton.css` (riga pulsanti, niente look nuovo)
- `app/src/tests/normUploadButton.test.jsx`
- `app/src/services/apiService.js` (`ingestNormsFromFolder`)
- `docs/agent-tasks/DEPUTYTASK.md`
- `docs/agent-tasks/PLAN_INGEST_ARCHIVIO_SLICES.md` (riga IA-12)
- `docs/PROJECT_ROADMAP.md` § Stato attuale (chat sola)

## Cosa NON toccare

- Pulsante ingest in **Modifica** documento (resta fuori)
- Init albero in creazione azienda (IA-13)
- Unificare Import e Carica norme (IA-14)
- `importJobs.controller.js` / Screening / posa 2.3
- `DocumentRegistry.jsx` (il pulsante vive già in `NormUploadButton` sulla cartella 2.3)
- `auth.middleware`, `syncService`, migrazioni SQL
- GUIDA extra (nessun parallelo: roadmap sì, lezione GUIDA no se non serve)
- Material Compliance, Qualifiche, WPQR

## Slice (minimo verificabile)

1. In **Documenti → Albero → NORME E LEGGI**: pulsante **Ingest dalla cartella** accanto a Carica norme.
2. BE: legge gli allegati PDF già in quella cartella, gira `extractNormFromPdf`, revisiona o applica sul **documento esistente** (niente INSERT nuovo, niente file dal PC).
3. Duplicate: esclude sé stesso. Reject staging: **non** cancella l’allegato già in registry.
4. Test L1: file già in cartella → ingest senza `uploadNorms`.

## Acceptance

- Con PDF già in 2.3 (has_file): click **Ingest dalla cartella** → stessa pipeline/revisione di Carica norme, senza file picker.
- Carica norme (batch) dal PC resta com’è.
- Modifica documento: nessun pulsante ingest nuovo.
- PR **non pronta** (niente Bugbot, niente merge). Deploy VPS di IA-12 **dopo** merge di IA-12.

## Dove cliccare (operatore)

1. Header: scegli l’**Ambito** azienda.
2. **Documenti** → vista **Albero**.
3. Cartella **NORME E LEGGI** (codice 2.3).
4. Pulsante **Ingest dalla cartella** (accanto a «Carica norme (batch)»).

## Esito L1 (21/08/2026)

- SHA feature: `6e4f3199` (`6e4f31999bd745b74c5f16ef145ce012594d2cb6`)
- SHA review #524 (RBAC cartella + batch 200 + tetto 20): `1112525e`
- SHA fix confirmStaging RBAC: `62eb6324` · HEAD `f4ebc5d9` · PR [#525](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/525) (follow-up; #524 già mergiata)
- Jest BE: `ingestStaging.service` + `ingestStaging.controller` + `normIngest.service` = **43 verdi** (include 403 confirm)
- Vitest FE: `normUploadButton.test.jsx` + `normUploadResults.test.js` = **23 verdi**
- `cd app && npm run build` OK
- **Non pronta** finché CI + Bugbot + Security Review sul **nuovo** SHA. Deploy VPS **dopo merge**. Cloud non mergia.

## Review #524 (rilievi chiusi, stessa PR)

- RBAC: `assertMutatingAllowed` su `folder.company_id` dopo `assertFolderIsNorms`; stesso check su `doc.company_id` in `applyNormToExistingDocument` (+ `parent_id` se `expectedFolderId`).
- Batch: 200 (non 500) se `results` ha solo duplicati/errori; FE non butta l'array.
- Tetto 20: `truncated` / `omitted` in risposta + avviso UI. Tetto non alzato.
- Update: `checkNormDuplicate(..., excludeDocumentId)` prima dell'UPDATE.
- **Bugbot HIGH / Security MEDIUM (21/08):** `confirmStaging` non passava `user` né `expectedFolderId` → `assertMutatingAllowed` saltato sul ramo pending_review. Fix: controller passa `req.user`; apply riceve `user` + `expectedFolderId` da `_parent_folder_id`; handler mappa 403. Test: call-args + 403 non conferma.
