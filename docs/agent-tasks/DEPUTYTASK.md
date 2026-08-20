# DEPUTYTASK — Ingest archivio IA-1 (tipo documento → cartella albero)

**Stato:** APERTO  
**Aperto:** 20/08/2026 (Lead wayfinder — Chart the map)  
**Piano:** [`PLAN_INGEST_ARCHIVIO_SLICES.md`](PLAN_INGEST_ARCHIVIO_SLICES.md)  
**Spec già in repo:** [`MODULO_INGEST_AI_COMMESSE_SCOPO_E_ROADMAP.md`](../specs/MODULO_INGEST_AI_COMMESSE_SCOPO_E_ROADMAP.md) (non rifare slice #5–#7) · template albero mig. 059/076 · `resolveNormFolderId`  
**Rischio:** Medio — backend additivo su `commitToRegistry`, nessuna migrazione; PR + **un** Bugbot a slice chiusa; Cloud **non** mergia  
**Slot precedente:** SAL S1a CHIUSO ([PR #471](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/471)) — scontrino in git, non rieseguire

HITL 20/08 (non cambia IA-1): sorgente = **cartella radice + sottocartelle**; screening in background; questo step **alloca**; review = coda incompleti. Dettaglio nel PLAN.

---

## Slice unica di questa sessione: IA-1

**Obiettivo**: quando si fa **Commit al Registry** da Import PDF, il documento va nella **cartella giusta** dell’albero (Procedure, Manuale, …), non in un mucchio piatto. Oggi solo le **norme** hanno una cartella (`2.3`).

### DoD

- [ ] Helper `resolveFolderByCode(orgId, folderCode, companyId)` riusando il criterio di `resolveNormFolderId` (niente secondo resolver per le norme)
- [ ] Mappa statica `doc_type → folder_code` come in PLAN § Mappa tipo → cartella (senza tipi nuovi)
- [ ] `commitToRegistry` imposta `parent_id` + `path_cache` per i tipi mappati
- [ ] `altro` senza `parent_folder_id` resta senza cartella
- [ ] Cartella assente → errore stabile (`FOLDER_NOT_FOUND`), niente riga orfana
- [ ] Norma: comportamento `2.3` invariato
- [ ] Test L1 verdi sul controller + helper
- [ ] PLAN: spuntare DoD IA-1 a slice chiusa

### File previsti

- `backend/src/services/documentTreeProvisioner.service.js`
- test provisioner esistente e/o nuovo test accanto (`documentTreeProvisioner.*.test.js`)
- `backend/src/controllers/importJobs.controller.js`
- `backend/src/controllers/importJobs.controller.test.js`
- `docs/agent-tasks/PLAN_INGEST_ARCHIVIO_SLICES.md` (solo checkbox IA-1)

Se aggiungi un `.js` nuovo sotto `backend/src/`: aggiorna `backend/scripts/deploy-manifest.json`.

### Cosa NON toccare

- `app/src/pages/ImportJobsPage.jsx` (IA-3)
- `app/src/data/documentTypes.js` / `documentTypeSchemas.js` (IA-2)
- `contractReview.*`, `caseDocumentAnalysis.service.js`
- `ocrExtractor.js`, `documentTextExtractor.service.js`
- `ingestStaging.*`, Material Compliance, SAL UI
- `docs/GUIDA_CONSOLIDATA.md`, `docs/PROJECT_ROADMAP.md`, `PROJECT_CONTEXT.md`
- qualsiasi `database/migrations/*.sql`

### Test

```bash
cd backend && npm test -- --testPathPattern='importJobs.controller|documentTreeProvisioner'
```

Niente build FE (solo backend). Niente smoke UI.

### Comando deputy

Leggi `docs/agent-tasks/DEPUTYTASK.md` ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.

---

## Bozza sync hub (dopo merge — PR docs #502/#504 aperte)

- Roadmap § Sessione più recente: «Ingest archivio — mappa IA-1…IA-10; brief IA-1 APERTO in DEPUTYTASK.md. Piano PLAN_INGEST_ARCHIVIO_SLICES.md.»
- GUIDA: una riga lezione — «Import PDF committa in albero solo le norme; gli altri tipi restano senza parent_id finché IA-1.»
