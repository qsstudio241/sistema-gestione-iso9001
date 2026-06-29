# Report Isolamento Multi-Tenant — SGQ_ISO9001

**Data esecuzione:** 2026-06-29  
**Script:** `backend/scripts/db-tenant-isolation-check.js`  
**Ambiente:** VPS produzione — `SGQ_ISO9001`

---

## Mappa Tenant Attiva

| org_id | Organizzazione | Studio (auditor_org) | Aziende gestite |
|--------|---------------|----------------------|-----------------|
| 1001 | Al.project | AI.Admin (id=1) | Azienda Test Fase 1 (id=11) |
| 1002 | QS_Studio | QS Studio (id=3) | ERAM TECHNOLOGIES, RIVIAL, GUGLIELMO, SIR, FP MODENA, DK, GBA, IDRAULICA SIGHINOLFI, OXI PROGET, GRUPPO CIMA, 2B, PAGANI, EMILPLAST, SAVECO, MOCHEM, QS Studio, TUSCANIA (17 aziende) |
| 1003 | MASON_Srl | Mason (id=2) | MANITOU ITALIA SRL, FINCANTIERI, ADA SRL (3 aziende) |
| 1004 | ERAM | ERAM (id=4) | DNV, LM&CO Sas (2 aziende) |

---

## Riepilogo Violazioni Isolamento

| Categoria | Anomalia | N. | Natura | Urgenza |
|-----------|----------|----|--------|---------|
| ISO-1 | Audit con company_id di org diversa | 4 | Dati di sviluppo (admin test) | Bassa |
| ISO-2 | Allegati caricati da superadmin su audit di altra org | 2 | Comportamento atteso superadmin | Nessuna |
| **ISO-5** | `document_registry` con `organization_id` sbagliato | **140** | **Bug sistematico migrazione** | **Alta** |
| **ISO-10** | `knowledge_chunks` con `organization_id` sbagliato | **20 TOP / ~525 tot** | **Bug sistematico indicizzazione** | **Alta** |

---

## ISO-1 — 4 Audit Cross-Tenant (bassa urgenza)

Tutti e 4 gli audit sono stati creati il **16 marzo 2026** dall'utente `marcocamellini@gmail.com` (ruolo `admin`, org=1001) durante la fase iniziale di test, selezionando per errore `company_id=7` (ERAM TECHNOLOGIES, org=1002 QS_Studio).

| audit_id | audit_number | Status | Creato da |
|----------|-------------|--------|-----------|
| 5162 | QA-SYNC-TEST-1603 | draft | marcocamellini@gmail.com (org=1001) |
| 5166 | 2026-08-OLD-5166 | draft | marcocamellini@gmail.com (org=1001) |
| 5168 | 2026-09 | draft | marcocamellini@gmail.com (org=1001) |
| 5174 | 2026-10 | draft | marcocamellini@gmail.com (org=1001) |

**Impatto operativo:** Gli utenti di QS_Studio (org=1002) vedono ERAM TECHNOLOGIES nella loro lista aziende ma questi audit sono nell'org=1001 — non sono visibili a QS_Studio nelle API filtrate per org. Praticamente invisibili a entrambi i tenant eccetto il superadmin.

**Fix consigliato (opzionale):** Eliminare i 4 audit draft di test, oppure correggerli con il fix SQL incluso nello script `fix-tenant-isolation-vps.js` (non ancora eseguito — richiede conferma).

---

## ISO-2 — 2 Allegati Superadmin (nessuna azione)

I 2 allegati (`attachment_id` 5 e 6) sono stati caricati il **6 marzo 2026** da `admin@sgq.local` (superadmin, org=1001) su audit `2026-03` (org=1002, QS_Studio).

**Natura:** Comportamento atteso per il superadmin — ha visibilità cross-tenant per supporto e sviluppo. Non è una violazione di sicurezza.

**Azione:** Nessuna.

---

## ISO-5 — 140 Document Registry con `organization_id` Errato (ALTA URGENZA)

### Distribuzione

| doc_org (errata) | company_org (corretta) | N. doc | Creati da |
|-----------------|------------------------|--------|-----------|
| 1001 (Al.project) | 1002 (QS_Studio) | 97 | 96 senza utente (import automatico) + 1 superadmin |
| 1001 (Al.project) | 1003 (MASON_Srl) | 43 | 33 senza utente (import automatico) + 10 superadmin |

### Causa radice

Il processo di **generazione/import automatico dei template di struttura documentale** ha impostato `organization_id=1001` (l'org del superadmin che ha eseguito l'import) invece dell'`organization_id` corretto derivato dalla gerarchia `company → auditor_org → organization`. Questo è evidenziato dal fatto che la maggioranza dei record ha `created_by=NULL` — inseriti direttamente via script/seed senza passare dall'API con autenticazione.

### Impatto operativo (concreto)

Le API del registro documenti filtrano per `organization_id = req.user.organization_id`. Di conseguenza:
- **Utenti di QS_Studio (org=1002)** che cercano documenti di RIVIAL, FP MODENA, SAVECO ecc. **non vedono** i 97 documenti con `org=1001` → albero documentale parzialmente invisibile
- **Utenti di MASON_Srl (org=1003)** che cercano documenti di MANITOU **non vedono** i 43 documenti con `org=1001`

Questo è un **bug di visibilità** attivo in produzione.

### Fix SQL

```sql
-- Corregge organization_id dei document_registry
-- usando l'org derivata dalla catena company → auditor_org → organization
UPDATE dr
SET dr.organization_id = ao.organization_id
FROM document_registry dr
JOIN companies c ON c.id = dr.company_id
JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
WHERE dr.company_id IS NOT NULL
  AND dr.organization_id <> ao.organization_id;
-- Righe attese: 140
```

**Script pronto:** `backend/scripts/fix-tenant-isolation-vps.js` — da eseguire dopo conferma.

---

## ISO-10 — Knowledge Chunks con `organization_id` Errato (ALTA URGENZA)

### Distribuzione (totale: ~525 chunks, visibili qui top 20 in script base)

| entity_type | company | company_org (corretta) | chunk_org (errata) | N. |
|-------------|---------|----------------------|-------------------|-----|
| document_content | MANITOU ITALIA SRL | 1003 | 1001 | 228 |
| document_content | RIVIAL | 1002 | 1001 | 157 |
| document | MANITOU ITALIA SRL | 1003 | 1001 | 39 |
| document | RIVIAL | 1002 | 1001 | 33 |
| document | SAVECO | 1002 | 1001 | 32 |
| document | FP MODENA | 1002 | 1001 | 32 |
| audit_conclusion | ERAM TECHNOLOGIES | 1002 | 1001 | 4 |

### Causa radice

Il servizio di **indicizzazione AI** (`knowledgeIndexer.service.js`) ha usato l'`organization_id` dell'utente che ha avviato l'indicizzazione (superadmin, org=1001) invece dell'`organization_id` derivato dall'azienda del documento (`company → auditor_org → organization`).

### Impatto operativo

Le query AI usano `WHERE organization_id = @userOrg` per isolare il contesto. I 525 chunk con `org=1001` non vengono inclusi nelle risposte AI per utenti di org=1002 (QS_Studio) o org=1003 (MASON_Srl) → **assistente AI con contesto documentale parziale** per i tenant interessati.

### Fix SQL

```sql
-- Corregge organization_id dei knowledge_chunks con company_id valorizzato
UPDATE kc
SET kc.organization_id = ao.organization_id
FROM knowledge_chunks kc
JOIN companies c ON c.id = kc.company_id
JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
WHERE kc.company_id IS NOT NULL
  AND kc.organization_id <> ao.organization_id;
-- Righe attese: ~525
```

---

## Piano di Intervento

### Priorità Alta — Fix da eseguire (impatto operativo confermato)

| # | Fix | Righe | Script |
|---|-----|-------|--------|
| **T-1** | `document_registry.organization_id` → valore corretto da `company→auditor_org→org` | 140 | `fix-tenant-isolation-vps.js` → blocco 1 |
| **T-2** | `knowledge_chunks.organization_id` → valore corretto da `company→auditor_org→org` | ~525 | `fix-tenant-isolation-vps.js` → blocco 2 |

### Priorità Bassa — Opzionale

| # | Fix | Note |
|---|-----|------|
| T-3 | Eliminare 4 audit draft cross-tenant (ISO-1) | Dati di test, non visibili a nessun tenant |

### Nessuna Azione

| # | Nota |
|---|------|
| T-4 | ISO-2 (2 allegati superadmin cross-tenant) — comportamento atteso |

---

## Prevenzione Futura

Due correzioni di codice da applicare per evitare la ricorrenza:

1. **`document_registry` creation endpoint**: quando `company_id` è valorizzato, impostare `organization_id = auditor_org.organization_id` (non l'org dell'utente autenticato)
2. **`knowledgeIndexer.service.js`**: quando si indicizza un documento con `company_id`, usare `organization_id` derivato dalla catena `company → auditor_org → organizations` invece di `req.user.organization_id`

---

*Report generato con `backend/scripts/db-tenant-isolation-check.js`*  
*Fix script: `backend/scripts/fix-tenant-isolation-vps.js` (da creare e eseguire dopo conferma)*
