# Piano refactor — Registro documentale come SoT normativa

> **Obiettivo prodotto**: norme, leggi, decreti e documenti utili a riesame requisiti / compliance devono essere **fonte di certezza** per l’assistente (riferimenti tracciabili, vigore verificato, niente testo inventato).
>
> **Prerequisito obbligatorio (Gate 0)**: merge + deploy VPS di [PR #65](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/65) (Normattiva, EUR-Lex, email norme superate).
>
> **Riferimenti**: [ADR-009](../adr/ADR-009-multi-standard-architettura-per-norma.md), [ADR-010](../adr/ADR-010-ai-agentic-architecture.md), sezione *Verifica validità norme* in [GUIDA_CONSOLIDATA.md](../GUIDA_CONSOLIDATA.md).

---

## Modello target (dopo tutte le slice)

| Livello | Tabella / modulo | Ruolo |
|--------|-------------------|--------|
| **Inventario studio (SoT visibile)** | `document_registry` (`doc_type=norma`) | Titolo, cartella, stato, `type_specific_data` (codice, ente, vigore, URL ultimo controllo) |
| **Clausole ISO (testo normativo strutturato)** | `norm_requirements` | Gap analysis, riesame requisiti per clausola — **non** sostituisce il registro |
| **Estensione AI opzionale 1:1** | `norm_document_sources` | Solo se esiste PDF/testo da chunkare; `document_id` FK obbligatoria |
| **Connettori vigore** | `normCatalogLookup` + job settimanale | Scrivono sul **registro**; mirror su `norm_document_sources` se riga presente |

**Regola d’oro**: l’utente gestisce **solo** il Registro Documentale; le altre tabelle sono tecniche e derivate.

---

## Stato attuale (gap da chiudere)

| Problema | Impatto |
|---------|---------|
| Job `normValidityChecker` legge solo `norm_document_sources` | Norme create a mano nel registro **non** vengono controllate |
| Vigore in UI spesso solo in `norm_document_sources.validity_status` | Scheda registro e catalogo non allineati |
| Upload bulk crea registro + `norm_document_sources`; form manuale spesso solo registro | Due percorsi, due verità |
| Knowledge index su `document_registry` usa metadati, non chunk norme | AI senza testo se manca riga in `norm_document_sources` |
| Lookup form aggiorna risposta API ma non sempre persiste su registro | Certezza non storica |

---

## Gate 0 — Chiusura PR connettori (non è una slice refactor)

| Step | Azione | Verifica |
|------|--------|----------|
| G0.1 | `gh pr ready 65` → `gh pr merge 65 --merge` | CI verde |
| G0.2 | `git pull origin main` | Branch allineato |
| G0.3 | Deploy backend VPS (`deploy-to-vps.sh` o script noto) + restart PID cambiato | `curl -sk …/api/v1/health` OK |
| G0.4 | Smoke lookup: atto IT (es. D.Lgs.) in scheda norma → risposta Normattiva | Network 200, stato coerente |
| G0.5 | Opzionale: forzare job validità o attendere lunedì; verificare log email se `ALERT_ENABLED=true` | Log `[NormValidityChecker]` |

**Non iniziare slice R1–R6 finché Gate 0 non è OK.**

---

## Slice verticali (ordine vincolante)

Ogni slice = 1 PR committabile, test L1 mirati, deploy backend se tocca job/API. Branch suggerito: `cursor/registry-norm-sot-r<N>-b492`.

### R1 — Job validità sul registro (backend, basso rischio)

**Obiettivo**: `runScheduledValidityCheck` itera tutte le norme `document_registry` con `standard_code` in `type_specific_data`, non solo `norm_document_sources`.

| Voce | Dettaglio |
|------|-----------|
| File | `normValidityChecker.service.js`, eventuale `documentRegistryNorm.service.js` (helper parse JSON) |
| Query | `doc_type IN ('norma', …)` + `JSON_VALUE(type_specific_data, '$.standard_code') IS NOT NULL` |
| Scrittura | Aggiornare `type_specific_data`: `validity_status`, `last_validity_check`, `validity_check_url`, `superseded_by` |
| Mirror | Se esiste `norm_document_sources` per `document_id`, aggiornare anche quella riga (compatibilità transitoria) |
| Test | Jest: mock query + 1 norma solo registro, 1 norma con entrambe le tabelle |
| DoD | Email settimanale elenca titoli dal **registro**; log `checked` include norme senza PDF |

**Non richiede migrazione DB** se si usa solo JSON esistente.

---

### R2 — Persistenza lookup in form/registro (backend + frontend)

**Obiettivo**: ogni `POST /documents/norm-lookup` e salvataggio scheda norma scrivono gli stessi campi vigore sul registro.

| Voce | Dettaglio |
|------|-----------|
| Backend | `documents.controller` o service dedicato: merge in `type_specific_data` su PATCH/POST documento |
| Frontend | `DocumentForm.jsx`: dopo lookup OK, salvare `validity_status`, `catalog_url`, `checked_at` nel payload |
| Test | Vitest: mock API, verifica payload contiene campi vigore |
| DoD | Riaprendo scheda norma si vede ultimo controllo senza rifare lookup |

---

### R3 — Allineamento upload bulk e creazione manuale (backend)

**Obiettivo**: un solo contratto dati tra `normUpload.controller` e CRUD registro.

| Voce | Dettaglio |
|------|-----------|
| File | `normUpload.controller.js`, `documentRegistry` create/update |
| Regola | Creazione registro **prima**; `norm_document_sources` solo se PDF processato |
| Creazione manuale | Opzionale: endpoint “crea stub AI” lazy al primo upload allegato (senza secondo inventario) |
| DoD | Stessi campi `type_specific_data` per upload PDF e per inserimento manuale con stesso codice |

---

### R4 — UI registro: vigore visibile (frontend)

**Obiettivo**: catalogo e albero mostrano stato vigore / superata / data controllo da `type_specific_data`, non da tabella nascosta.

| Voce | Dettaglio |
|------|-----------|
| File | `DocumentDataGrid.jsx`, `DocumentRegistry.jsx`, badge in `DocumentForm.jsx` |
| Filtro | Opzionale: “Norme da verificare” (`last_validity_check` null o > 90 giorni) |
| DoD | Utente vede in lista se una legge è superata senza aprire job log |

---

### R5 — Knowledge index + chunk (backend)

**Obiettivo**: indicizzazione AI legge registro come ancoraggio; testo completo solo da `norm_document_sources` se presente.

| Voce | Dettaglio |
|------|-----------|
| File | `knowledgeIndexer.service.js`, `normChunker.service.js` |
| Query | JOIN `document_registry` LEFT JOIN `norm_document_sources` ON `document_id` |
| Payload index | Metadati sempre da registro; chunk/testo da estensione AI |
| DoD | Norma solo registro → index con metadati + messaggio “testo non indicizzato”; norma con PDF → chunk come oggi |

---

### R6 — Backfill una tantum (script VPS, opzionale)

**Obiettivo**: allineare dati storici prima di R4/R5 in produzione.

| Voce | Dettaglio |
|------|-----------|
| Script | `backend/scripts/backfill-norm-registry-from-sources.js` (esecuzione solo VPS) |
| Logica | Per ogni `norm_document_sources` con `document_id`: copiare `standard_code`, `validity_status`, `last_validity_check` in `type_specific_data` se mancanti |
| Inversa | Registro con codice ma senza riga AI: **non** creare `norm_document_sources` vuota |
| DoD | Report conteggi: aggiornati / già ok / orfani (sources senza document_id) |

**Eseguire dopo R1–R2, prima di R5 se ci sono dati legacy.**

---

### R7 — Documentazione ADR + deprecazione esplicita (doc)

**Obiettivo**: evitare regressioni architetturali.

| Voce | Dettaglio |
|------|-----------|
| File | Appendice in ADR-010 o mini-ADR `ADR-010bis-registry-norm-sot.md` |
| Contenuto | Diagramma SoT, campi JSON canonici, “vietato” duplicare inventario in `norm_document_sources` |
| GUIDA | Link a questo piano + stato slice completate |

---

## Cosa NON è in questo refactor (backlog separato)

| Voce | Motivo |
|------|--------|
| Sprint 11 — Riesame requisiti contratto | Mini-spec dedicata; usa registro ma è un modulo workflow |
| Gap analysis automatica (ADR-010 §5) | Dipende da R1–R5 stabili |
| OCR PDF scansionati | Miglioramento qualità chunk, non SoT |
| Unificare `norm_requirements` con registro | **Errore concettuale** — clausole ≠ inventario documenti |

---

## Parallelismo e conflitti Git

| Slice | Può parallelizzare con |
|-------|------------------------|
| R1 | — (prima slice codice) |
| R2 | R4 (file diversi) dopo R1 merge |
| R3 | R2 (stesso controller family — meglio sequenziale) |
| R4 | R2 |
| R5 | Dopo R1 + R3 |
| R6 | Solo dopo R2 |
| R7 | Sempre, in parallelo a qualsiasi |

---

## Come lanciare il deputy (una slice alla volta)

```
Leggi docs/agent-tasks/TASK_REGISTRY_NORM_R1_VALIDITY_JOB.md ed eseguilo.
Chiudi con TEST OK o FIX NON APPLICABILI.
```

(Sostituire `R1` con la slice attiva; i file `TASK_REGISTRY_NORM_R*.md` vengono creati quando la slice precedente è mergiata.)

---

## Definition of Done — programma completo

- [ ] Gate 0: PR #65 in `main` + VPS aggiornato
- [ ] R1: job settimanale copre **tutte** le norme del registro con codice
- [ ] R2: lookup e salvataggio persistono vigore su `type_specific_data`
- [ ] R3: upload bulk e form manuale stesso schema dati
- [ ] R4: UI mostra vigore dal registro
- [ ] R5: knowledge index ancorato al registro
- [ ] R6 (opz.): backfill eseguito in produzione con report
- [ ] R7: ADR/GUIDA aggiornati
- [ ] Nessuna nuova feature che scrive solo su `norm_document_sources` senza `document_id`

---

## Stima invasività (tecnica, non calendario)

| Slice | Componenti | Rischio |
|-------|------------|---------|
| R1 | 1–2 service backend | Basso |
| R2 | controller + form | Medio-basso |
| R3 | upload + registry | Medio |
| R4 | solo frontend | Basso |
| R5 | indexer + chunker | Medio |
| R6 | script one-shot | Basso (solo VPS) |
| R7 | solo markdown | Nullo |
