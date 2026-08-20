# DEPUTYTASK — Ingest archivio IA-1 (tipo documento → cartella albero)

**Stato:** CHIUSO — TEST OK L1 (20/08/2026, 26 test)  
**Aperto:** 20/08/2026 (Lead wayfinder — Chart the map)  
**Chiuso:** 20/08/2026 (stesso run: mappa + IA-1)  
**Piano:** [`PLAN_INGEST_ARCHIVIO_SLICES.md`](PLAN_INGEST_ARCHIVIO_SLICES.md)  
**Rischio:** Medio — PR + **un** Bugbot a slice chiusa; Cloud **non** mergia  
**Prossima:** IA-2 (tipo `capitolato` → stanza commessa / cassetto `2.2`). Non aprire su `importJobs.controller.js` in parallelo.

HITL 20/08: cartella radice; screening in background; **alloca**. Stanze studio / azienda / commessa. IA-1 = solo scaffali **azienda**.

---

## Slice IA-1 — esito

Import PDF, Commit al Registry: procedura/manuale/istruzione/… vanno nello scaffale azienda. Le norme restano in `2.3` (`NORM_FOLDER_NOT_FOUND`). `altro` resta senza cartella. Cartella assente → `FOLDER_NOT_FOUND`, nessuna riga orfana.

### DoD

- [x] `resolveFolderByCode` + `resolveExplicitFolder` in `documentTreeProvisioner.service.js`
- [x] Mappa `DOC_TYPE_TO_FOLDER_CODE` (niente `capitolato`)
- [x] `commitToRegistry`: `parent_id` + `path_cache` per i tipi mappati
- [x] `altro` senza override: `parent_id` null
- [x] Norma invariata
- [x] L1: 26 verdi (`importJobs.controller` + `documentTreeProvisioner`)

### File toccati

- `backend/src/services/documentTreeProvisioner.service.js`
- `backend/src/services/documentTreeProvisioner.folder.test.js` (nuovo, solo test)
- `backend/src/controllers/importJobs.controller.js`
- `backend/src/controllers/importJobs.controller.test.js`
- `docs/agent-tasks/PLAN_INGEST_ARCHIVIO_SLICES.md`
- questo brief

Nessun file nuovo in `deploy-manifest` (helper nello stesso service già listato).

### Test

```bash
cd backend && npm test -- --testPathPattern='importJobs.controller|documentTreeProvisioner' --coverage=false
```

26 passed. Niente FE / smoke UI.

---

## Bozza sync hub (dopo merge — PR docs #502/#504 aperte)

- Roadmap: «IA-1 mergiata: commit Registry posa procedura/manuale nello scaffale azienda. Prossima IA-2 capitolato.»
- GUIDA: «Import PDF committa in albero i tipi mappati, non solo le norme. `altro` resta senza cartella.»
