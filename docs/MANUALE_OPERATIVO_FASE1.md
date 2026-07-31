# Manuale Operativo — Fase 1 Multi-Tenant

> **Versione**: 1.0 | **Data**: 01/03/2026  
> **Destinatari**: Super utente (admin), Auditor, Utente aziendale (futuro)

---

## Indice

1. [Panoramica ruoli e dati](#1-panoramica-ruoli-e-dati)
2. [Come si creano utenti e credenziali](#2-come-si-creano-utenti-e-credenziali)
3. [Flusso Super Utente (admin)](#3-flusso-super-utente-admin)
4. [Flusso Auditor](#4-flusso-auditor)
5. [Flusso Utente Aziendale](#5-flusso-utente-aziendale)
6. [Strategia consigliata](#6-strategia-consigliata)

---

## 1. Panoramica ruoli e dati

| Ruolo | Chi è | auditor_org_id | Cosa vede |
|-------|-------|----------------|-----------|
| **Super utente (admin)** | QS Studio, gestisce tutto | `NULL` | Tutti gli audit, tutte le aziende (selezionando lo studio) |
| **Auditor** | Studio di consulenza (cliente QS Studio) | Valorizzato (es. 1) | Solo audit e aziende del proprio studio |
| **Utente aziendale** | Cliente dell'auditor (azienda auditata) | — | Solo i propri audit (read-only) — **non ancora implementato** |

### Struttura dati

```
Organizzazione (es. QS Studio)
  └── Auditor Org (es. "Studio Rossi" — id=1)
        └── Companies (aziende auditate)
        └── Users con auditor_org_id=1 (auditor)
```

---

## 2. Come si creano utenti e credenziali

**Stato attuale**: non esiste una pagina UI per creare utenti. Le opzioni sono:

### Opzione A — API `POST /api/v1/auth/register` (consigliata per test)

```bash
# Esempio: crea un auditor per organization_id=1
curl -X POST https://sistemi.fr-busato.it:8443/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "auditor@studio-rossi.it",
    "password": "Password123!",
    "full_name": "Mario Rossi",
    "organization_id": 1,
    "role": "auditor"
  }'
```

**Nota**: l'endpoint `register` attualmente **non** imposta `auditor_org_id`. Per assegnare un utente a uno studio, serve un aggiornamento manuale nel DB (vedi Opzione C).

### Opzione B — Script Node.js

Esiste `backend/tests/setup-test-user.js` che crea un utente admin di test. Adattabile per creare auditor.

### Opzione C — Inserimento diretto nel DB (per Fase 1)

Per collegare un utente a uno studio (auditor_org):

```sql
-- 1. Verifica auditor_orgs esistenti
SELECT id, name FROM auditor_orgs;

-- 2. Aggiorna un utente esistente per assegnarlo allo studio
UPDATE users 
SET auditor_org_id = 1 
WHERE email = 'auditor@studio-rossi.it';
```

### Prossimo passo consigliato

Implementare una **pagina Admin → Gestione Utenti** (solo per super utente) che permetta di:
- Creare utenti con ruolo (admin/auditor/viewer)
- Assegnare `auditor_org_id` agli auditor
- Reset password

---

## 3. Flusso Super Utente (admin)

### Prerequisiti

- Utente con `role = 'admin'` e `auditor_org_id = NULL`
- Nel DB deve esistere almeno un `auditor_org` (es. "QS Studio (Default)" creato dalla migration 020)

---

### Passo 3.1 — Anagrafica Aziende

1. **Azione**: Clic su **"🏢 Anagrafica Aziende"** nell'header.
2. **Risultato atteso**:
   - Se esiste **un solo** auditor org: la pagina carica le aziende di quello studio.
   - Se esistono **più** auditor org: compare un dropdown **"Auditor / Studio:"** — selezionare lo studio per vedere le sue aziende.
   - Se compare l'errore *"Specificare auditor_org_id (superadmin)..."*: significa che non ci sono auditor_org nel DB o che il frontend non sta passando l'id. Verificare che la migration 020 sia stata eseguita e che esista almeno un record in `auditor_orgs`.

3. **Verifica**: La tabella mostra le aziende (o "Nessuna azienda" se vuota).

---

### Passo 3.2 — Creare un'azienda (per lo studio selezionato)

1. **Azione**: Clic su **"+ Nuova Azienda"**.
2. **Compilare**: Nome (obbligatorio), P.IVA, Settore, Indirizzo.
3. **Azione**: Clic su **"Salva"**.
4. **Risultato atteso**: L'azienda compare nella tabella.
5. **Verifica**: Controllare che l'azienda sia presente nella lista.

---

### Passo 3.3 — Creare un nuovo audit

1. **Azione**: Clic su **"← Torna agli Audit"**.
2. **Azione**: Clic su **"➕ Nuovo"** (o "Crea Primo Audit" se non ci sono audit).
3. **Risultato atteso**:
   - **Per il super utente**: il selettore "Azienda (da anagrafica)" **non** viene mostrato (perché non ha `auditor_org_id`). Si usa l'inserimento manuale del **Nome Cliente**.
4. **Azione**: Inserire manualmente Nome Cliente, Data Audit, Auditor, Norme. Clic su **"✓ Crea Audit"**.
5. **Verifica**: L'audit viene creato e compare nel dropdown.

---

### Passo 3.4 — Modificare audit esistenti

1. **Azione**: Selezionare un audit dal dropdown.
2. **Risultato atteso**: Si apre la sezione "1 - DATI GENERALI" e le altre sezioni.
3. **Verifica**: I dati sono modificabili e l'auto-salvataggio funziona.

---

## 4. Flusso Auditor

### Prerequisiti

- Utente con `role = 'auditor'` (o `'admin'`) e `auditor_org_id` valorizzato (es. 1).
- Almeno un'azienda creata per quel `auditor_org_id`.

---

### Passo 4.1 — Login come auditor

1. **Azione**: Logout (se necessario) e login con le credenziali dell'auditor.
2. **Risultato atteso**: L'header mostra il nome utente e il ruolo (es. "Auditor").
3. **Verifica**: L'utente è autenticato.

---

### Passo 4.2 — Anagrafica Aziende (auditor)

1. **Azione**: Clic su **"🏢 Anagrafica Aziende"**.
2. **Risultato atteso**:
   - Non compare il dropdown "Auditor / Studio" (l'auditor vede solo il proprio studio).
   - Vengono mostrate solo le aziende del proprio `auditor_org_id`.
3. **Verifica**: La lista coincide con le aziende dello studio.

---

### Passo 4.3 — Creare un nuovo audit con selettore azienda

1. **Azione**: Clic su **"← Torna agli Audit"**.
2. **Azione**: Clic su **"➕ Nuovo"**.
3. **Risultato atteso**:
   - Compare il campo **"Azienda (da anagrafica)"** con un dropdown.
   - Opzione "— Nuova azienda / Inserimento manuale —" per inserire un nome libero.
   - Se si seleziona un'azienda, il campo **"Nome Cliente *"** si compila automaticamente.
4. **Azione**: Selezionare un'azienda dal dropdown (o inserimento manuale).
5. **Azione**: Compilare Data Audit, Auditor, Norme. Clic su **"✓ Crea Audit"**.
6. **Verifica**: L'audit viene creato con `company_id` collegato all'azienda (se selezionata).

---

## 5. Flusso Utente Aziendale

**Stato**: Non ancora implementato.

L'utente aziendale (cliente dell'auditor) dovrebbe:
- Avere accesso read-only ai propri audit.
- Essere collegato a una `company` (tabella `companies`).
- Potrebbe richiedere una nuova tabella `company_users` o un campo `company_id` su `users`.

---

## 6. Strategia consigliata

### Fase immediata (questa sessione)

1. **Pulizia dati di test** (opzionale):
   - Decidere se eliminare audit e aziende di prova per avere un ambiente pulito.
   - In alternativa, usare dati di test ma documentare quali sono.

2. **Verificare il flusso Super Utente**:
   - Eseguire i passi 3.1 → 3.4 in ordine.
   - Verificare che l'errore "Specificare auditor_org_id" non compaia (o che scompaia dopo il caricamento degli auditor_org).

3. **Creare un utente auditor di test**:
   - Usare Opzione C (UPDATE nel DB) per assegnare `auditor_org_id = 1` a un utente esistente.
   - Oppure creare un nuovo utente via API e poi aggiornare `auditor_org_id` nel DB.

4. **Verificare il flusso Auditor**:
   - Eseguire i passi 4.1 → 4.3.
   - Verificare che il selettore azienda compaia nel modal di creazione audit.

### Fase successiva (backlog)

1. **Pagina Gestione Utenti** (solo admin): creazione utenti, assegnazione auditor_org, reset password.
2. **Supporto super utente al selettore azienda**: dropdown "Studio" + "Azienda" nel modal creazione audit.
3. **Utente aziendale**: modello dati e UI per accesso read-only agli audit della propria azienda.

---

## Riferimenti tecnici

- **Migration 020**: `database/migrations/020_fase1_multi_tenant_foundations.sql`
- **API Companies**: `GET /companies?auditor_org_id=X` (obbligatorio per superadmin)
- **API Auditor Orgs**: `GET /auditor-orgs`
- **API Register**: `POST /auth/register` (body: email, password, full_name, organization_id, role)
