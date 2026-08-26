# DEPUTYTASK — CND-7: Completa verbale → posa nel Registro Documenti

**Stato:** APERTO  
**Aperto:** 26/08/2026  
**Piano:** [`PLAN_CND_SLICES.md`](PLAN_CND_SLICES.md)  
**Dipende da:** CND-2 + CND-3 + CND-4 **CHIUSI** (#561 / #571 / #547)  
**Rischio:** Medio — BE NDT + registro; migrazione solo se strettamente necessaria (preferire riuso); niente auth/sync/breaking.  
**Parallelo a:** CND-6 su [`DEPUTYTASK1.md`](DEPUTYTASK1.md) e STUD-1 su [`DEPUTYTASK_WPQR_STUD.md`](DEPUTYTASK_WPQR_STUD.md) — **file disgiunti**.

## Fonti Markdown

- Coperte: PLAN_CND (output fascicolo SGQ); pattern posa ingest (`documentTreeProvisioner` / `report_ndt` → cartella **9.3**); CND-11 whitelist `report_ndt` (non crea `ndt_reports`)
- Mancanti: — non serve nuova norma
- Si parte su: al Completa (o export Word) il verbale operativo entra nel Registro come documento tracciabile

## Perché

Il verbale CND vive solo in `ndt_reports`. Fuori dal Registro Documenti non c’è fascicolo SGQ (ISO 3834-3 §14 / archivio prove). CND-7 chiude la posa verso cartella **9.3** / tipo `report_ndt`, riusando il pattern già usato dall’ingest.

## DoD (da PLAN_CND)

1. Alla transizione a **completato** (o azione esplicita documentata se più sicura): crea/aggiorna riga in `document_registry` (o API documenti esistente) con tipo `report_ndt`, `company_id` del verbale, cartella **9.3** se l’albero azienda c’è (stesso mapping di `documentTreeProvisioner` / controller documenti).
2. Multi-tenant: scope `organization_id` + `company_access` come il resto NDT.
3. Idempotenza: secondo Completa non duplica documenti orfani (link stabile verbale ↔ documento, o skip se già posato).
4. Se manca cartella 9.3: comportamento onesto (messaggio / coda «Cartella mancante» come ingest) — **non** creare albero ISO intero di nascosto.
5. Test L1 (Jest controller/service) + eventuale Vitest se tocchi FE minimo; deploy-manifest se aggiungi `.js` in `backend/src/`.
6. Spuntare CND-7 in PLAN_CND; brief **CHIUSO** — TEST OK.

## File previsti

- `backend/src/controllers/ndtReports.controller.js` (+ test)
- eventuale helper piccolo in `backend/src/services/` (posa registro) — solo se non basta riusare codice documenti esistente
- `backend/scripts/deploy-manifest.json` se file nuovo
- FE minimo solo se serve feedback utente (messaggio posa ok/errore) — **non** riscrivere sezioni metodo PT/MT
- `docs/agent-tasks/PLAN_CND_SLICES.md` + questo brief (chiusura)

## Cosa NON toccare

- `DEPUTYTASK1.md` / CND-6 / `NdtItemAttachments*`
- `NdtReportsPage.jsx` sezioni flag PT/MT (CND-3) salvo messaggio posa
- STUD / WPQR / NG / auth / sync / migrazioni distruttive
- CND-9 coda IndexedDB, CND-5 UT, CND-8 bozza-audit
- GUIDA / roadmap § Stato attuale (parallelo — sync **dopo merge**)

## Verifica

- [ ] Completa → documento `report_ndt` in 9.3 (o messaggio cartella mancante)
- [ ] Idempotente; scope company ok
- [ ] L1 + manifest
- [ ] PLAN CND-7 spuntato; brief CHIUSO — TEST OK
