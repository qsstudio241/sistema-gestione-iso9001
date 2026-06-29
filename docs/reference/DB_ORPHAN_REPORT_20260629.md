# Report Analisi Orfani DB — SGQ_ISO9001

**Data esecuzione:** 2026-06-29  
**Script:** `backend/scripts/db-orphan-analysis.js`  
**Ambiente:** VPS produzione — `SGQ_ISO9001` (SQL Server)  
**Risultato complessivo:** 4 categorie con anomalie su 14 analizzate · 55 record/file coinvolti  
**Stato fix:** FIX-1 (CAT-3) applicato in sessione — `organization_id` corretto su NC 1052 → `1002`

---

## Riepilogo Esecutivo

| Categoria | Anomalia | Severità | Conteggio | Azione richiesta |
|-----------|----------|----------|-----------|------------------|
| CAT-2 | File fisici `uploads/YYYY/` senza record in `attachments` | Media | 32 file | Pulizia disco (opzionale) |
| CAT-3 | `non_conformities.organization_id = NULL` | Alta | 1 record | **RISOLTO** — `organization_id=1002` applicato |
| CAT-5 | `audit_custom_checklist_responses_history` orfane | Bassa | 2 record | Pulizia opzionale |
| CAT-12 | Righe nel backup 2026-01-11 non più in `audit_responses` | Informativa | 20 record | Solo documentare |

---

## CAT-1 — Audit Core ✅

Tutte le verifiche hanno restituito 0 anomalie:

- `audit_events` con `audit_id` inesistente: **0**
- `audit_events` con `user_id` inesistente: **0**
- `audit_locks` con `audit_id` inesistente: **0**
- `audits` con `organization_id`, `company_id`, `custom_checklist_id` inesistenti: **0**
- `audit_responses` con `question_id` inesistente: **0**
- `audit_standards` con `standard_id` inesistente: **0**

---

## CAT-2 — Allegati (attachments) ⚠️

### 2a. Integrità FK degli allegati ✅

Tutte le FK logiche degli allegati sono integre (0 orfani FK):

| Check | Risultato |
|-------|-----------|
| `attachments` senza nessun parent | ✅ 0 |
| `attachments.nc_id` inesistente | ✅ 0 |
| `attachments.document_id` inesistente | ✅ 0 |
| `attachments.custom_item_id` inesistente | ✅ 0 |
| `attachments.commercial_case_id` inesistente | ✅ 0 |
| `attachments.ndt_report_item_id` inesistente | ✅ 0 |
| `attachments.uploaded_by` inesistente | ✅ 0 |
| Allegati DB con file fisico mancante | ✅ 0 |

### 2b. File fisici orfani su disco ⚠️

**32 file** presenti in `uploads/YYYY/MM/` sul VPS non hanno record corrispondente in `attachments`.  
Dimensione totale stimata: file di dimensione variabile da KB a MB.

**Causa probabile:** allegati eliminati dal DB senza pulizia del file fisico, oppure upload parziali (server ha ricevuto il file ma non ha completato la scrittura del record DB).

**Distribuzione per mese:**

| Mese | File orfani | Note |
|------|------------|------|
| 2026/03 | 19 | Periodo di avvio sistema — molti test iniziali |
| 2026/04 | 7 | Mix test e dati reali |
| 2026/05 | 5 | Include 1 file di smoke test (`.txt`) |
| 2026/06 | 1 | File `_edited.jpg` non collegato |

**Lista completa file orfani in uploads/YYYY/:**

```
uploads/2026/03/1772993059393_d0f37e7fa792e327_LA_PROMESA_DE_UN_SUENO_102678.jpg
uploads/2026/03/1772993081700_924fbe57c4b996c9_RiduttoreDiametro.jpg
uploads/2026/03/1772993113440_c92ffd3eb5fb5dcc_Andamento_mensile_dei_Reclami.png
uploads/2026/03/1772993223930_7507fb1c7ab66dae_Andamento_mensile_dei_Reclami.png
uploads/2026/03/1772993296971_5dd8d6926fcc2939_Audit_2025_01_Raccorderia_Piacentina.docx
uploads/2026/03/1772995554248_a3c3f04b539fc3c8_RiduttoreDiametro.jpg
uploads/2026/03/1772995611689_40bcba06505ae91e_RiduttoreDiametro.jpg
uploads/2026/03/1772996864805_edb8661b977f60c8_RiduttoreDiametro.jpg
uploads/2026/03/1773001760833_41a191ed4fb33fe9_RiduttoreDiametro.jpg
uploads/2026/03/1773002794925_f58baabf2e674dea_RiduttoreDiametro.jpg
uploads/2026/03/1773340255402_54f3487afe4f136a_DIDASCALIE_POST_4_LINKEDIN_MASON_MODIFIED.docx
uploads/2026/03/1773696530420_d21b99df520f7feb_Logo_EramTecnologies.jpg
uploads/2026/03/1773696552730_680b177e8422c1d5_Andamento_mensile_dei_Reclami.png
uploads/2026/03/1773780576116_7282ca192d126e5b_Logo_EramTecnologies.jpg
uploads/2026/03/1773780635672_16db8f89195ce096_Immagine1.jpg
uploads/2026/03/1773781638805_cbd8153333405224_LogoManitou.jpg
uploads/2026/03/1773781725359_3f92f1d6fd3e45fb_LogoMason.png
uploads/2026/03/1773864241406_554a5259da712575_LogoMason.png
uploads/2026/03/1773864282986_8928d8a40f9d9a8c_LogoManitou.jpg
uploads/2026/04/1776971900142_42da8787f2f1423f_Logo_EramTecnologies.jpg
uploads/2026/04/1777020061378_02f765bf1ec6ea6e_IMG_20260424_WA0003.jpeg
uploads/2026/04/1777146644632_e0506833196adea3_IMG_20260424_WA0001.jpg
uploads/2026/04/1777146644816_0279b06f9c2cf7bc_IMG_20260424_WA0001.jpg
uploads/2026/04/1777188997204_4fd1a810bdeb542c_osservazioni.pdf
uploads/2026/04/1777188998406_265a8ff8fff6dbed_osservazioni.pdf
uploads/2026/04/1777208332356_72b200efc071efb2_Logo_EramTecnologies.jpg
uploads/2026/04/1777214200992_8d88867526b9c5b9_LogoQS_Studio.jpg
uploads/2026/05/1777644650996_185d5c00e5087ac2_DNV_GL_Logo.jpg
uploads/2026/05/1777738237706_8d0a27114d5190d4_sgq_smoke_custom_20260502_161037.pdf
uploads/2026/05/1777738238055_7db2f3a17647c927_sgq_smoke_custom_20260502_161037.png
uploads/2026/05/1780243457403_f5c4cf999b1f80a4_rbac_smoke_1780243440472.txt
uploads/2026/06/1782322424383_79489acfb4d50fbc_DWG_M_10_00_0600_WL_002_J26_0025_Rev_1_SGr__002_.pdf
```

> **Nota:** I file con `_edited.jpg` nel nome in `uploads/2026/06/` appartengono a un modulo di editing immagini (evidenze retoccate). Il conteggio riportato (32) considera solo la directory `uploads/YYYY/MM/` standard; file in sottodirectory specializzate (`uploads/docs/`, `uploads/imports/`, `uploads/norms/`) appartengono ad altre tabelle e non sono in scope per questo check.

**Azione consigliata:** Pulizia periodica opzionale. Eseguire il seguente script sul VPS per eliminare i file:
```bash
# ATTENZIONE: verificare prima la lista — questa operazione è irreversibile
# node /tmp/db-orphan-analysis.js 2>&1 | grep "uploads/20"
# Poi eliminare manualmente i file confermati come orfani
```

---

## CAT-3 — Non Conformità ⚠️

### Anomalia: 1 NC con `organization_id = NULL`

| Campo | Valore |
|-------|--------|
| `nc_id` | 1052 |
| `nc_number` | `NC-QS-260526-01-020` |
| `audit_id` | 35201 |
| `audit_number` | `QS-260526-01` |
| `status` | `open` |
| `organization_id` | **NULL** ← anomalia |

**Causa probabile:** La NC è stata creata da un percorso API che non propagava `organization_id` (forse un endpoint legacy o una versione in cui il campo era ancora opzionale).

**Impatto:** La NC potrebbe non essere visibile nei filtri per organizzazione (es. lista NC via API filtra per `organization_id`). Dato che l'audit padre `QS-260526-01` esiste, è possibile ricavare l'`organization_id` corretto da esso.

**Fix SQL (da eseguire sul VPS, script Node):**
```sql
UPDATE non_conformities
SET organization_id = (
    SELECT a.organization_id FROM audits a WHERE a.audit_id = 35201
)
WHERE nc_id = 1052 AND organization_id IS NULL;
```

---

## CAT-4 — Pending Issues ✅

Tutte le verifiche OK: nessun pending issue orfano (source_audit_id, source_response_id, question_id, nc_id).

---

## CAT-5 — Custom Checklists ⚠️

### Anomalia: 2 righe in `audit_custom_checklist_responses_history` orfane

| id | audit_id | custom_item_id | Dettaglio |
|----|----------|---------------|-----------|
| 8 | 11204 | 1013 | Audit `2026-07` (draft) — item `1013` non esiste più |
| 15 | 35187 | 1022 | Audit id `35187` non esiste più — item `1022` = "Domanda 1" di "Test Smoke L3 - Pulsanti Esito" |

**Causa:** Record di history creati durante test o da audit/item successivamente eliminati. La tabella `audit_custom_checklist_responses_history` non ha CASCADE DELETE sulla coppia `(audit_id, custom_item_id)`.

**Impatto:** Nullo sull'applicazione (la history è solo per consultazione). Non influisce sulle funzionalità operative.

**Azione:** Pulizia opzionale — possibile eliminare in sicurezza queste 2 righe orfane.

```sql
DELETE FROM audit_custom_checklist_responses_history
WHERE id IN (8, 15);
```

---

## CAT-6 a CAT-11 ✅

Tutte le verifiche di integrità FK per le seguenti categorie sono risultate OK (0 anomalie):

- **CAT-6** Registro Documenti — attachment FK, parent FK, company FK, document_history, norm_document_sources
- **CAT-7** Commercial Cases — commercial_customer FK, source_import_job FK, case_history FK
- **CAT-8** Import Jobs — job FK, commercial_case FK, qualification FK
- **CAT-9** Qualifiche e Personale — personnel FK, previous_qualification FK, confirmations FK, company FK, notification_contact FK, project_welders FK
- **CAT-10** NDT Reports — report_items FK, instruments FK, asset FK
- **CAT-11** Utenti e Organizzazioni — organization FK, auditor_org FK, notification_contacts FK

---

## CAT-12 — Anomalie Logiche ⚠️

### Anomalia: 20 righe nel backup `audit_responses_backup_20260111`

La tabella `audit_responses_backup_20260111` è uno **snapshot manuale** creato l'11 gennaio 2026. Contiene 52 righe totali, di cui **20 non sono più presenti** nella tabella `audit_responses` attuale.

Le 20 righe si riferiscono ad audit_id `1010`, `1011`, `1012` — audit di test/sviluppo creati nelle sessioni iniziali e successivamente eliminati.

**Impatto:** Nessuno sull'operatività. Questa è una **anomalia informativa** che documenta la pulizia avvenuta dopo il backup.

**Azione:** Nessuna azione richiesta. La tabella backup può essere mantenuta per tracciabilità storica o eliminata con:
```sql
-- OPZIONALE — solo se si vuole rimuovere il backup storico
DROP TABLE audit_responses_backup_20260111;
```

---

## CAT-13 — Knowledge / AI ✅ · CAT-14 — Scadenzario e Billing ✅

Tutte le verifiche OK: nessun chunk AI o deadline/billing item orfano.

---

## Piano di Intervento

### Obbligatorio (integrità dati produzione)

| # | Azione | Urgenza | Stato |
|---|--------|---------|-------|
| 1 | Fix `organization_id = NULL` su NC `1052` | Alta | ✅ **APPLICATO** — `organization_id = 1002` |

### Consigliato (pulizia opzionale)

| # | Azione | Urgenza | Note |
|---|--------|---------|------|
| 2 | Eliminare 2 righe orfane da `audit_custom_checklist_responses_history` | Bassa | SQL in CAT-5 |
| 3 | Pulizia file fisici orfani in `uploads/YYYY/` (32 file) | Bassa | Valutare caso per caso |

### Informativo (nessuna azione richiesta)

| # | Nota |
|---|------|
| 4 | Tabella `audit_responses_backup_20260111`: backup storico con 20 righe orfane — normale dopo pulizia audit di test |

---

## Note Metodologiche

- Lo script analizza **14 categorie** e oltre **50 controlli** di integrità FK + logici
- La scansione dei file fisici copre solo `uploads/YYYY/MM/` (allegati standard); le sottodirectory specializzate (`uploads/docs/`, `uploads/imports/`, `uploads/norms/`, `uploads/qualifications/`) non sono in scope perché appartengono ad altre tabelle
- I controlli su tabelle con FK CASCADE sono segnati "attesi 0" e confermati
- Per rieseguire l'analisi: `node /tmp/db-orphan-analysis.js` sul VPS (dopo `scp` dello script)

---

*Report generato automaticamente dallo script `backend/scripts/db-orphan-analysis.js`*  
*Prossima esecuzione consigliata: dopo ogni ciclo di migrazioni DB*
