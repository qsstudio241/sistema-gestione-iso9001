# Mini-specifica — Riesame requisiti di contratto / ciclo commerciale (pilota)

> **Scopo**: definire un perimetro **contenuto e verificabile** per un futuro modulo licenziabile, senza anticipare tutte le varianti legali/commerciali.  
> **Versione**: 1.0 — 2026-04-11  
> **Riferimenti prodotto**: [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) (Sprint 9 ingest, Sprint 10 staging), [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md)  
> **Norma (orientamento)**: ISO 9001:2015 §8.2 (requisiti per le prestazioni), §8.4 (fornitori dove applicabile), §8.5.3 (documentazione fornita dal cliente, se rilevante).

---

## 1. Principi (golden rules applicate al modulo)

| Principio | Implicazione |
|-----------|----------------|
| **Modularità** | Modulo separato da “Document Registry” generico: **stati di processo** e **pacchetti documentali** propri; riuso di API allegati/documenti esistenti dove possibile. |
| **Server come fonte di verità** | Stati, versioni, approvazioni persistite in DB; niente “solo workflow in memoria client”. |
| **Multi-tenant** | Tutte le entità con `organization_id`; permessi per ruolo (vedi §3). |
| **Scalabilità** | Pilot con **un solo percorso** (§7); estensioni (gare, contratti quadro) come fasi successive. |
| **Coerenza con import (Sprint 9–10)** | PDF/altri file possono **alimentare bozze** in **staging**; il **commit** nel processo commerciale è **azione umana** esplicita, non automatica dall’import. |
| **Fruibilità** | Desktop-first per configurazione e riesame; elenco “cosa fare oggi” (approvazioni in sospeso) allineato alla home dashboard. |

---

## 2. Oggetto centrale (entità di processo)

**Nome working**: `CommercialCase` (o `ContractReviewCase` — da allineare al naming DB).

- Rappresenta **un’opportunità / commessa in acquisizione** dal punto di vista qualità-commerciale.  
- Collegamenti minimi pilota:
  - **Cliente** → record anagrafica già presente (`companies` o equivalente in uso per committente).  
  - **Documenti / allegati** → uso del modello allegati esistente (in/out come **categoria** o **tag**, non nuovo storage).  
  - **Fornitori** (opzionale in pilota): solo se la commessa richiede sub-fornitura; altrimenti fase 2.

---

## 3. Ruoli (macro)

| Ruolo | Responsabilità nel pilota |
|-------|---------------------------|
| **Commerciale** | Crea caso, carica/associa documenti in ingresso, avanza stati “bozza offerta”. |
| **Tecnico / Ufficio tecnico** | Riesame requisiti, compilazione checklist riesame, evidenze. |
| **Responsabile qualità / delegato** | Approvazione riesame preliminare e/o definitivo (configurabile se stesso ruolo in PMI). |
| **Management** (opzionale) | Approvazione economica offerta — **fuori pilota minimo** se si vuole ridurre scope: si può registrare solo flag “offerta approvata internamente”. |

I ruoli si mappano sui **ruoli applicativi** esistenti (`user_org_roles` / convenzioni org); nessun utente “solo locale”.

---

## 4. Stati del workflow — **pilota “ordine diretto”** (max ~10)

Sequenza lineare con possibilità di **torna indietro** solo verso stati precedenti non terminali, con motivazione obbligatoria (audit trail).

| # | Stato | Descrizione | Output obbligatorio |
|---|--------|-------------|---------------------|
| 1 | `DRAFT` | Ricezione richiesta / apertura caso | Cliente, riferimento offerta (ID esterno opzionale), allegati minimi (es. RFQ o email sintetica). |
| 2 | `INTAKE_REVIEW` | Riesame preliminare requisiti e documentazione pertinente | Checklist riesame preliminare (sì/no + note), elenco gap / chiarimenti. |
| 3 | `CLARIFICATION` (opzionale) | In attesa risposte cliente | Log richieste (testo + data); **saltabile** se nessun gap. |
| 4 | `QUOTE_PREP` | Preparazione offerta | Bozza allegati interni (preventivo, specifica interna). |
| 5 | `QUOTE_APPROVAL` | Approvazione interna offerta | Esito approvazione + utente + data. |
| 6 | `QUOTE_SENT` | Offerta trasmessa al cliente | Data invio, riferimento versione offerta. |
| 7 | `ORDER_RECEIVED` | Ordine ricevuto | Allegato ordine (PDF), riferimento contratto/ordine. |
| 8 | `FINAL_REVIEW` | Riesame definitivo post-ordine | Checklist riesame definitivo (allineamento ordine vs offerta vs capacità). |
| 9 | `APPROVED` | Chiusura positiva riesame | Pronto per handoff a esecuzione (Fase 2: collegamento a commessa di produzione se esiste modulo). |
| 10 | `CANCELLED` / `REJECTED` | Annullamento o rifiuto | Motivo obbligatorio. |

**Fuori pilota v1**: negoziazione multi-round, varianti contrattuali complesse, export control, penali/LD dettagliate (si tengono come **note libere** se servono).

---

## 5. Documenti “da / per” cliente e fornitori

| Direzione | Esempi pilota | Tracciamento |
|-----------|---------------|--------------|
| **Da cliente** | RFQ, capitolato, drawing, specifiche | Allegati con metadata `direction=in`, `counterparty=customer`. |
| **Per cliente** | Offerta, chiarimenti | `direction=out`, versione incrementale. |
| **Da/per fornitore** | Fase 2 del pilota: stesso schema `direction` + `counterparty=supplier`. |

Versionamento: per il pilota basta **versione logica** (es. `version` integer su record allegato logico o uso document registry se già previsto); evitare duplicazione file binari senza policy storage.

---

## 6. Integrazione tecnica (target architettura)

1. **Document registry / allegati**: nessun nuovo silo file; categorie e link al caso.  
2. **Sprint 9 (import job)**: file PDF possono generare **testo in staging**; operatore incolla o conferma estratti nei campi checklist **solo dopo** revisione (come oggi per import testo).  
3. **Sprint 10 (pianificato)**: tabella o servizio **staging tipizzato** (`document_type` → schema campi) per ridurre errori di transcodifica manuale.  
4. **Licenza modulo** (proposta chiave): es. `commercial_contract_review` — da aggiungere in `moduleLicense.service` quando si implementa; dark launch solo admin.  
5. **Notifiche**: riuso motore alert/email per “approvazione in attesa” e scadenze SLA interne (opzionale).

---

## 7. Criteri di accettazione del pilota (Definition of Done — prodotto)

- Creazione caso + passaggio attraverso tutti gli stati **senza** bypass silenzioso delle checklist obbligatorie.  
- Storico immutabile: ogni cambio stato con **timestamp, utente, motivazione** se regressione.  
- Allegati visibili nel contesto del caso; download con stessa policy sicurezza degli altri moduli.  
- Permessi: utente senza ruolo appropriato non approva.  
- Modulo disabilitato senza licenza → `ModuleLocked` coerente con resto app.

---

## 8. Prossimi passi (non implementati in questo documento)

- ADR breve: “Commercial case vs document types” (se serve separare tassonomicamente).  
- Mock UI wireframe (lista casi, dettaglio, timeline stati).  
- Migrazione DB: tabelle `commercial_cases`, `commercial_case_state_history`, `commercial_case_checklist_responses` (nomi indicativi).

---

*Questa mini-specifica è deliberatamente ristretta al percorso “ordine diretto” per massimizzare robustezza e time-to-value; le gare e i contratti quadro estendono gli stati senza invalidare il modello.*
