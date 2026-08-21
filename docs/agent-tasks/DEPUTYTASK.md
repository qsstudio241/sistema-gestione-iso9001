# DEPUTYTASK — IA-11: posa norme in NORME E LEGGI se l’albero c’è

**Stato:** APERTO  
**Aperto:** 21/08/2026  
**Piano:** [`PLAN_INGEST_ARCHIVIO_SLICES.md`](PLAN_INGEST_ARCHIVIO_SLICES.md) (IA-11; post IA-5b)  
**Rischio:** Medio — backend Import additivo (`parent_id`); niente schema/auth/sync.  
**Branch:** `cursor/ingest-posa-norme-folder-d492`  
**Precedente slot:** Import Ambito-only CHIUSO [#521](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/521)

---

## Perché

Lo Screening Import posa le norme nello scaffale **senza cartella** → albero vuoto. Male. Se l’azienda ha già **NORME E LEGGI** (`folder_code` 2.3, albero inizializzato), il file deve finire lì. Se l’albero non c’è, resta la coda «Cartella mancante».

Destinazione (non questa slice): un solo flusso Ambito → (albero se serve) → carico/screening → cartella giusta → ingest famiglia (**Carica norme** in NORME E LEGGI; Modifica non lo lancia).

## File previsti

- `backend/src/services/documentTreeProvisioner.service.js` (predicato posa)
- `backend/src/services/documentTreeProvisioner.folder.test.js`
- `backend/src/controllers/importJobs.controller.js` (`commitToRegistry` / `screenAndPlace`)
- `backend/src/controllers/importJobs.controller.test.js`
- `docs/agent-tasks/PLAN_INGEST_ARCHIVIO_SLICES.md` (IA-11–IA-14)
- `docs/agent-tasks/DEPUTYTASK.md`
- `docs/PROJECT_ROADMAP.md` § Stato attuale (chat sola)
- `docs/GUIDA_CONSOLIDATA.md` (una lezione; chat sola)

## Cosa NON toccare

- Pulsante ingest in Modifica documento
- Init albero in creazione azienda (IA-13)
- Unificare Import e Carica norme in un wizard (IA-14)
- `normIngest` / `normUpload.controller` / Carica norme batch (IA-12)
- `resolveNormFolderId` (resta per Carica norme)
- IA-6 Riesame, OCR nuovo, tetto 80, auto-merge
- `ImportJobsPage.jsx` / CSS (niente markup)
- `auth.middleware`, `syncService`, migrazioni SQL
- `DocumentRegistry.jsx`, Material Compliance

## Slice

1. Predicato: `doc_type`/`hint` = `norma` **e** cartella 2.3 di quella `company_id` + `organization_id` → `parent_id`; altrimenti `null` (coda).
2. `commitToRegistry`: lookup con `resolveFolderByCode`, non la prima 2.3 dell’org. Cartella assente → posa senza cartella, non 404.
3. `screenAndPlace`: se classifica `norma` o hint job `norma`, tenta la posa (anche confidence medium da hint).
4. Norma senza `standard_code`: posa comunque come `ai_draft` (coda campi), titolo dal nome file. Niente riga duplicata (`ALREADY_COMMITTED`).
5. Test L1 sul predicato + commit + screenAndPlace.

## Acceptance

- Con albero già inizializzato: dopo Screening le norme sono **dentro NORME E LEGGI** di quell’azienda.
- Senza albero: riga in registro, coda «Cartella mancante».
- Multi-tenant: solo cartella della stessa `organization_id` + `company_id`.
- PR **non pronta** (niente Bugbot, niente merge, deploy VPS dopo merge).

## Esito L1 (21/08/2026)

- Jest BE: `importJobs.controller.test.js` + `documentTreeProvisioner.folder.test.js` = **46 verdi**
- SHA: vedi ultimo commit su `cursor/ingest-posa-norme-folder-d492`
- **Non pronta**: CI + Bugbot + Security. Cloud non mergia. Deploy VPS **dopo merge**.
