# DEPUTYTASK1 — CND-11: ingest verbali PDF storici (`report_ndt`)

**Stato:** APERTO  
**Aperto:** 23/08/2026  
**Piano:** [`PLAN_CND_SLICES.md`](PLAN_CND_SLICES.md)  
**Rischio:** Medio — ingest additivo (stesso anello di `cert_ndt`); niente schema DB, auth, sync, pagina verbali.  
**Parallelo a:** CND-1 in `DEPUTYTASK.md` (file **disgiunti**: qui niente `NdtReportsPage`)  
**Slot precedente:** IA-17 CHIUSO [#536](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/536)

## Perché

I verbali CND cartacei/PDF dello studio (Mason in archivio cliente) oggi si caricano a metà: il tipo `report_ndt` è nel menu documenti e ha uno schema AI backend, ma la pipeline ingest li **rifiuta** (`SUPPORTED_DOC_TYPES` senza `report_ndt`) e il form FE non ha lo schema campi. L’operatore non può digitalizzare lo storico con lo stesso HITL delle qualifiche.

Questa slice **non** crea righe in `ndt_reports` (ponte verbale operativo ↔ PDF = da discutere). Solo: PDF → estrazione → revisione umana → posa in registro cartella 9.3.

## File previsti

- `backend/src/services/documentIngestPipeline.service.js` (+ `documentIngestPipeline.test.js`)
- `backend/src/data/documentTypeSchemas.js` (schema AI `report_ndt` già presente — toccare solo se manca un campo allineato al FE)
- `app/src/data/documentTypeSchemas.js` (aggiungere schema form `report_ndt`, specchio dei campi AI già in BE)
- `docs/agent-tasks/DEPUTYTASK1.md` (questo brief, chiusura)
- `docs/agent-tasks/PLAN_CND_SLICES.md` (spunta CND-11 a slice chiusa)

## Cosa NON toccare

- `NdtReportsPage.jsx` / `.css`, `ndtReports.controller.js`, `useNdtAutoSave.js` (CND-1 / CND-2)
- `NdtItemAttachments.jsx`, `EquipmentPage.jsx`, Qualifiche, RDP
- Migrazioni, `auth.middleware`, `syncService`
- Auto-insert in `ndt_reports` (niente ponte magico PDF → verbale operativo)
- Nuovo motore OCR / secondo ingest
- GUIDA / roadmap hub (traccia nel brief; sync dopo merge se c’è parallelo)
- `DEPUTYTASK.md` (CND-1)

## Riuso obbligatorio

- Stesso anello di `cert_ndt`: whitelist `SUPPORTED_DOC_TYPES` + schema + HITL staging
- Cartella registro già mappata: `report_ndt` → `9.3` in `document.controller.js` / `documentTreeProvisioner.service.js`
- Campi minimi già nello schema AI BE: `report_number`, `ndt_method` (UT|RT|MT|PT|VT), `part_ref`, `test_date`, `inspector_name`, `outcome_summary`
- UI ingest esistente (coda da completare / screening): niente pagina nuova

## Slice (unica)

1. Aggiungere `report_ndt` a `SUPPORTED_DOC_TYPES` (oggi manca: upload in menu, pipeline dice non supportato — stesso buco storico di `cert_ndt` pre-02/08).
2. Schema FE `report_ndt` in `app/src/data/documentTypeSchemas.js` allineato ai campi AI BE (niente campi inventati).
3. Test L1: tipo in whitelist; payload estratto ha le chiavi attese; tipo sconosciuto resta rifiutato.
4. Posa registro 9.3 invariata (già c’è la mappa). Nessuna riga `ndt_reports`.

## Acceptance

- L1: test pipeline (`documentIngestPipeline.test.js`) + eventuale test schema FE; `cd app && npm run build` se si tocca `app/`
- Upload/screening di un PDF classificato `report_ndt` **non** ritorna `UNSUPPORTED_DOC_TYPE`
- HITL vede i campi estratti; conferma posa in 9.3
- Zero INSERT su `ndt_reports`

## Comando di lancio

`Leggi docs/agent-tasks/DEPUTYTASK1.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`
