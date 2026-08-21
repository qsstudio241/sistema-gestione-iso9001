# DEPUTYTASK — Import: un solo controllo azienda (Ambito)

**Stato:** APERTO  
**Aperto:** 21/08/2026  
**Piano:** [`PLAN_INGEST_ARCHIVIO_SLICES.md`](PLAN_INGEST_ARCHIVIO_SLICES.md) (post IA-5b)  
**Rischio:** Medio — UI Import; niente schema/auth/sync. PR + gate Bugbot; Cloud **non** mergia.  
**Branch:** `cursor/import-ambito-only-d492`  
**Origine:** committente — la tendina «Azienda cliente» sul job Import non serve. Un solo controllo: **Ambito** (header).

---

## Perché

Due tendine (Ambito header + Azienda sul job) confondono. Tutto lo studio / Patrimonio non sono un cliente (lezione #428). L’azienda del job è quella scelta in **Ambito**.

## File previsti

- `app/src/pages/ImportJobsPage.jsx`
- `app/src/utils/importFolderUpload.js` (messaggio + helper match Ambito/job)
- `app/src/tests/importJobsPage.companyGate.test.jsx`
- `app/src/tests/importJobsPage.folderPlan.test.jsx`
- `app/src/tests/importFolderUpload.test.js`
- `docs/agent-tasks/DEPUTYTASK.md`
- `docs/PROJECT_ROADMAP.md` § Stato attuale (chat sola)
- `docs/GUIDA_CONSOLIDATA.md` (una lezione; chat sola)

## Cosa NON toccare

Backend se il gate `COMPANY_REQUIRED_FOR_UPLOAD` basta (`company_id` arriva da Ambito). `CompanyScopeSelect` globale. IA-6. DocumentRegistry. Commessa. Nessuna seconda tendina.

## Slice

1. Rimuovere la tendina «Azienda cliente» dal form job (create/edit). Niente state morto.
2. `company_id` per create / upload / piano cartella = Ambito se `isClientCompanyId`.
3. Ambito Tutto lo studio / Patrimonio: `+ Nuovo job` e picker/upload visibili ma `disabled` + title. Alert: «Scegli un’azienda cliente in Ambito (in alto). Con Tutto lo studio o Patrimonio non si crea un job e non si caricano file.»
4. Job esistenti: si aprono. Upload solo se Ambito è cliente **e** Ambito === `job.company_id` (se il job ha già company). Altrimenti alert «Ambito diverso dall’azienda di questo job».
5. Test L1: studio / Patrimonio / company 11; nessuna tendina «Azienda cliente» nel DOM.

## Acceptance

- Un solo controllo azienda: Ambito.
- Nessun create/upload con Tutto lo studio o Patrimonio.
- Create/upload con Ambito azienda cliente usano quella `company_id`.
- Pulsanti operativi restano visibili.
